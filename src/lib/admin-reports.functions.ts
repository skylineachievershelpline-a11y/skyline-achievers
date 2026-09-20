import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { loadRates } from "./earnings.functions";

/** Reports follow Pakistan time: a day closes at 12:00 midnight PKT. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const pktToday = () => new Date(Date.now() + PKT_OFFSET_MS).toISOString().slice(0, 10);
const shiftDay = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const METRIC_SELECT =
  "member_id, report_date, leads_count, responses, enrollments, pending_count, two_cc, mentorship_paid";

type Totals = {
  leads: number;
  responses: number;
  enrollments: number;
  pending: number;
  twoCc: number;
  mentorshipPaid: number;
};

const emptyTotals = (): Totals => ({
  leads: 0,
  responses: 0,
  enrollments: 0,
  pending: 0,
  twoCc: 0,
  mentorshipPaid: 0,
});

function add(target: Totals, row: Record<string, unknown>) {
  target.leads += Number(row["leads_count"] ?? 0);
  target.responses += Number(row["responses"] ?? 0);
  target.enrollments += Number(row["enrollments"] ?? 0);
  target.pending += Number(row["pending_count"] ?? 0);
  target.twoCc += Number(row["two_cc"] ?? 0);
  target.mentorshipPaid += Number(row["mentorship_paid"] ?? 0);
}

/** Every member's daily-report numbers for any custom range of days. */
export const adminGetReports = createServerFn({ method: "POST" })
  .inputValidator((data: { from?: string; to?: string }) =>
    z.object({ from: dateInput.optional(), to: dateInput.optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const today = pktToday();
    const to = data.to ?? today;
    const from = data.from ?? shiftDay(to, -6);

    const [{ data: members }, { data: reports }] = await Promise.all([
      supabaseAdmin
        .from("member_profiles")
        .select("id, member_id, full_name, status, levels:level_id (name)")
        .order("full_name"),
      supabaseAdmin
        .from("member_daily_reports")
        .select(METRIC_SELECT)
        .gte("report_date", from)
        .lte("report_date", to),
    ]);

    type Row = {
      id: string;
      memberId: string;
      fullName: string;
      status: string;
      level: string | null;
      days: number;
      submittedToday: boolean;
    } & Totals;

    const rows = new Map<string, Row>();
    for (const member of members ?? []) {
      rows.set(member.id as string, {
        id: member.id as string,
        memberId: (member.member_id as string) ?? "—",
        fullName: (member.full_name as string) ?? "—",
        status: (member.status as string) ?? "active",
        level: ((member as { levels?: { name?: string } }).levels?.name ?? null) as string | null,
        days: 0,
        submittedToday: false,
        ...emptyTotals(),
      });
    }

    for (const report of reports ?? []) {
      const row = rows.get(report.member_id as string);
      if (!row) continue;
      add(row, report as Record<string, unknown>);
      row.days += 1;
      if (report.report_date === today) row.submittedToday = true;
    }

    const list = [...rows.values()].sort(
      (a, b) => b.enrollments - a.enrollments || b.leads - a.leads,
    );
    const totals = emptyTotals();
    for (const row of list) {
      totals.leads += row.leads;
      totals.responses += row.responses;
      totals.enrollments += row.enrollments;
      totals.pending += row.pending;
      totals.twoCc += row.twoCc;
      totals.mentorshipPaid += row.mentorshipPaid;
    }

    return { from, to, today, members: list, totals };
  });

/** Day-by-day daily report for one member in any range. */
export const adminGetMemberReport = createServerFn({ method: "POST" })
  .inputValidator((data: { memberId: string; from?: string; to?: string }) =>
    z
      .object({ memberId: z.string().uuid(), from: dateInput.optional(), to: dateInput.optional() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const today = pktToday();
    const to = data.to ?? today;
    const from = data.from ?? shiftDay(to, -6);

    const [{ data: member }, { data: reports }] = await Promise.all([
      supabaseAdmin
        .from("member_profiles")
        .select("id, member_id, full_name")
        .eq("id", data.memberId)
        .maybeSingle(),
      supabaseAdmin
        .from("member_daily_reports")
        .select(`${METRIC_SELECT}, is_absent, absent_reason`)
        .eq("member_id", data.memberId)
        .gte("report_date", from)
        .lte("report_date", to)
        .order("report_date", { ascending: false }),
    ]);

    const days = (reports ?? []).map((row) => ({
      date: row.report_date as string,
      leads: Number(row.leads_count ?? 0),
      responses: Number(row.responses ?? 0),
      enrollments: Number(row.enrollments ?? 0),
      pending: Number(row.pending_count ?? 0),
      twoCc: Number(row.two_cc ?? 0),
      mentorshipPaid: Number(row.mentorship_paid ?? 0),
      absent: Boolean(row.is_absent),
      absentReason: (row.absent_reason as string | null) ?? null,
    }));

    return {
      from,
      to,
      member: member
        ? { fullName: member.full_name as string, memberId: member.member_id as string }
        : null,
      days,
    };
  });

/** Everything waiting for an admin decision, shown at the top of the panel. */
export const adminGetApprovals = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: leaves }, { data: enrollments }] = await Promise.all([
    supabaseAdmin
      .from("leave_applications")
      .select(
        "id, from_date, to_date, reason, status, created_at, member:member_id (full_name, member_id)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("course_enrollments")
      .select("id, buyer_name, buyer_code, amount_pkr, created_at, course:course_id (title)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return {
    leaves: (leaves ?? []).map((row) => ({
      id: row.id as string,
      fromDate: row.from_date as string,
      toDate: row.to_date as string,
      reason: row.reason as string,
      createdAt: row.created_at as string,
      memberName:
        ((row as { member?: { full_name?: string } }).member?.full_name as string) ?? "Member",
      memberCode: ((row as { member?: { member_id?: string } }).member?.member_id as string) ?? "—",
    })),
    courses: (enrollments ?? []).map((row) => ({
      id: row.id as string,
      buyerName: row.buyer_name as string,
      buyerCode: (row.buyer_code as string | null) ?? "—",
      amount: Number(row.amount_pkr ?? 0),
      createdAt: row.created_at as string,
      courseTitle: ((row as { course?: { title?: string } }).course?.title as string) ?? "Course",
    })),
  };
});

/** Approve or reject a leave application. */
export const adminDecideLeave = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: "approved" | "rejected"; adminNote?: string | null }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
        adminNote: z.string().trim().max(400).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("leave_applications")
      .update({
        status: data.status,
        admin_note: data.adminNote ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Current lead / joining rates for the admin settings panel. */
export const adminGetRates = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  return await loadRates();
});

/** Save new lead investment and joining earning amounts. */
export const adminSaveRates = createServerFn({ method: "POST" })
  .inputValidator((data: { lead: number; join: number }) =>
    z
      .object({
        lead: z.number().min(0).max(1_000_000),
        join: z.number().min(0).max(1_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("earning_rates").upsert(
      {
        id: "default",
        lead_investment_pkr: data.lead,
        join_earning_pkr: data.join,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const, lead: data.lead, join: data.join };
  });
