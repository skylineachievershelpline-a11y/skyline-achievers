import { analyzePerformance, type PerformanceAnalysis, type TrendDayInput } from "@/lib/performance-trend";

export const pakistanToday = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);

export function monthBounds(month: string, today = pakistanToday()) {
  const [year, number] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
  return { start: `${month}-01`, end: last > today ? today : last };
}

export function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function availableMonths(rows: { date: string }[], today: string) {
  const earliest = rows.reduce((min, row) => row.date < min ? row.date : min, today);
  const months: string[] = [];
  for (let year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
    `${year}-${String(month).padStart(2, "0")}` >= earliest.slice(0, 7);
    month -= 1) {
    if (month === 0) { year -= 1; month = 12; }
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key >= earliest.slice(0, 7)) months.push(key);
  }
  return months;
}

/** The selected calendar month compares with the preceding calendar month, not a rolling 30-day window. */
export function analyzeMonth(rows: TrendDayInput[], month: string, today = pakistanToday()): PerformanceAnalysis {
  const { start, end } = monthBounds(month, today);
  const [year, number] = month.split("-").map(Number);
  const preceding = new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
  const previous = monthBounds(preceding, today);
  return analyzePerformance(rows, start, end, previous);
}