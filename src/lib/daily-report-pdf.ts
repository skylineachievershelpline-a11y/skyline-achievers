import { BRAND } from "@/lib/brand";
import { analyzeMonth, monthLabel } from "@/lib/performance-month";
import { analyzePerformance, performanceInsight, simpleComparison, type PerformanceAnalysis } from "@/lib/performance-trend";

export type DailyReportRow = {
  date: string;
  leads: number;
  responses: number;
  enrollments: number;
  pending: number;
  twoCc: number;
  mentorshipPaid: number;
  absent?: boolean;
  status?: "report" | "leave" | "absent";
};

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export const REPORT_COLUMNS = [
  { key: "leads", label: "Leads" },
  { key: "responses", label: "Response" },
  { key: "enrollments", label: "Enroll" },
  { key: "pending", label: "Pending" },
  { key: "twoCc", label: "2CC" },
  { key: "mentorshipPaid", label: "PM Fee" },
] as const;

type PdfDoc = import("jspdf").jsPDF;

/** Same daily activities, summary and month comparison as the on-screen monthly graph. */
function drawPerformance(doc: PdfDoc, analysis: PerformanceAnalysis, label: string, startY: number) {
  const width = doc.internal.pageSize.getWidth();
  let y = startY;
  const ensure = (need: number) => {
    if (y + need > 785) { doc.addPage(); y = 55; }
  };
  ensure(130);
  doc.setTextColor(20, 24, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Performance report - ${label}`, 40, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const insightLines = doc.splitTextToSize(performanceInsight(analysis), width - 96) as string[];
  doc.setFillColor(232, 242, 255);
  doc.rect(40, y - 10, width - 80, 13 + insightLines.length * 11, "F");
  doc.text(insightLines, 48, y + 2);
  y += 18 + insightLines.length * 11;
  const summary: [string, string][] = [
    ["Working Days", `${analysis.workingDays} / ${analysis.series.length}`],
    ["Total Activities", String(analysis.totals.activity)],
    ["Leads", String(analysis.totals.leads)],
    ["Responses", String(analysis.totals.responses)],
    ["Enrollments", String(analysis.totals.enrollments)],
  ];
  const cw = (width - 104) / 5;
  summary.forEach(([title, value], index) => {
    const x = 40 + index * (cw + 6);
    doc.setDrawColor(210, 220, 235);
    doc.roundedRect(x, y, cw, 42, 3, 3);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(value, x + cw / 2, y + 18, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text(title.toUpperCase(), x + cw / 2, y + 33, { align: "center" });
  });
  y += 60;
  ensure(195);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Daily activity", 40, y);
  y += 13;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text("Leads + Responses + Enrollments", 40, y);
  y += 15;
  const left = 53;
  const right = width - 48;
  const top = y;
  const bottom = top + 135;
  const series = analysis.series;
  const max = Math.max(1, ...series.map((d) => d.activity));
  for (const fraction of [0, 0.5, 1]) {
    const lineY = bottom - 125 * fraction;
    doc.setDrawColor(226, 232, 240);
    doc.line(left, lineY, right, lineY);
    doc.setTextColor(110, 120, 140);
    doc.text(String(Math.round(max * fraction)), left - 6, lineY + 3, { align: "right" });
  }
  const x = (i: number) => left + (i / Math.max(1, series.length - 1)) * (right - left);
  const graphY = (value: number) => bottom - (value / max) * 125;
  if (series.length > 1) {
    // Blue-to-cyan daily area echoes the on-screen chart without obscuring zero-activity dates.
    series.forEach((day, index) => {
      if (index === 0) return;
      const prev = series[index - 1];
      if (!prev) return;
      const hue = index / series.length;
      doc.setFillColor(193 - Math.round(52 * hue), 230 + Math.round(12 * hue), 249 - Math.round(29 * hue));
      // Fine vertical bands approximate the sloped, tinted area in print.
      for (let slice = 0; slice < 8; slice += 1) {
        const position = (slice + 0.5) / 8;
        const topY = graphY(prev.activity + (day.activity - prev.activity) * position);
        doc.rect(x(index - 1) + (x(index) - x(index - 1)) * slice / 8, topY, (x(index) - x(index - 1)) / 8 + 0.2, bottom - topY, "F");
      }
      doc.setDrawColor(0, 155 + Math.round(50 * hue), 225 - Math.round(72 * hue));
      doc.setLineWidth(2);
      doc.line(x(index - 1), graphY(prev.activity), x(index), graphY(day.activity));
    });
  }
  doc.setTextColor(80, 92, 112); doc.setFontSize(8);
  [...new Set([0, Math.floor((series.length - 1) / 4), Math.floor((series.length - 1) / 2), Math.floor((series.length - 1) * 3 / 4), series.length - 1])]
    .filter((i) => i >= 0 && series[i])
    .forEach((i) => doc.text(String(Number(series[i]?.date.slice(-2))), x(i), bottom + 12, { align: "center" }));
  y = bottom + 34;
  const comparison = simpleComparison(analysis);
  if (comparison.length) {
    ensure(90);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Previous month vs selected month", 40, y);
    y += 16;
    doc.setFontSize(9);
    for (const item of comparison) {
      doc.setFont("helvetica", item.label === "Activities" ? "bold" : "normal");
      doc.text(`${item.label}: ${item.previous} -> ${item.current}`, 44, y);
      doc.text(item.text, width - 44, y, { align: "right" });
      y += 13;
    }
  }
  if (analysis.leaveDays || analysis.absentDays) {
    ensure(20);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`Leave: ${analysis.leaveDays} days  /  Absent: ${analysis.absentDays} days`, 44, y + 4);
    y += 16;
  }
  return y;
}

export async function buildPerformancePdf(options: { person: string; personId: string; month: string; monthLabel: string; analysis: PerformanceAnalysis }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(7, 12, 30); doc.rect(0, 0, width, 85, "F");
  doc.setFillColor(0, 176, 255); doc.rect(0, 83, width, 3, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(17);
  doc.text(BRAND.name, 40, 39);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(`${options.monthLabel} - Monthly performance`, 40, 59);
  doc.setTextColor(20, 24, 40); doc.setFontSize(10);
  doc.text(`${options.person}  /  ${options.personId}`, 40, 112);
  drawPerformance(doc, options.analysis, options.monthLabel, 146);
  const slug = options.personId.replace(/[^a-z0-9]/gi, "") || "member";
  return { blob: doc.output("blob") as Blob, name: `skyline-performance-${slug}-${options.month}.pdf` };
}

/** Branded daily-report PDF for any custom range of days. */
export async function buildDailyReportPdf(options: {
  title: string;
  person: string;
  personId: string;
  rangeLabel: string;
  rows: DailyReportRow[];
  month?: string;
  /** Same analysis the dashboard graph shows; computed from rows when omitted. */
  analysis?: PerformanceAnalysis;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  doc.setFillColor(7, 12, 30);
  doc.rect(0, 0, width, 96, "F");
  doc.setFillColor(0, 176, 255);
  doc.rect(0, 94, width, 3, "F");

  try {
    const response = await fetch(BRAND.logoUrl);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("logo"));
      reader.readAsDataURL(blob);
    });
    doc.addImage(dataUrl, "PNG", 40, 22, 52, 52);
  } catch {
    /* logo is optional in the report */
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(BRAND.name, 106, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(options.title, 106, 64);
  doc.text(BRAND.tagline, 106, 78);

  doc.setTextColor(20, 24, 40);
  let y = 130;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`${options.person}  ·  ${options.personId}`, 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Report period: ${options.rangeLabel}`, 40, y);
  y += 14;
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, 40, y);

  const total = (key: (typeof REPORT_COLUMNS)[number]["key"]) =>
    options.rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);

  y += 30;
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 40, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  const summary: [string, string][] = [
    ["Days in report", String(options.rows.length)],
    ...REPORT_COLUMNS.map(
      (column) => [`Total ${column.label}`, String(total(column.key))] as [string, string],
    ),
  ];
  for (const [label, value] of summary) {
    doc.setDrawColor(226, 232, 240);
    doc.line(40, y + 4, width - 40, y + 4);
    doc.text(label, 44, y);
    doc.text(value, width - 44, y, { align: "right" });
    y += 20;
  }

  // ---- Performance report (shared calculation with the dashboard) ----
  const sorted = [...options.rows].sort((a, b) => (a.date < b.date ? -1 : 1));
  const analysis =
    options.analysis ?? (options.month ? analyzeMonth(sorted, options.month) : analyzePerformance(sorted, sorted[0]?.date ?? "", sorted[sorted.length - 1]?.date ?? ""));
  y = drawPerformance(doc, analysis, options.month ? monthLabel(options.month) : options.rangeLabel, y + 20);
  doc.setFontSize(10);
  if (y > 700) {
    doc.addPage();
    y = 60;
  }

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.text("Daily report", 40, y);
  y += 16;
  doc.setFontSize(9);

  const columnX = [200, 265, 325, 390, 445, width - 44];
  const header = () => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Date", 44, y);
    REPORT_COLUMNS.forEach((column, index) => doc.text(column.label, columnX[index] ?? width - 44, y, { align: "right" }));
    y += 6;
    doc.setDrawColor(120, 130, 150);
    doc.line(40, y, width - 40, y);
    y += 16;
    doc.setFont("helvetica", "normal");
  };
  header();

  for (const row of options.rows) {
    if (y > 790) {
      doc.addPage();
      y = 60;
      header();
    }
    const status = row.status ?? (row.absent ? "absent" : "report");
    doc.text(dayLabel(row.date), 44, y);
    if (status !== "report") {
      doc.setTextColor(status === "leave" ? 37 : 205, status === "leave" ? 99 : 55, status === "leave" ? 235 : 55);
      doc.setFont("helvetica", "bold");
      doc.text(status === "leave" ? "LEAVE" : "ABSENT", width - 44, y, { align: "right" });
      doc.setTextColor(20, 24, 40);
      doc.setFont("helvetica", "normal");
    } else {
      REPORT_COLUMNS.forEach((column, index) => {
        doc.text(String(Number(row[column.key]) || 0), columnX[index]!, y, { align: "right" });
      });
    }
    y += 18;
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 128, 150);
  doc.text(`${BRAND.name} · ${BRAND.tagline}`, 40, 812);

  const slug = options.personId.replace(/[^a-z0-9]/gi, "") || "member";
  return {
    blob: doc.output("blob") as Blob,
    name: `skyline-daily-report-${slug}${options.month ? `-${options.month}` : ""}.pdf`,
  };
}

/** Download a generated report. */
export function saveReportBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
