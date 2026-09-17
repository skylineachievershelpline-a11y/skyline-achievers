import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  CheckCircle2,
  Coins,
  Download,
  Loader2,
  Plus,
  Share2,
  TrendingUp,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BRAND } from "@/lib/brand";
import { addDailyLeads, getEarnings, markTodayAbsent, type EarningsDay } from "@/lib/earnings.functions";

const money = (value: number) => `PKR ${value.toLocaleString("en-PK")}`;
const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

/** Report ranges offered before download / share. */
const RANGES = [
  { id: "today", label: "Only today" },
  { id: "7", label: "Last 7 days" },
  { id: "15", label: "Last 15 days" },
  { id: "30", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All saved days" },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

export function EarningsPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(getEarnings);
  const addLeads = useServerFn(addDailyLeads);
  const markAbsent = useServerFn(markTodayAbsent);

  const [leads, setLeads] = useState("");
  const [reason, setReason] = useState("");
  const [absentOpen, setAbsentOpen] = useState(false);
  const [range, setRange] = useState<RangeId>("month");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  const { data, isPending } = useQuery({ queryKey: ["earnings"], queryFn: () => load() });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["earnings"] });

  const submit = useMutation({
    mutationFn: () => addLeads({ data: { leads: Number(leads || 0) } } as never),
    onSuccess: () => {
      toast.success("Leads saved");
      setLeads("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const absent = useMutation({
    mutationFn: () => markAbsent({ data: { reason } } as never),
    onSuccess: () => {
      toast.success("Today marked absent with your application");
      setReason("");
      setAbsentOpen(false);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /** Days that belong to the selected report range. */
  function rangeDays(): { days: EarningsDay[]; label: string } {
    if (!data) return { days: [], label: "" };
    const today = data.today.date;
    const option = RANGES.find((item) => item.id === range)!;
    if (range === "today") {
      return { days: data.days.filter((day) => day.date === today), label: option.label };
    }
    if (range === "month") {
      const start = `${today.slice(0, 7)}-01`;
      return { days: data.days.filter((day) => day.date >= start), label: data.month.label };
    }
    if (range === "all") return { days: data.days, label: option.label };
    const count = Number(range);
    const start = new Date(new Date(`${today}T00:00:00Z`).getTime() - (count - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { days: data.days.filter((day) => day.date >= start), label: option.label };
  }

  async function buildPdf() {
    if (!data) return null;
    const { days: rows, label: rangeLabel } = rangeDays();
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const width = doc.internal.pageSize.getWidth();

    // Branded header band.
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
    doc.text("Earnings & Investment Report", 106, 64);
    doc.text(BRAND.tagline, 106, 78);

    let y = 130;
    doc.setTextColor(20, 24, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${data.member.fullName}  ·  ${data.member.memberId}`, 40, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Report range: ${rangeLabel}`, 40, y);
    y += 14;
    doc.text(
      `Generated ${new Date().toLocaleString("en-GB")}  ·  1 lead = PKR ${data.rates.lead}  ·  1 joining = PKR ${data.rates.join}`,
      40,
      y,
    );

    const total = (key: keyof EarningsDay) =>
      rows.reduce((sum, day) => sum + (Number(day[key]) || 0), 0);

    y += 30;
    const summary: [string, string][] = [
      ["Days in report", String(rows.length)],
      ["Leads", String(total("leads"))],
      ["Investment", money(total("investment"))],
      ["Joinings", String(total("joins"))],
      ["Earning", money(total("earning"))],
      ["Absent days", String(rows.filter((day) => day.absent).length)],
    ];
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 40, y);
    y += 14;
    doc.setFont("helvetica", "normal");
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
    doc.text("Date", 44, y);
    doc.text("Leads", 210, y, { align: "right" });
    doc.text("Investment", 320, y, { align: "right" });
    doc.text("Joinings", 420, y, { align: "right" });
    doc.text("Earning", width - 44, y, { align: "right" });
    y += 6;
    doc.setDrawColor(120, 130, 150);
    doc.line(40, y, width - 40, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    for (const day of rows) {
      if (y > 780) {
        doc.addPage();
        y = 60;
      }
      doc.text(dayLabel(day.date), 44, y);
      doc.text(day.absent ? "Absent" : String(day.leads), 210, y, { align: "right" });
      doc.text(money(day.investment), 320, y, { align: "right" });
      doc.text(String(day.joins), 420, y, { align: "right" });
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

    doc.setFontSize(8);
    doc.setTextColor(120, 128, 150);
    doc.text(`${BRAND.name} · ${BRAND.tagline}`, 40, 812);

    const blob = doc.output("blob") as Blob;
    const name = `skyline-earnings-${range}-${data.today.date}.pdf`;
    return { blob, name };
  }

  function saveBlob(blob: Blob, name: string) {
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

  async function downloadPdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const file = await buildPdf();
      if (!file) return;
      saveBlob(file.blob, file.name);
      toast.success("Report downloaded");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPdfBusy(false);
    }
  }

  async function sharePdf() {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      const built = await buildPdf();
      if (!built) return;
      const file = new File([built.blob], built.name, { type: "application/pdf" });
      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));

      if (canShareFiles) {
        try {
          await navigator.share({ files: [file], title: `${BRAND.name} report` });
          return;
        } catch (error) {
          const name = (error as Error)?.name;
          if (name === "AbortError") return;
          // Sharing blocked (e.g. inside an embedded preview) — open the report instead.
        }
      }

      // Open the report so it can be shared from the phone's PDF viewer.
      const url = URL.createObjectURL(built.blob);
      const opened = window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (opened) {
        toast.success("Report opened — use the share button in your PDF viewer");
        return;
      }

      saveBlob(built.blob, built.name);
      toast.success("Report downloaded — open your Downloads to share it");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setShareBusy(false);
    }
  }

  if (isPending) {
    return (
      <div className="raised-panel metal-edge flex h-40 items-center justify-center rounded-3xl">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }
  if (!data) return null;

  const savedToday = data.today.saved && data.today.leads > 0;
  const absentToday = data.today.absent;

  return (
    <section className="raised-panel metal-edge rounded-3xl p-5 animate-rise-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Earnings &amp; investment
          </p>
          <h2 className="mt-1 font-display text-xl font-bold">Daily tracking</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            1 lead = PKR {data.rates.lead} investment · 1 joining = PKR {data.rates.join} earning ·
            day closes at 12:00 midnight
          </p>
        </div>
      </div>

      {/* Today's tracking: saved leads stay locked, more can only be added. */}
      <div className="mt-5 inset-panel rounded-2xl p-4">
        {absentToday ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <UserX className="h-4 w-4 text-primary" /> Today is marked absent
            </p>
            <p className="text-xs text-muted-foreground">{data.today.absentReason}</p>
          </div>
        ) : (
          <>
            {savedToday ? (
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-cyan" />
                Saved today: <span className="tabular-nums text-cyan">{data.today.leads}</span> leads
                <span className="text-xs font-normal text-muted-foreground">
                  ({money(data.today.investment)} investment · locked)
                </span>
              </p>
            ) : (
              <p className="text-sm font-semibold">No leads saved for today yet</p>
            )}

            <form
              className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                if (Number(leads || 0) < 1) {
                  toast.error("Enter at least 1 lead");
                  return;
                }
                submit.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="leads-today">
                  {savedToday ? "Add more leads" : "How many leads did you get today?"}
                </Label>
                <Input
                  id="leads-today"
                  type="number"
                  min={1}
                  max={1000}
                  inputMode="numeric"
                  placeholder="0"
                  value={leads}
                  onChange={(event) => setLeads(event.target.value)}
                />
              </div>
              <Button type="submit" variant="brand" className="rounded-2xl" disabled={submit.isPending}>
                {submit.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {savedToday ? "Add more leads" : "Save leads"}
              </Button>
            </form>

            {!savedToday && (
              <Button
                variant="outline"
                className="mt-3 rounded-2xl"
                onClick={() => setAbsentOpen(true)}
              >
                <UserX className="h-4 w-4" /> Mark today absent
              </Button>
            )}
          </>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<Users />} label="Today's leads" value={absentToday ? "Absent" : String(data.today.leads)} note={`${money(data.today.investment)} investment`} />
        <Tile icon={<Coins />} label="Today's earning" value={money(data.today.earning)} note={`${data.today.joins} joining${data.today.joins === 1 ? "" : "s"}`} />
        <Tile icon={<Wallet />} label={`${data.month.label} investment`} value={money(data.month.investment)} note={`${data.month.leads} leads`} />
        <Tile icon={<TrendingUp />} label={`${data.month.label} earning`} value={money(data.month.earning)} note={`${data.month.joins} joinings`} />
      </div>

      {/* Report download with range choice. */}
      <div className="mt-5 inset-panel rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Download report
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="report-range">Choose report period</Label>
            <select
              id="report-range"
              className="h-11 w-full rounded-xl border border-metal/25 bg-input px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={range}
              onChange={(event) => setRange(event.target.value as RangeId)}
            >
              {RANGES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            className="rounded-2xl"
            disabled={pdfBusy}
            onClick={() => void downloadPdf()}
          >
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
          <Button
            variant="brand"
            className="rounded-2xl"
            disabled={shareBusy}
            onClick={() => void sharePdf()}
          >
            {shareBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Share report
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 text-primary" /> Closed day reports
        </p>
        {data.days.length === 0 ? (
          <p className="inset-panel rounded-xl p-4 text-sm text-muted-foreground">
            Save today's leads and your daily report history starts building here.
          </p>
        ) : (
          <div className="inset-panel overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Leads</th>
                  <th className="p-3 text-right">Investment</th>
                  <th className="p-3 text-right">Joinings</th>
                  <th className="p-3 text-right">Earning</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((day) => (
                  <tr key={day.date} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-semibold">
                      {dayLabel(day.date)}
                      {day.absent && day.absentReason ? (
                        <span className="mt-1 block max-w-[220px] text-[10px] font-normal text-muted-foreground">
                          Absent: {day.absentReason}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {day.absent ? "Absent" : day.leads}
                    </td>
                    <td className="p-3 text-right tabular-nums text-muted-foreground">
                      {money(day.investment)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{day.joins}</td>
                    <td className="p-3 text-right font-semibold tabular-nums text-cyan">
                      {money(day.earning)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={absentOpen} onOpenChange={setAbsentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark today absent</DialogTitle>
            <DialogDescription>
              Write a proper application explaining why you could not work today. It is saved with
              your report so zero leads do not count against you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="absent-reason">Application</Label>
            <Textarea
              id="absent-reason"
              rows={6}
              placeholder="Respected sir, today I could not work because…"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">{reason.trim().length}/30 minimum</p>
          </div>
          <Button
            variant="brand"
            className="rounded-2xl"
            disabled={absent.isPending || reason.trim().length < 30}
            onClick={() => absent.mutate()}
          >
            {absent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
            Submit application
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Tile({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="inset-panel rounded-2xl p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-metal/20 bg-primary/15 text-brand-glow [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <p className="mt-3 font-display text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}
