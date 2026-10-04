import { BRAND } from "@/lib/brand";
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

/** Branded daily-report PDF for any custom range of days. */
export async function buildDailyReportPdf(options: {
  title: string;
  person: string;
  personId: string;
  rangeLabel: string;
  rows: DailyReportRow[];
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
    options.analysis ?? analyzePerformance(sorted, sorted[0]?.date ?? "", sorted[sorted.length - 1]?.date ?? "");
  const series = analysis.series;
  const ensure = (need: number) => {
    if (y + need > 790) {
      doc.addPage();
      y = 60;
    }
  };
  y += 14;
  ensure(120);
  doc.setTextColor(20, 24, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Performance report", 40, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${dayLabel(analysis.start)} — ${dayLabel(analysis.end)}`, 40, y);
  y += 16;
  // Insight
  doc.setFillColor(232, 242, 255);
  doc.rect(40, y - 10, width - 80, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.text(performanceInsight(analysis), 46, y + 3, { maxWidth: width - 92 });
  y += 26;
  // Summary cards
  const cards: [string, string][] = [
    ["Working Days", `${analysis.workingDays} / ${series.length}`],
    ["Total Activities", String(analysis.totals.activity)],
    ["Leads", String(analysis.totals.leads)],
    ["Responses", String(analysis.totals.responses)],
    ["Enrollments", String(analysis.totals.enrollments)],
  ];
  const cw = (width - 80 - 4 * 6) / 5;
  cards.forEach(([l, v], i) => {
    const cx = 40 + i * (cw + 6);
    doc.setDrawColor(210, 220, 235);
    doc.rect(cx, y, cw, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(v, cx + cw / 2, y + 18, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(l.toUpperCase(), cx + cw / 2, y + 32, { align: "center" });
  });
  y += 56;
  // Daily working bars
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Daily working", 40, y);
  y += 12;
  const max = Math.max(1, ...series.map((d) => d.activity));
  const barW = width - 80 - 60 - 30;
  doc.setFontSize(8);
  for (const d of series) {
    ensure(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 96, 115);
    doc.text(dayLabel(d.date), 40, y);
    doc.setFillColor(236, 240, 246);
    doc.rect(100, y - 7, barW, 8, "F");
    if (d.activity > 0) {
      doc.setFillColor(0, 120, 230);
      doc.rect(100, y - 7, Math.max(3, (d.activity / max) * barW), 8, "F");
    }
    doc.setTextColor(20, 24, 40);
    doc.setFont("helvetica", "bold");
    doc.text(String(d.activity), width - 40, y, { align: "right" });
    y += 11;
  }
  // Comparison
  const compare = simpleComparison(analysis);
  if (compare.length) {
    y += 10;
    ensure(90);
    doc.setFontSize(10);
    doc.text("Period comparison", 40, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const main = compare[0]!;
    doc.text(`Previous Period: ${main.previous} Activities`, 44, y);
    y += 12;
    doc.text(`Current Period: ${main.current} Activities`, 44, y);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text(`Activity: ${main.text}`, 44, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    for (const c of compare.slice(1)) {
      doc.text(`${c.label}: ${c.previous} -> ${c.current}`, 44, y);
      doc.text(c.text, width - 44, y, { align: "right" });
      y += 12;
    }
  }
  if (analysis.leaveDays || analysis.absentDays) {
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(90, 96, 115);
    doc.text(`Leave: ${analysis.leaveDays} days  ·  Absent: ${analysis.absentDays} days`, 44, y);
    y += 12;
    doc.setTextColor(20, 24, 40);
  }
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
  doc.text("Date", 44, y);
  REPORT_COLUMNS.forEach((column, index) => {
    doc.text(column.label, columnX[index]!, y, { align: "right" });
  });
  y += 6;
  doc.setDrawColor(120, 130, 150);
  doc.line(40, y, width - 40, y);
  y += 16;
  doc.setFont("helvetica", "normal");

  for (const row of options.rows) {
    if (y > 790) {
      doc.addPage();
      y = 60;
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
    name: `skyline-daily-report-${slug}.pdf`,
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
