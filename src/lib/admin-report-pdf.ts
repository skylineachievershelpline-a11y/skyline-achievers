import { BRAND } from "@/lib/brand";

const money = (value: number) => `PKR ${Math.round(value).toLocaleString("en-PK")}`;
const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

type Doc = Awaited<ReturnType<typeof newDoc>>["doc"];

/** Branded A4 document with the Skyline header band. */
async function newDoc(title: string, subtitle: string) {
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
    /* logo is optional */
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(BRAND.name, 106, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(title, 106, 64);
  doc.text(subtitle, 106, 78);

  doc.setTextColor(20, 24, 40);
  return { doc, width };
}

function footer(doc: Doc) {
  doc.setFontSize(8);
  doc.setTextColor(120, 128, 150);
  doc.text(`${BRAND.name} · ${BRAND.tagline}`, 40, 812);
  doc.setTextColor(20, 24, 40);
}

export type AdminTeamReport = {
  month: string;
  all: boolean;
  rates: { lead: number; join: number };
  totals: { leads: number; investment: number; joins: number; earning: number };
  members: {
    memberId: string;
    fullName: string;
    level: string | null;
    status: string;
    leads: number;
    investment: number;
    joins: number;
    earning: number;
  }[];
};

/** One PDF with every member's totals. */
export async function buildTeamReportPdf(data: AdminTeamReport, rangeLabel: string) {
  const { doc, width } = await newDoc("All members report", rangeLabel);
  let y = 130;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Summary", 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summary: [string, string][] = [
    ["Members", String(data.members.length)],
    ["Total leads", String(data.totals.leads)],
    ["Total investment", money(data.totals.investment)],
    ["Total joinings", String(data.totals.joins)],
    ["Total earning", money(data.totals.earning)],
    ["Rates", `1 lead = PKR ${data.rates.lead} · 1 joining = PKR ${data.rates.join}`],
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
  doc.text("Members", 40, y);
  y += 16;
  doc.setFontSize(9);
  doc.text("Member", 44, y);
  doc.text("Leads", 300, y, { align: "right" });
  doc.text("Investment", 400, y, { align: "right" });
  doc.text("Joins", 450, y, { align: "right" });
  doc.text("Earning", width - 44, y, { align: "right" });
  y += 6;
  doc.setDrawColor(120, 130, 150);
  doc.line(40, y, width - 40, y);
  y += 16;
  doc.setFont("helvetica", "normal");

  for (const row of data.members) {
    if (y > 780) {
      doc.addPage();
      y = 60;
    }
    doc.text(`${row.fullName} (${row.memberId})`, 44, y);
    doc.text(String(row.leads), 300, y, { align: "right" });
    doc.text(money(row.investment), 400, y, { align: "right" });
    doc.text(String(row.joins), 450, y, { align: "right" });
    doc.text(money(row.earning), width - 44, y, { align: "right" });
    y += 12;
    doc.setTextColor(120, 128, 150);
    doc.setFontSize(8);
    doc.text(`${row.level ?? "—"} · ${row.status}`, 48, y);
    doc.setFontSize(9);
    doc.setTextColor(20, 24, 40);
    y += 14;
  }

  footer(doc);
  return {
    blob: doc.output("blob") as Blob,
    name: `skyline-all-members-${data.all ? "complete" : data.month}.pdf`,
  };
}

export type AdminMemberReport = {
  month: string;
  all: boolean;
  rates: { lead: number; join: number };
  member: { fullName: string; memberId: string } | null;
  days: {
    date: string;
    leads: number;
    investment: number;
    joins: number;
    earning: number;
    absent: boolean;
    absentReason: string | null;
  }[];
};

/** Full day-by-day PDF for one member. */
export async function buildMemberReportPdf(data: AdminMemberReport, rangeLabel: string) {
  const { doc, width } = await newDoc("Member report", rangeLabel);
  let y = 130;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`${data.member?.fullName ?? "Member"}  ·  ${data.member?.memberId ?? ""}`, 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `1 lead = PKR ${data.rates.lead}  ·  1 joining = PKR ${data.rates.join}  ·  generated ${new Date().toLocaleString("en-GB")}`,
    40,
    y,
  );

  const total = (key: "leads" | "investment" | "joins" | "earning") =>
    data.days.reduce((sum, day) => sum + (Number(day[key]) || 0), 0);

  y += 30;
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 40, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  const summary: [string, string][] = [
    ["Days recorded", String(data.days.length)],
    ["Leads", String(total("leads"))],
    ["Investment", money(total("investment"))],
    ["Joinings", String(total("joins"))],
    ["Earning", money(total("earning"))],
    ["Absent days", String(data.days.filter((day) => day.absent).length)],
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
  doc.text("Daily record", 40, y);
  y += 16;
  doc.setFontSize(9);
  doc.text("Date", 44, y);
  doc.text("Leads", 250, y, { align: "right" });
  doc.text("Investment", 350, y, { align: "right" });
  doc.text("Joinings", 430, y, { align: "right" });
  doc.text("Earning", width - 44, y, { align: "right" });
  y += 6;
  doc.setDrawColor(120, 130, 150);
  doc.line(40, y, width - 40, y);
  y += 16;
  doc.setFont("helvetica", "normal");

  for (const day of data.days) {
    if (y > 780) {
      doc.addPage();
      y = 60;
    }
    doc.text(dayLabel(day.date), 44, y);
    doc.text(day.absent ? "Absent" : String(day.leads), 250, y, { align: "right" });
    doc.text(money(day.investment), 350, y, { align: "right" });
    doc.text(String(day.joins), 430, y, { align: "right" });
    doc.text(money(day.earning), width - 44, y, { align: "right" });
    y += 18;
    if (day.absent && day.absentReason) {
      if (y > 780) {
        doc.addPage();
        y = 60;
      }
      doc.setTextColor(120, 128, 150);
      const lines = doc.splitTextToSize(`Reason: ${day.absentReason}`, width - 100) as string[];
      doc.text(lines, 54, y);
      y += lines.length * 12 + 6;
      doc.setTextColor(20, 24, 40);
    }
  }

  footer(doc);
  const slug = (data.member?.memberId ?? "member").replace(/[^a-z0-9]/gi, "");
  return {
    blob: doc.output("blob") as Blob,
    name: `skyline-report-${slug}-${data.all ? "complete" : data.month}.pdf`,
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
