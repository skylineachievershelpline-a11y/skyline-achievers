import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Coins,
  Download,
  Loader2,
  Save,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";
import { getEarnings, saveDailyLeads } from "@/lib/earnings.functions";

const money = (value: number) => `PKR ${value.toLocaleString("en-PK")}`;
const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

export function EarningsPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(getEarnings);
  const save = useServerFn(saveDailyLeads);
  const [leads, setLeads] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  const { data, isPending } = useQuery({ queryKey: ["earnings"], queryFn: () => load() });

  useEffect(() => {
    if (data?.today) setLeads(String(data.today.leads ?? 0));
  }, [data?.today?.date, data?.today?.leads]);

  const submit = useMutation({
    mutationFn: () => save({ data: { leads: Number(leads || 0) } } as never),
    onSuccess: () => {
      toast.success("Today's tracking saved");
      void queryClient.invalidateQueries({ queryKey: ["earnings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function downloadPdf() {
    if (!data) return;
    setPdfBusy(true);
    try {
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
      doc.text(
        `Generated ${new Date().toLocaleString("en-GB")}  ·  1 lead = PKR ${data.rates.lead}  ·  1 joining = PKR ${data.rates.join}`,
        40,
        y,
      );

      y += 30;
      const rows: [string, string][] = [
        ["Today's leads", String(data.today.leads)],
        ["Today's investment", money(data.today.investment)],
        ["Today's joinings", String(data.today.joins)],
        ["Today's earning", money(data.today.earning)],
        [`${data.month.label} leads`, String(data.month.leads)],
        [`${data.month.label} investment`, money(data.month.investment)],
        [`${data.month.label} joinings`, String(data.month.joins)],
        [`${data.month.label} earning`, money(data.month.earning)],
      ];
      doc.setFont("helvetica", "bold");
      doc.text("Summary", 40, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      for (const [label, value] of rows) {
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
      for (const day of data.days) {
        if (y > 780) {
          doc.addPage();
          y = 60;
        }
        doc.text(dayLabel(day.date), 44, y);
        doc.text(String(day.leads), 210, y, { align: "right" });
        doc.text(money(day.investment), 320, y, { align: "right" });
        doc.text(String(day.joins), 420, y, { align: "right" });
        doc.text(money(day.earning), width - 44, y, { align: "right" });
        y += 18;
      }

      doc.setFontSize(8);
      doc.setTextColor(120, 128, 150);
      doc.text(`${BRAND.name} · ${BRAND.tagline}`, 40, 812);
      doc.save(`skyline-earnings-${data.today.date}.pdf`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPdfBusy(false);
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
        <Button
          variant="outline"
          className="rounded-2xl"
          disabled={pdfBusy}
          onClick={() => void downloadPdf()}
        >
          {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download PDF report
        </Button>
      </div>

      <form
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="leads-today">How many leads did you get today?</Label>
          <Input
            id="leads-today"
            type="number"
            min={0}
            max={1000}
            inputMode="numeric"
            value={leads}
            onChange={(event) => setLeads(event.target.value)}
          />
        </div>
        <Button type="submit" variant="brand" className="rounded-2xl" disabled={submit.isPending}>
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save today
        </Button>
      </form>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<Users />} label="Today's leads" value={String(data.today.leads)} note={`${money(data.today.investment)} investment`} />
        <Tile icon={<Coins />} label="Today's earning" value={money(data.today.earning)} note={`${data.today.joins} joining${data.today.joins === 1 ? "" : "s"}`} />
        <Tile icon={<Wallet />} label={`${data.month.label} investment`} value={money(data.month.investment)} note={`${data.month.leads} leads`} />
        <Tile icon={<TrendingUp />} label={`${data.month.label} earning`} value={money(data.month.earning)} note={`${data.month.joins} joinings`} />
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
                    <td className="p-3 font-semibold">{dayLabel(day.date)}</td>
                    <td className="p-3 text-right tabular-nums">{day.leads}</td>
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
