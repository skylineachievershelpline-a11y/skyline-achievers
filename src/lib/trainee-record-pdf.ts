import { BRAND } from "@/lib/brand";
import { formatDateTime12 } from "@/lib/format";

type Session = {
  sessionNumber: number;
  title?: string;
  review?: string;
  score?: number | null;
  scheduledAt?: string | null;
  reviewSubmittedAt?: string | null;
  reviewBody?: string | null;
  reviewVoiceUrl?: string | null;
  reviewImageUrls?: string[] | null;
};

/** Branded Skyline Achievers PDF of one trainee's full training journey. */
export async function downloadTraineeRecordPdf(input: {
  traineeName: string;
  code?: string | null;
  stage?: string | null;
  performance: { label: string; detail: string };
  totalScore: number;
  sessions: Session[];
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const header = () => {
    doc.setFillColor(8, 14, 36);
    doc.rect(0, 0, w, 70, "F");
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 70, w, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(BRAND.name, 40, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Trainee Journey Record", 40, 52);
    doc.text(new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" }), w - 40, 52, { align: "right" });
  };
  header();
  let y = 100;
  const ensure = (need: number) => {
    if (y + need > h - 40) { doc.addPage(); header(); y = 100; }
  };
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(input.traineeName, 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`ID: ${input.code ?? "—"}   Stage: ${(input.stage ?? "—").replace(/_/g, " ")}`, 40, y);
  y += 16;
  doc.text(`Total score: ${input.totalScore}   Performance: ${input.performance.label}`, 40, y);
  y += 24;

  for (const s of input.sessions) {
    const body = s.reviewBody ? doc.splitTextToSize(`Review: ${s.reviewBody}`, w - 100) as string[] : [];
    ensure(70 + body.length * 12);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(40, y, w - 80, 56 + body.length * 12, 6, 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Session ${String(s.sessionNumber).padStart(2, "0")} · ${s.title ?? ""}`, 50, y + 18);
    doc.text(`${s.review ?? "—"}${s.score != null ? ` · ${s.score} marks` : ""}`, w - 50, y + 18, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Scheduled: ${s.scheduledAt ? formatDateTime12(s.scheduledAt) : "—"}   Review sent: ${s.reviewSubmittedAt ? formatDateTime12(s.reviewSubmittedAt) : "—"}`,
      50, y + 34,
    );
    const proofs = [
      s.reviewVoiceUrl ? "Voice note" : null,
      s.reviewImageUrls?.length ? `${s.reviewImageUrls.length} photo(s)` : null,
      s.reviewBody ? "Text" : null,
    ].filter(Boolean).join(", ");
    doc.text(`Proof attached: ${proofs || "none"}`, 50, y + 46);
    body.forEach((line, i) => doc.text(line, 50, y + 60 + i * 12));
    y += 66 + body.length * 12;
  }
  doc.save(`${input.traineeName.replace(/\s+/g, "-")}-record.pdf`);
}
