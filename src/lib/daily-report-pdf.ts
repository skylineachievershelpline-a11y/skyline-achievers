import { BRAND } from "@/lib/brand";

export type DailyReportRow = {
  date: string;
  leads: number;
  responses: number;
  enrollments: number;
  pending: number;
  twoCc: number;
  mentorshipPaid: number;
  absent?: boolean;
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
    doc.text(dayLabel(row.date), 44, y);
    REPORT_COLUMNS.forEach((column, index) => {
      doc.text(String(Number(row[column.key]) || 0), columnX[index]!, y, { align: "right" });
    });
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
