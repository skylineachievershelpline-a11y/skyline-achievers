/**
 * One shared day-by-day report list used by the member panel, the upline team
 * tree and the admin report export. Every calendar day gets a status:
 * a submitted report, an approved leave day, or an absent day.
 */

export type ReportDayStatus = "report" | "leave" | "absent";

export type ReportCalendarDay = {
  date: string;
  status: ReportDayStatus;
  leads: number;
  responses: number;
  enrollments: number;
  pending: number;
  twoCc: number;
  mentorshipPaid: number;
};

export const shiftDate = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

type ReportRow = Record<string, unknown>;
type LeaveRow = { from_date: string; to_date: string; status?: string | null };

/**
 * Builds the calendar backwards from `endDate` for `days` days. A day the member
 * had not joined yet is left out.
 */
export function buildReportCalendar(options: {
  reports: ReportRow[];
  leaves: LeaveRow[];
  endDate: string;
  days: number;
  joinedDate?: string | null;
}): ReportCalendarDay[] {
  const byDate = new Map<string, ReportRow>();
  for (const row of options.reports) {
    const date = String(row["report_date"] ?? "");
    if (date && !byDate.has(date)) byDate.set(date, row);
  }
  const leaves = options.leaves.filter((leave) => (leave.status ?? "approved") === "approved");
  const onLeave = (date: string) =>
    leaves.some((leave) => date >= leave.from_date && date <= leave.to_date);

  const out: ReportCalendarDay[] = [];
  for (let back = 0; back < options.days; back += 1) {
    const date = shiftDate(options.endDate, -back);
    if (options.joinedDate && date < options.joinedDate) break;
    const row = byDate.get(date);
    if (row && row["is_absent"] !== true) {
      out.push({
        date,
        status: "report",
        leads: Number(row["leads_count"] ?? 0),
        responses: Number(row["responses"] ?? 0),
        enrollments: Number(row["enrollments"] ?? 0),
        pending: Number(row["pending_count"] ?? 0),
        twoCc: Number(row["two_cc"] ?? 0),
        mentorshipPaid: Number(row["mentorship_paid"] ?? 0),
      });
      continue;
    }
    out.push({
      date,
      status: onLeave(date) ? "leave" : "absent",
      leads: 0,
      responses: 0,
      enrollments: 0,
      pending: 0,
      twoCc: 0,
      mentorshipPaid: 0,
    });
  }
  return out;
}
