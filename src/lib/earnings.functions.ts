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
        .select("report_date, leads_count, rate_per_lead, is_absent, absent_reason")
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

    const blank = (date: string): EarningsDay => ({
      date,
      leads: 0,
      investment: 0,
      joins: 0,
      earning: 0,
      absent: false,
      absentReason: null,
      saved: false,
    });

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
        absent: Boolean(row.is_absent),
        absentReason: (row.absent_reason as string | null) ?? null,
        saved: true,
      });
    }
    for (const [date, count] of joinsByDay) {
      const existing = byDay.get(date) ?? blank(date);
      existing.joins = count;
      existing.earning = count * JOIN_EARNING_PKR;
      byDay.set(date, existing);
    }

    const days = [...byDay.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
    const monthDays = days.filter((d) => d.date >= monthStart && d.date <= today);
    const sum = (list: EarningsDay[], key: keyof EarningsDay) =>
      list.reduce((total, day) => total + (Number(day[key]) || 0), 0);

    const todayRow = days.find((d) => d.date === today) ?? blank(today);

    return {
      member: { memberId: member.member_id, fullName: member.full_name },
      rates: { lead: LEAD_INVESTMENT_PKR, join: JOIN_EARNING_PKR },
      today: todayRow,
      todayLocked: todayRow.saved,
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
      days: days.slice(0, 60),
    };
  });

/** Add leads to today's record. Saved leads can never be reduced or edited. */
export const addDailyLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { leads: number }) =>
    z.object({ leads: z.number().int().min(1).max(1000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const date = pktToday();

    const { data: existing } = await supabaseAdmin
      .from("member_daily_reports")
      .select("leads_count, is_absent")
      .eq("member_id", member.id)
      .eq("report_date", date)
      .maybeSingle();

    if (existing?.is_absent) {
      throw new Error("Today is marked absent, so leads cannot be added.");
    }

    const total = (existing?.leads_count ?? 0) + data.leads;
    const { error } = await supabaseAdmin.from("member_daily_reports").upsert(
      {
        member_id: member.id,
        report_date: date,
        leads_count: total,
        rate_per_lead: LEAD_INVESTMENT_PKR,
        is_absent: false,
        absent_reason: null,
      },
      { onConflict: "member_id,report_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const, leads: total };
  });

/** Mark today absent with a written application, so zero leads are explained. */
export const markTodayAbsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { reason: string }) =>
    z
      .object({
        reason: z
          .string()
          .trim()
          .min(30, "Please write a proper application (at least 30 characters).")
          .max(1200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const date = pktToday();

    const { data: existing } = await supabaseAdmin
      .from("member_daily_reports")
      .select("leads_count")
      .eq("member_id", member.id)
      .eq("report_date", date)
      .maybeSingle();

    if ((existing?.leads_count ?? 0) > 0) {
      throw new Error("Leads are already saved for today, so absent cannot be marked.");
    }

    const { error } = await supabaseAdmin.from("member_daily_reports").upsert(
      {
        member_id: member.id,
        report_date: date,
        leads_count: 0,
        rate_per_lead: LEAD_INVESTMENT_PKR,
        is_absent: true,
        absent_reason: data.reason,
      },
      { onConflict: "member_id,report_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

