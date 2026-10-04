/**
 * One shared performance calculation for the dashboard graph and the Daily Report PDF.
 * Input is the real day-by-day report calendar (report / leave / absent days).
 * Wording is strictly data-based — never a judgement about the person.
 */
export type TrendDayInput = {
  date: string;
  status?: "report" | "leave" | "absent";
  absent?: boolean;
  leads: number;
  responses: number;
  enrollments: number;
  pending: number;
  twoCc: number;
  mentorshipPaid: number;
};

export const TREND_METRICS = [
  { key: "leads", label: "Leads", color: "#2E8BFF" },
  { key: "responses", label: "Responses", color: "#21D07A" },
  { key: "enrollments", label: "Enrollments", color: "#FF4D5E" },
  { key: "twoCc", label: "2CC", color: "#F5B83D" },
  { key: "mentorshipPaid", label: "PM Fee", color: "#B57BFF" },
] as const;

export type MetricKey = (typeof TREND_METRICS)[number]["key"];

export type TrendPoint = TrendDayInput & { status: "report" | "leave" | "absent"; activity: number };

export type TrendKind = "increasing" | "stable" | "decreasing" | "inconsistent" | "no-data";

export type PerformanceAnalysis = {
  start: string;
  end: string;
  days: number;
  series: TrendPoint[];
  totals: Record<MetricKey | "activity", number>;
  workingDays: number;
  leaveDays: number;
  absentDays: number;
  completionPercent: number;
  avgPerWorkingDay: number;
  trend: TrendKind;
  trendText: string;
  events: { date: string; kind: "drop" | "improvement"; text: string }[];
  previous: null | {
    start: string;
    end: string;
    totals: Record<MetricKey | "activity", number>;
    workingDays: number;
    changes: { label: string; current: number; previous: number; percent: number | null; text: string }[];
  };
  headline: string;
};

const shift = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const span = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000) + 1;
const short = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

/** Activity = Leads + Responses + Enrollments (2CC / PM Fee stay elsewhere in the report). */
const activityOf = (d: TrendDayInput) =>
  (Number(d.leads) || 0) + (Number(d.responses) || 0) + (Number(d.enrollments) || 0);

export const SIMPLE_METRICS = [
  { key: "activity", label: "Activities" },
  { key: "leads", label: "Leads" },
  { key: "responses", label: "Responses" },
  { key: "enrollments", label: "Enrollments" },
] as const;

export type SimpleCompare = { label: string; previous: number; current: number; percent: number | null; text: string };

/** Very simple arrows-and-numbers comparison used by the dashboard and the PDF. */
export function simpleComparison(a: PerformanceAnalysis): SimpleCompare[] {
  if (!a.previous) return [];
  return SIMPLE_METRICS.map((m) => {
    const current = a.totals[m.key];
    const previous = a.previous?.totals[m.key] ?? 0;
    const p = pct(current, previous);
    const text = p === null ? "New" : p === 0 ? "Same" : `${p > 0 ? "Up" : "Down"} ${Math.abs(p)}%`;
    return { label: m.label, previous, current, percent: p, text };
  });
}

/** One short, data-only sentence (Roman Urdu). Never a judgement about the person. */
export function performanceInsight(a: PerformanceAnalysis): string {
  const total = a.series.length;
  if (!total) return "Is period ka koi report record nahi mila.";
  if (a.workingDays === 0) return `Is period mein koi activity record nahi hui (${total} din).`;
  const prev = a.previous;
  const p = prev ? pct(a.totals.activity, prev.totals.activity) : null;
  if (prev && a.workingDays < prev.workingDays && (p ?? 0) < 0)
    return `Working kam hui. Sirf ${a.workingDays} din activity record hui (pehle ${prev.workingDays} din).`;
  if (prev && a.workingDays > prev.workingDays && (p ?? 0) >= 0)
    return `Working improve hui. Is period ${a.workingDays} working days record huay.`;
  if (p !== null && p >= 10) return `Activity previous period ke muqable mein ${p}% increase hui.`;
  if (p !== null && p <= -10) return `Activity previous period ke muqable mein ${Math.abs(p)}% kam hui.`;
  if (prev) return "Activity stable rahi.";
  return `${total} din mein se ${a.workingDays} din activity record hui.`;
}

function buildSeries(rows: TrendDayInput[], start: string, end: string): TrendPoint[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: TrendPoint[] = [];
  for (let date = start; date <= end; date = shift(date, 1)) {
    const r = byDate.get(date);
    if (!r) continue; // before joining / outside known history
    const status = r.status ?? (r.absent ? "absent" : "report");
    out.push({ ...r, status, activity: status === "report" ? activityOf(r) : 0 });
  }
  return out;
}

function totalsOf(series: TrendPoint[]) {
  const t = { leads: 0, responses: 0, enrollments: 0, twoCc: 0, mentorshipPaid: 0, activity: 0 };
  for (const d of series) {
    if (d.status !== "report") continue;
    for (const m of TREND_METRICS) t[m.key] += Number(d[m.key]) || 0;
    t.activity += d.activity;
  }
  return t;
}

const pct = (cur: number, prev: number) => (prev === 0 ? (cur === 0 ? 0 : null) : Math.round(((cur - prev) / prev) * 100));

function changeText(label: string, p: number | null, cur: number) {
  if (p === null) return cur > 0 ? `${label} started (no data in previous period)` : `${label}: no data`;
  if (Math.abs(p) < 5) return `${label} remained stable`;
  return p > 0 ? `${label} increased ${p}%` : `${label} decreased ${Math.abs(p)}%`;
}

/** Analyses [start, end] from the calendar; optionally compare to a calendar month instead of an equal-length period. */
export function analyzePerformance(rows: TrendDayInput[], start: string, end: string, previousRange?: { start: string; end: string }): PerformanceAnalysis {
  const series = buildSeries(rows, start, end);
  const totals = totalsOf(series);
  const workingDays = series.filter((d) => d.status === "report").length;
  const leaveDays = series.filter((d) => d.status === "leave").length;
  const absentDays = series.filter((d) => d.status === "absent").length;
  const expected = series.length - leaveDays;
  const completionPercent = expected > 0 ? Math.round((workingDays / expected) * 100) : 0;

  // Trend: least-squares slope of daily activity, relative to the period average.
  const ys = series.map((d) => d.activity);
  const n = ys.length;
  const mean = n ? ys.reduce((a, b) => a + b, 0) / n : 0;
  let trend: TrendKind = "no-data";
  if (n >= 3 && mean > 0) {
    const xm = (n - 1) / 2;
    let num = 0;
    let den = 0;
    ys.forEach((y, i) => {
      num += (i - xm) * (y - mean);
      den += (i - xm) ** 2;
    });
    const relChange = ((num / den) * (n - 1)) / mean; // change across period vs average
    const sd = Math.sqrt(ys.reduce((a, y) => a + (y - mean) ** 2, 0) / n);
    const cv = sd / mean;
    if (relChange > 0.2) trend = "increasing";
    else if (relChange < -0.2) trend = "decreasing";
    else if (cv > 0.8) trend = "inconsistent";
    else trend = "stable";
  }
  const trendText = {
    increasing: "Activity increased across this period",
    decreasing: "Activity decreased across this period",
    stable: "Performance remained stable",
    inconsistent: "Activity was inconsistent from day to day",
    "no-data": "Not enough report data in this period",
  }[trend];

  // Sudden changes: 3-day average vs the 3 days before it.
  const events: PerformanceAnalysis["events"] = [];
  for (let i = 5; i < n; i += 1) {
    const before = (ys[i - 5]! + ys[i - 4]! + ys[i - 3]!) / 3;
    const after = (ys[i - 2]! + ys[i - 1]! + ys[i]!) / 3;
    const last = events[events.length - 1];
    if (last && span(last.date, series[i]!.date) < 8) continue;
    if (series.slice(i - 5, i + 1).some((d) => d.status !== "report")) continue;
    if (before >= 3 && after <= before * 0.5) {
      events.push({ date: series[i - 2]!.date, kind: "drop", text: `Sudden drop from ${short(series[i - 2]!.date)}` });
    } else if (after >= 3 && after >= Math.max(1, before) * 1.8) {
      events.push({ date: series[i - 2]!.date, kind: "improvement", text: `Sudden improvement from ${short(series[i - 2]!.date)}` });
    }
  }

  // Previous period of equal length.
  const len = span(start, end);
  const pEnd = previousRange?.end ?? shift(start, -1);
  const pStart = previousRange?.start ?? shift(start, -len);
  const prevSeries = buildSeries(rows, pStart, pEnd);
  let previous: PerformanceAnalysis["previous"] = null;
  if (prevSeries.length) {
    const pt = totalsOf(prevSeries);
    const pw = prevSeries.filter((d) => d.status === "report").length;
    const items: [string, number, number][] = [
      ["Activity", totals.activity, pt.activity],
      ...TREND_METRICS.map((m) => [m.label, totals[m.key], pt[m.key]] as [string, number, number]),
      ["Working days", workingDays, pw],
    ];
    previous = {
      start: pStart,
      end: pEnd,
      totals: pt,
      workingDays: pw,
      changes: items.map(([label, c, p]) => ({ label, current: c, previous: p, percent: pct(c, p), text: changeText(label, pct(c, p), c) })),
    };
  }

  const a = previous?.changes[0];
  const headline = a
    ? a.percent === null
      ? `Last ${len} days: activity ${totals.activity}; no activity in the previous ${len} days.`
      : `Last ${len} days activity ${a.percent > 0 ? "↑" : a.percent < 0 ? "↓" : "→"} ${Math.abs(a.percent)}% compared with previous ${len} days.`
    : `${trendText}.`;

  return {
    start,
    end,
    days: len,
    series,
    totals,
    workingDays,
    leaveDays,
    absentDays,
    completionPercent,
    avgPerWorkingDay: workingDays ? Math.round((totals.activity / workingDays) * 10) / 10 : 0,
    trend,
    trendText,
    events,
    previous,
    headline,
  };
}
