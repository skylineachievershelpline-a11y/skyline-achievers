import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { JOIN_EARNING_PKR, LEAD_INVESTMENT_PKR } from "./earnings.functions";

/** Reports follow Pakistan time: a day closes at 12:00 midnight PKT. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const pktToday = () => new Date(Date.now() + PKT_OFFSET_MS).toISOString().slice(0, 10);
const pktDay = (iso: string) =>
  new Date(new Date(iso).getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);

const monthInput = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .optional();

function monthRange(month?: string) {
  const key = month ?? pktToday().slice(0, 7);
  const start = `${key}-01`;
  const year = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const nextMonth = m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, "0")}-01`;
  return { key, start, end: nextMonth };
}

/** Every member's leads, investment, joinings and earning for one month. */
export const adminGetReports = createServerFn({ method: "POST" })
  .inputValidator((data: { month?: string }) => z.object({ month: monthInput }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { key, start, end } = monthRange(data.month);
    const today = pktToday();

    const [{ data: members }, { data: reports }, { data: joins }] = await Promise.all([
      supabaseAdmin
        .from("member_profiles")
        .select("id, member_id, full_name, status, levels:level_id (name)")
        .order("full_name"),
      supabaseAdmin
        .from("member_daily_reports")
        .select("member_id, report_date, leads_count, rate_per_lead")
        .gte("report_date", start)
        .lt("report_date", end),
      supabaseAdmin
        .from("trainees")
        .select("id, upline_id, created_at")
        .gte("created_at", `${start}T00:00:00Z`)
        .lt("created_at", `${end}T00:00:00Z`),
    ]);

    type Row = {
      id: string;
      memberId: string;
      fullName: string;
      status: string;
      level: string | null;
      leads: number;
      investment: number;
      joins: number;
      earning: number;
      todayLeads: number;
      todayJoins: number;
    };

    const rows = new Map<string, Row>();
    for (const m of members ?? []) {
      rows.set(m.id as string, {
        id: m.id as string,
        memberId: (m.member_id as string) ?? "—",
        fullName: (m.full_name as string) ?? "—",
        status: (m.status as string) ?? "active",
        level: ((m as { levels?: { name?: string } }).levels?.name ?? null) as string | null,
        leads: 0,
        investment: 0,
        joins: 0,
        earning: 0,
        todayLeads: 0,
        todayJoins: 0,
      });
    }

    for (const r of reports ?? []) {
      const row = rows.get(r.member_id as string);
      if (!row) continue;
      const leads = (r.leads_count as number) ?? 0;
      row.leads += leads;
      row.investment += leads * ((r.rate_per_lead as number) ?? LEAD_INVESTMENT_PKR);
      if (r.report_date === today) row.todayLeads += leads;
    }

    for (const j of joins ?? []) {
      const row = rows.get(j.upline_id as string);
      if (!row) continue;
      row.joins += 1;
      row.earning += JOIN_EARNING_PKR;
      if (pktDay(j.created_at as string) === today) row.todayJoins += 1;
    }

    const list = [...rows.values()].sort((a, b) => b.earning - a.earning || b.leads - a.leads);
    const totals = list.reduce(
      (acc, row) => ({
        leads: acc.leads + row.leads,
        investment: acc.investment + row.investment,
        joins: acc.joins + row.joins,
        earning: acc.earning + row.earning,
      }),
      { leads: 0, investment: 0, joins: 0, earning: 0 },
    );

    return { month: key, today, members: list, totals, rates: { lead: LEAD_INVESTMENT_PKR, join: JOIN_EARNING_PKR } };
  });

/** Day-by-day report for one member in one month. */
export const adminGetMemberReport = createServerFn({ method: "POST" })
  .inputValidator((data: { memberId: string; month?: string }) =>
    z.object({ memberId: z.string().uuid(), month: monthInput }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { key, start, end } = monthRange(data.month);

    const [{ data: member }, { data: reports }, { data: joins }] = await Promise.all([
      supabaseAdmin
        .from("member_profiles")
        .select("id, member_id, full_name")
        .eq("id", data.memberId)
        .maybeSingle(),
      supabaseAdmin
        .from("member_daily_reports")
        .select("report_date, leads_count, rate_per_lead")
        .eq("member_id", data.memberId)
        .gte("report_date", start)
        .lt("report_date", end),
      supabaseAdmin
        .from("trainees")
        .select("id, created_at")
        .eq("upline_id", data.memberId)
        .gte("created_at", `${start}T00:00:00Z`)
        .lt("created_at", `${end}T00:00:00Z`),
    ]);

    const byDay = new Map<
      string,
      { date: string; leads: number; investment: number; joins: number; earning: number }
    >();
    const day = (date: string) => {
      const found = byDay.get(date) ?? { date, leads: 0, investment: 0, joins: 0, earning: 0 };
      byDay.set(date, found);
      return found;
    };

    for (const r of reports ?? []) {
      const row = day(r.report_date as string);
      const leads = (r.leads_count as number) ?? 0;
      row.leads += leads;
      row.investment += leads * ((r.rate_per_lead as number) ?? LEAD_INVESTMENT_PKR);
    }
    for (const j of joins ?? []) {
      const row = day(pktDay(j.created_at as string));
      row.joins += 1;
      row.earning += JOIN_EARNING_PKR;
    }

    const days = [...byDay.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
    return {
      month: key,
      member: member
        ? { fullName: member.full_name as string, memberId: member.member_id as string }
        : null,
      days,
    };
  });
