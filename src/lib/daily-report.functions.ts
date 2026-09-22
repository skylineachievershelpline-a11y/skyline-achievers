import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Reports follow Pakistan time: a day closes at 12:00 midnight PKT. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
/** Reports can only be submitted after 8 PM PKT, until midnight. */
export const REPORT_OPEN_HOUR = 20;
/** Fifteen days inactive without approved leave blocks the account. */
export const MISSED_DAYS_BLOCK = 15;

const pktNow = () => new Date(Date.now() + PKT_OFFSET_MS);
const pktToday = () => pktNow().toISOString().slice(0, 10);
const pktHour = () => pktNow().getUTCHours();
const shiftDay = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

export type ReportDay = {
  date: string;
  leads: number;
  responses: number;
  enrollments: number;
  pending: number;
  twoCc: number;
  mentorshipPaid: number;
  absent: boolean;
  absentReason: string | null;
  submitted: boolean;
};

export type LeaveApplication = {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

async function activeMember(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("member_profiles")
    .select("id, member_id, full_name, status, created_at, levels:level_id (rank_order)")
    .eq("id", userId)
    .maybeSingle();
  if (!data) throw new Error("Your membership is not active.");
  return data;
}

/** Personal Mentorship (rank 1) accounts train only — no working report yet. */
const rankOf = (member: any) => Number(member?.levels?.rank_order ?? 0);


function mapRow(row: Record<string, unknown>): ReportDay {
  return {
    date: row["report_date"] as string,
    leads: Number(row["leads_count"] ?? 0),
    responses: Number(row["responses"] ?? 0),
    enrollments: Number(row["enrollments"] ?? 0),
    pending: Number(row["pending_count"] ?? 0),
    twoCc: Number(row["two_cc"] ?? 0),
    mentorshipPaid: Number(row["mentorship_paid"] ?? 0),
    absent: Boolean(row["is_absent"]),
    absentReason: (row["absent_reason"] as string | null) ?? null,
    submitted: true,
  };
}

const blankDay = (date: string): ReportDay => ({
  date,
  leads: 0,
  responses: 0,
  enrollments: 0,
  pending: 0,
  twoCc: 0,
  mentorshipPaid: 0,
  absent: false,
  absentReason: null,
  submitted: false,
});

/**
 * Daily report workspace for the signed-in member: today's record, the last
 * 90 days of history, leave applications and the missed-report warning level.
 * Three missed days in a row blocks the account automatically.
 */
export const getDailyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const today = pktToday();
    const from = shiftDay(today, -120);

    const [{ data: reports }, { data: leaves }] = await Promise.all([
      supabaseAdmin
        .from("member_daily_reports")
        .select(
          "report_date, leads_count, responses, enrollments, pending_count, two_cc, mentorship_paid, is_absent, absent_reason",
        )
        .eq("member_id", member.id)
        .gte("report_date", from)
        .order("report_date", { ascending: false }),
      supabaseAdmin
        .from("leave_applications")
        .select("id, from_date, to_date, reason, status, admin_note, created_at")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const days = (reports ?? []).map((row) => mapRow(row as Record<string, unknown>));
    const byDate = new Map(days.map((day) => [day.date, day]));

    const leaveList: LeaveApplication[] = (leaves ?? []).map((row) => ({
      id: row.id as string,
      fromDate: row.from_date as string,
      toDate: row.to_date as string,
      reason: row.reason as string,
      status: row.status as string,
      adminNote: (row.admin_note as string | null) ?? null,
      createdAt: row.created_at as string,
    }));

    const onApprovedLeave = (date: string) =>
      leaveList.some(
        (leave) =>
          leave.status === "approved" && date >= leave.fromDate && date <= leave.toDate,
      );

    // Count missed days walking back from yesterday. An approved leave day is skipped.
    // Fifteen missed working days in a row without leave blocks the account.
    const joinedDay = new Date(member.created_at as string).toISOString().slice(0, 10);
    // Personal Mentorship (rank 1) accounts only train: no working report, no
    // missed-report warnings and never an automatic block.
    const trainingOnly = rankOf(member) < 2;
    const missedDates: string[] = [];
    if (!trainingOnly) {
      for (let back = 1; back <= 60 && missedDates.length < MISSED_DAYS_BLOCK; back += 1) {
        const date = shiftDay(today, -back);
        if (date < joinedDay) break;
        if (onApprovedLeave(date)) continue;
        if (byDate.has(date)) break;
        missedDates.push(date);
      }
    }

    let status = member.status as string;
    if (!trainingOnly && missedDates.length >= MISSED_DAYS_BLOCK && status === "active") {
      await supabaseAdmin
        .from("member_profiles")
        .update({ status: "blocked" })
        .eq("id", member.id);
      status = "blocked";
    }

    const { buildReportCalendar } = await import("./report-days.server");
    const calendar = buildReportCalendar({
      reports: (reports ?? []) as Record<string, unknown>[],
      leaves: (leaves ?? []) as { from_date: string; to_date: string; status?: string | null }[],
      endDate: today,
      days: 30,
      joinedDate: joinedDay,
    });

    const hour = pktHour();
    return {
      member: { memberId: member.member_id as string, fullName: member.full_name as string },
      trainingOnly,
      today: byDate.get(today) ?? blankDay(today),
      todaySubmitted: byDate.has(today),
      windowOpen: hour >= REPORT_OPEN_HOUR,
      openHourLabel: "8:00 PM",
      status,
      warning: { level: Math.min(missedDates.length, 3), missedDates },
      days,
      calendar,
      leaves: leaveList,
    };
  });


/** Save (or update) today's daily report. Only between 8 PM and midnight PKT. */
export const submitDailyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      leads: number;
      responses: number;
      enrollments: number;
      pending: number;
      twoCc: number;
      mentorshipPaid: number;
    }) => {
      const count = z.number().int().min(0).max(100_000);
      return z
        .object({
          leads: count,
          responses: count,
          enrollments: count,
          pending: count,
          twoCc: count,
          mentorshipPaid: count,
        })
        .parse(data);
    },
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    if (member.status !== "active") throw new Error("Your account is not active.");
    if (pktHour() < REPORT_OPEN_HOUR) {
      throw new Error("The daily report opens at 8:00 PM and closes at 12:00 midnight.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadRates } = await import("./earnings.functions");
    const rates = await loadRates();

    const { error } = await supabaseAdmin.from("member_daily_reports").upsert(
      {
        member_id: member.id,
        report_date: pktToday(),
        leads_count: data.leads,
        responses: data.responses,
        enrollments: data.enrollments,
        pending_count: data.pending,
        two_cc: data.twoCc,
        mentorship_paid: data.mentorshipPaid,
        rate_per_lead: rates.lead,
        is_absent: false,
        absent_reason: null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "member_id,report_date" },
    );
    if (error) throw new Error(error.message);

    // Working again during an approved leave cancels that leave from today on:
    // the member counts as active from the day they report.
    const today = pktToday();
    const { data: running } = await supabaseAdmin
      .from("leave_applications")
      .select("id, from_date, to_date")
      .eq("member_id", member.id)
      .eq("status", "approved")
      .lte("from_date", today)
      .gte("to_date", today);
    for (const leave of (running ?? []) as { id: string; from_date: string }[]) {
      if (leave.from_date >= today) {
        await supabaseAdmin
          .from("leave_applications")
          .update({ status: "cancelled", admin_note: "Cancelled automatically: member reported work." })
          .eq("id", leave.id);
      } else {
        await supabaseAdmin
          .from("leave_applications")
          .update({
            to_date: shiftDay(today, -1),
            admin_note: "Shortened automatically: member reported work.",
          })
          .eq("id", leave.id);
      }
    }
    return { ok: true as const };
  });

/** Ask the admin for leave. Approved leave days never count as a missed report. */
export const submitLeaveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fromDate: string; toDate: string; reason: string }) =>
    z
      .object({
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z
          .string()
          .trim()
          .min(25, "Please write a proper application (at least 25 characters).")
          .max(1500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    if (data.toDate < data.fromDate) throw new Error("The end date cannot be before the start date.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("leave_applications").insert({
      member_id: member.id,
      from_date: data.fromDate,
      to_date: data.toDate,
      reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
