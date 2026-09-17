import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Money rules, in one place. */
export const LEAD_INVESTMENT_PKR = 35;
export const JOIN_EARNING_PKR = 245;

/** Reports follow Pakistan time: a day closes at 12:00 midnight PKT. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function pktToday(): string {
  return new Date(Date.now() + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

/** PKT calendar day of an instant, as YYYY-MM-DD. */
function pktDay(iso: string): string {
  return new Date(new Date(iso).getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

async function activeMember(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("member_profiles")
    .select("id, member_id, full_name, status")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") throw new Error("Your membership is not active.");
  return data;
}

export type EarningsDay = {
  date: string;
  leads: number;
  investment: number;
  joins: number;
  earning: number;
  absent: boolean;
  absentReason: string | null;
  saved: boolean;
};


/** Daily tracking, join earnings and month totals for the signed-in member. */
export const getEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const today = pktToday();
    const monthStart = `${today.slice(0, 7)}-01`;
    const from = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);

    const [{ data: reports }, { data: joins }] = await Promise.all([
      supabaseAdmin
        .from("member_daily_reports")
        .select("report_date, leads_count, rate_per_lead")
        .eq("member_id", member.id)
        .gte("report_date", from)
        .order("report_date", { ascending: false }),
      supabaseAdmin
        .from("trainees")
        .select("id, created_at")
        .eq("upline_id", member.id)
        .gte("created_at", `${from}T00:00:00Z`),
    ]);

    const joinsByDay = new Map<string, number>();
    for (const row of joins ?? []) {
      const day = pktDay(row.created_at as string);
      joinsByDay.set(day, (joinsByDay.get(day) ?? 0) + 1);
    }

    const byDay = new Map<string, EarningsDay>();
    for (const row of reports ?? []) {
      const date = row.report_date as string;
      const leads = row.leads_count ?? 0;
      byDay.set(date, {
        date,
        leads,
        investment: leads * (row.rate_per_lead ?? LEAD_INVESTMENT_PKR),
        joins: 0,
        earning: 0,
      });
    }
    for (const [date, count] of joinsByDay) {
      const existing = byDay.get(date) ?? { date, leads: 0, investment: 0, joins: 0, earning: 0 };
      existing.joins = count;
      existing.earning = count * JOIN_EARNING_PKR;
      byDay.set(date, existing);
    }

    const days = [...byDay.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
    const monthDays = days.filter((d) => d.date >= monthStart && d.date <= today);
    const sum = (list: EarningsDay[], key: keyof EarningsDay) =>
      list.reduce((total, day) => total + (day[key] as number), 0);

    const todayRow =
      days.find((d) => d.date === today) ??
      ({ date: today, leads: 0, investment: 0, joins: 0, earning: 0 } as EarningsDay);

    return {
      member: { memberId: member.member_id, fullName: member.full_name },
      rates: { lead: LEAD_INVESTMENT_PKR, join: JOIN_EARNING_PKR },
      today: todayRow,
      todayLocked: false,
      month: {
        label: new Date(`${monthStart}T00:00:00Z`).toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }),
        leads: sum(monthDays, "leads"),
        investment: sum(monthDays, "investment"),
        joins: sum(monthDays, "joins"),
        earning: sum(monthDays, "earning"),
      },
      lifetime: {
        leads: sum(days, "leads"),
        investment: sum(days, "investment"),
        joins: sum(days, "joins"),
        earning: sum(days, "earning"),
      },
      days: days.slice(0, 45),
    };
  });

/** Save today's leads. Past days are closed at midnight and cannot be edited. */
export const saveDailyLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { leads: number }) =>
    z.object({ leads: z.number().int().min(0).max(1000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("member_daily_reports").upsert(
      {
        member_id: member.id,
        report_date: pktToday(),
        leads_count: data.leads,
        rate_per_lead: LEAD_INVESTMENT_PKR,
      },
      { onConflict: "member_id,report_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
