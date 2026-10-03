import { BRAND } from "@/lib/brand";
import { analyzePerformance, TREND_METRICS, type PerformanceAnalysis } from "@/lib/performance-trend";

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

  // ---- Performance trend (shared calculation with the dashboard graph) ----
  const sorted = [...options.rows].sort((a, b) => (a.date < b.date ? -1 : 1));
  const analysis =
    options.analysis ?? analyzePerformance(sorted, sorted[0]?.date ?? "", sorted[sorted.length - 1]?.date ?? "");
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Performance trend", 40, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(analysis.headline.replace("↑", "up").replace("↓", "down").replace("→", "unchanged"), 40, y);
  y += 12;
  doc.text(
    `${analysis.trendText}  ·  Working days ${analysis.workingDays}  ·  Leave ${analysis.leaveDays}  ·  Absent ${analysis.absentDays}  ·  Report completion ${analysis.completionPercent}%  ·  Avg activity/working day ${analysis.avgPerWorkingDay}`,
    40,
    y,
    { maxWidth: width - 80 },
  );
  y += 18;
  const cx = 60, cw = width - 100, ch = 150, cy = y;
  const series = analysis.series;
  const max = Math.max(4, ...series.map((d) => d.activity));
  doc.setDrawColor(226, 232, 240);
  for (let i = 0; i <= 4; i += 1) {
    const gy = cy + (ch * i) / 4;
    doc.line(cx, gy, cx + cw, gy);
    doc.setTextColor(120, 128, 150);
    doc.setFontSize(7);
    doc.text(String(Math.round(max * (1 - i / 4))), cx - 6, gy + 2, { align: "right" });
  }
  const px = (i: number) => cx + (series.length <= 1 ? cw / 2 : (i * cw) / (series.length - 1));
  const py = (v: number) => cy + ch - (v / max) * ch;
  const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] as const;
  // Leave / absent markers
  series.forEach((d, i) => {
    if (d.status === "report") return;
    if (d.status === "leave") doc.setFillColor(37, 99, 235);
    else doc.setFillColor(205, 55, 55);
    doc.rect(px(i) - 1.5, cy + ch + 3, 3, 5, "F");
  });
  const lines: { key: "activity" | (typeof TREND_METRICS)[number]["key"]; color: string; w: number }[] = [
    { key: "activity", color: "#0B1E4A", w: 2 },
    ...TREND_METRICS.slice(0, 3).map((m) => ({ key: m.key, color: m.color, w: 1.1 })),
  ];
  for (const l of lines) {
    const [r, g, b] = hex(l.color);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(l.w);
    for (let i = 1; i < series.length; i += 1) {
      const a = series[i - 1]!, c = series[i]!;
      doc.line(px(i - 1), py(Number(a[l.key]) || 0), px(i), py(Number(c[l.key]) || 0));
    }
  }
  doc.setLineWidth(0.5);
  for (const e of analysis.events) {
    const i = series.findIndex((d) => d.date === e.date);
    if (i < 0) continue;
    if (e.kind === "drop") doc.setDrawColor(205, 55, 55);
    else doc.setDrawColor(33, 160, 90);
    doc.line(px(i), cy, px(i), cy + ch);
  }
  doc.setTextColor(120, 128, 150);
  doc.setFontSize(7);
  if (series[0]) doc.text(dayLabel(series[0].date), cx, cy + ch + 16);
  if (series.length > 1) doc.text(dayLabel(series[series.length - 1]!.date), cx + cw, cy + ch + 16, { align: "right" });
  // Legend
  let lx = cx;
  const ly = cy + ch + 28;
  for (const l of [{ label: "Total activity", color: "#0B1E4A" }, ...TREND_METRICS.slice(0, 3)]) {
    const [r, g, b] = hex(l.color);
    doc.setFillColor(r, g, b);
    doc.rect(lx, ly - 5, 8, 4, "F");
    doc.setTextColor(60, 66, 85);
    doc.text(l.label, lx + 11, ly - 1);
    lx += 80;
  }
  doc.setFillColor(37, 99, 235); doc.rect(lx, ly - 5, 3, 5, "F"); doc.text("Leave", lx + 6, ly - 1); lx += 40;
  doc.setFillColor(205, 55, 55); doc.rect(lx, ly - 5, 3, 5, "F"); doc.text("Absent", lx + 6, ly - 1);
  y = ly + 18;
  doc.setTextColor(20, 24, 40);
  doc.setFontSize(9);
  if (analysis.previous) {
    doc.setFont("helvetica", "bold");
    doc.text(`Compared with previous period (${dayLabel(analysis.previous.start)} — ${dayLabel(analysis.previous.end)})`, 40, y);
    doc.setFont("helvetica", "normal");
    y += 13;
    for (const c of analysis.previous.changes) {
      doc.text(`${c.label}: ${c.current} vs ${c.previous}`, 44, y);
      doc.text(c.text, width - 44, y, { align: "right" });
      y += 12;
    }
  }
  if (analysis.events.length) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Change indicators", 40, y);
    doc.setFont("helvetica", "normal");
    y += 13;
    for (const e of analysis.events.slice(0, 6)) {
      doc.text(`• ${e.text}`, 44, y);
      y += 12;
    }
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
