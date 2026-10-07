import { BRAND } from "@/lib/brand";
import { formatDateTime } from "@/lib/format";

type Interview = { name: string; code: string; stage: string; scheduledAt: string | null; marks: number | null; maxMarks: number; senior: { name: string; memberId: string } | null; upline: string | null };

/** Branded CEO PDF: AI operational summary, key numbers and every Final Interview. */
export async function downloadCeoReportPdf(report: { stats: Record<string, number>; summary: string } | null, interviews: Interview[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const header = () => {
    doc.setFillColor(8, 14, 36); doc.rect(0, 0, w, 70, "F");
    doc.setFillColor(37, 99, 235); doc.rect(0, 70, w, 3, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text(BRAND.name, 40, 34);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(report ? "CEO Report · A.Q Malik" : "Final Interview Report", 40, 52);
    doc.text(new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi" }) + " PKT", w - 40, 52, { align: "right" });
    doc.setTextColor(15, 23, 42);
  };
  header();
  let y = 100;
  const ensure = (n: number) => { if (y + n > h - 40) { doc.addPage(); header(); y = 100; } };
  if (report) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("Key numbers", 40, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    for (const [k, v] of Object.entries(report.stats)) {
      doc.text(`${k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}: ${v}`, 50, y); y += 14;
    }
    y += 10; doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("AI summary", 40, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    for (const line of doc.splitTextToSize(report.summary.replace(/[*#]/g, ""), w - 90) as string[]) { ensure(14); doc.text(line, 50, y); y += 13; }
    y += 16;
  }
  ensure(40);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(`Final Interviews (${interviews.length})`, 40, y); y += 18;
  doc.setFontSize(10);
  for (const i of interviews) {
    ensure(48);
    doc.setDrawColor(203, 213, 225); doc.roundedRect(40, y, w - 80, 42, 5, 5);
    doc.setFont("helvetica", "bold"); doc.text(`${i.name} ${i.code ? `(${i.code})` : ""}`, 50, y + 15);
    doc.text(i.marks != null ? `${i.marks}/${i.maxMarks}` : i.stage.replace(/_/g, " "), w - 50, y + 15, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Time: ${i.scheduledAt ? formatDateTime(i.scheduledAt) : "—"}   Senior: ${i.senior ? `${i.senior.name} (${i.senior.memberId})` : "not assigned"}   Upline: ${i.upline ?? "—"}`, 50, y + 31);
    doc.setFontSize(10);
    y += 50;
  }
  doc.save(report ? "skyline-ceo-report.pdf" : "skyline-final-interviews.pdf");
}
