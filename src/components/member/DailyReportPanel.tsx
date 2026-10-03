import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Lock,
  PenLine,
  Send,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";
import {
  getDailyReport,
  submitDailyReport,
  type ReportDay,
} from "@/lib/daily-report.functions";
import { buildDailyReportPdf, saveReportBlob } from "@/lib/daily-report-pdf";
import { analyzePerformance, TREND_METRICS, type PerformanceAnalysis } from "@/lib/performance-trend";

const FIELDS = [
  { key: "leads", label: "Today total leads", hint: "How many leads did you work on?" },
  { key: "responses", label: "Response", hint: "Leads that responded" },
  { key: "enrollments", label: "Enrollments", hint: "Enrollments completed" },
  { key: "pending", label: "Pending", hint: "Still pending" },
  { key: "twoCc", label: "2CC done", hint: "People who did 2CC" },
  { key: "mentorshipPaid", label: "Personal Mentorship fee paid", hint: "People who paid the fee" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

const LINES = [
  { key: "leads", label: "Leads", color: "#2E8BFF" },
  { key: "responses", label: "Response", color: "#21D07A" },
  { key: "enrollments", label: "Enrollments", color: "#FF4D5E" },
] as const;

const dayShort = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

const shiftDay = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

export function DailyReportPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(getDailyReport);
  const send = useServerFn(submitDailyReport);

  const { data, isPending } = useQuery({ queryKey: ["daily-report"], queryFn: () => load() });

  const [values, setValues] = useState<Record<FieldKey, string>>({
    leads: "",
    responses: "",
    enrollments: "",
    pending: "",
    twoCc: "",
    mentorshipPaid: "",
  });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  // A report already sent today can still be corrected until midnight, so the
  // form reopens with exactly the numbers that were submitted.
  const todayRow = data?.today;
  useEffect(() => {
    if (!todayRow || seededFor === todayRow.date) return;
    setSeededFor(todayRow.date);
    if (!todayRow.submitted) return;
    setValues({
      leads: String(todayRow.leads ?? 0),
      responses: String(todayRow.responses ?? 0),
      enrollments: String(todayRow.enrollments ?? 0),
      pending: String(todayRow.pending ?? 0),
      twoCc: String(todayRow.twoCc ?? 0),
      mentorshipPaid: String(todayRow.mentorshipPaid ?? 0),
    });
  }, [todayRow, seededFor]);

  // If the 8 PM window closes while the form is open, collapse it again.
  const formVisible = formOpen && data?.windowOpen !== false;

  const submit = useMutation({
    mutationFn: () =>
      send({
        data: {
          leads: Number(values.leads || 0),
          responses: Number(values.responses || 0),
          enrollments: Number(values.enrollments || 0),
          pending: Number(values.pending || 0),
          twoCc: Number(values.twoCc || 0),
          mentorshipPaid: Number(values.mentorshipPaid || 0),
        },
      } as never),
    onSuccess: () => {
      toast.success("Today's report submitted");
      void queryClient.invalidateQueries({ queryKey: ["daily-report"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const today = data?.today.date ?? new Date().toISOString().slice(0, 10);
  const rangeStart = fromDate || shiftDay(today, -6);
  const rangeEnd = toDate || today;

  const rangeRows = useMemo(() => {
    const days = data?.calendar ?? [];
    return days
      .filter((day) => day.date >= rangeStart && day.date <= rangeEnd)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [data, rangeStart, rangeEnd]);

  const analysis = useMemo(
    () => analyzePerformance(data?.calendar ?? [], rangeStart, rangeEnd),
    [data, rangeStart, rangeEnd],
  );

  async function buildPdf() {
    if (!data) return null;
    return await buildDailyReportPdf({
      title: "Daily working report",
      person: data.member.fullName,
      personId: data.member.memberId,
      rangeLabel: `${dayShort(rangeStart)} — ${dayShort(rangeEnd)}`,
      rows: rangeRows,
      analysis,
    });
  }

  async function downloadPdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const file = await buildPdf();
      if (!file) return;
      saveReportBlob(file.blob, file.name);
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
          await navigator.share({ files: [file], title: `${BRAND.name} daily report` });
          return;
        } catch (error) {
          if ((error as Error)?.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(built.blob);
      const opened = window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (opened) {
        toast.success("Report opened — use the share button in your PDF viewer");
        return;
      }
      saveReportBlob(built.blob, built.name);
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
        <SkylineLoader />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <section className="raised-panel metal-edge overflow-hidden rounded-3xl p-5 animate-rise-in">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Daily report
            </p>
            <h2 className="mt-1 font-display text-xl font-bold">Today's working report</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Open from {data.openHourLabel} until 12:00 midnight. No report by midnight is marked
              absent.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.todaySubmitted ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-cyan/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-cyan">
                <CheckCircle2 className="h-4 w-4" /> Submitted for today
              </span>
            ) : null}
            {!data.windowOpen ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">
                <Lock className="h-3.5 w-3.5" /> Locked until {data.openHourLabel}
              </span>
            ) : null}
            <Button
              type="button"
              variant={data.todaySubmitted ? "outline" : "brand"}
              className="rounded-2xl"
              disabled={!data.windowOpen}
              title={
                data.windowOpen
                  ? undefined
                  : `The report unlocks at ${data.openHourLabel} Pakistan time.`
              }
              onClick={() => setFormOpen((open) => !open)}
            >
              {formOpen ? (
                <>
                  <X className="h-4 w-4" /> Close form
                </>
              ) : !data.windowOpen ? (
                <>
                  <Lock className="h-4 w-4" /> Report locked
                </>
              ) : data.todaySubmitted ? (
                <>
                  <PenLine className="h-4 w-4" /> Update today's report
                </>
              ) : (
                <>
                  <PenLine className="h-4 w-4" /> Fill today's report
                </>
              )}
            </Button>
          </div>
        </div>

        {formVisible ? (
          <form
            className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-rise-in"
            onSubmit={(event) => {
              event.preventDefault();
              if (!data.windowOpen) {
                toast.error("The daily report opens at 8:00 PM.");
                return;
              }
              submit.mutate();
            }}
          >
            {FIELDS.map((field) => (
              <div key={field.key} className="inset-panel space-y-2 rounded-2xl p-3">
                <Label htmlFor={`report-${field.key}`} className="text-xs">
                  {field.label}
                </Label>
                <Input
                  id={`report-${field.key}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder={String(data.today[field.key as keyof ReportDay] ?? 0)}
                  value={values[field.key]}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                />
                <p className="text-[10px] text-muted-foreground">{field.hint}</p>
              </div>
            ))}

            <div className="sm:col-span-2 lg:col-span-3">
              <Button
                type="submit"
                variant="brand"
                className="w-full rounded-2xl sm:w-auto"
                disabled={submit.isPending || !data.windowOpen}
              >
                {submit.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {data.todaySubmitted ? "Update today's report" : "Submit daily report"}
              </Button>
              {!data.windowOpen ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  The form unlocks at {data.openHourLabel} Pakistan time.
                </p>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>

      <div className="space-y-4 animate-rise-in">
        <PerformanceGraph
          analysis={analysis}
          today={today}
          onPreset={(days) => {
            setFromDate(shiftDay(today, -(days - 1)));
            setToDate(today);
          }}
        />

        <section className="raised-panel metal-edge rounded-3xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Report download
        </p>
        <h3 className="mt-1 font-display text-lg font-bold">Choose any days you want</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: "Today", days: 0 },
            { label: "Last 2 days", days: 1 },
            { label: "Last 3 days", days: 2 },
            { label: "Last 7 days", days: 6 },
            { label: "Last 30 days", days: 29 },
            { label: "Last 90 days", days: 89 },
          ].map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={() => {
                setFromDate(shiftDay(today, -preset.days));
                setToDate(today);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="report-from">From</Label>
            <Input
              id="report-from"
              type="date"
              value={rangeStart}
              max={today}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-to">To</Label>
            <Input
              id="report-to"
              type="date"
              value={rangeEnd}
              max={today}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="rounded-2xl"
            disabled={pdfBusy}
            onClick={() => void downloadPdf()}
          >
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF
          </Button>
          <Button
            variant="brand"
            className="rounded-2xl"
            disabled={shareBusy}
            onClick={() => void sharePdf()}
          >
            {shareBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Share
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {rangeRows.length} day{rangeRows.length === 1 ? "" : "s"} in the selected period.
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full rounded-2xl"
          onClick={() => setReportOpen((open) => !open)}
        >
          {reportOpen ? <X className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {reportOpen ? "Hide report" : "Show report"}
        </Button>

        {reportOpen && rangeRows.length > 0 ? (
          <div className="inset-panel mt-4 overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Leads</th>
                  <th className="p-3 text-right">Response</th>
                  <th className="p-3 text-right">Enroll</th>
                  <th className="p-3 text-right">Pending</th>
                  <th className="p-3 text-right">2CC</th>
                  <th className="p-3 text-right">PM fee</th>
                </tr>
              </thead>
              <tbody>
                {rangeRows.map((row) => (
                  <tr key={row.date} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-semibold">{dayShort(row.date)}</td>
                    {row.status === "report" ? (
                      <>
                        <td className="p-3 text-right tabular-nums">{row.leads}</td>
                        <td className="p-3 text-right tabular-nums">{row.responses}</td>
                        <td className="p-3 text-right tabular-nums">{row.enrollments}</td>
                        <td className="p-3 text-right tabular-nums">{row.pending}</td>
                        <td className="p-3 text-right tabular-nums">{row.twoCc}</td>
                        <td className="p-3 text-right font-semibold tabular-nums text-cyan">{row.mentorshipPaid}</td>
                      </>
                    ) : (
                      <td colSpan={6} className={`p-3 text-center font-bold uppercase ${row.status === "leave" ? "text-primary" : "text-destructive"}`}>
                        {row.status === "leave" ? "Leave" : "Absent"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        </section>
      </div>
    </div>
  );
}

/** Performance graph: same analysis as the PDF. */
function PerformanceGraph({
  analysis,
  today,
  onPreset,
}: {
  analysis: PerformanceAnalysis;
  today: string;
  onPreset: (days: number) => void;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set(["twoCc", "mentorshipPaid"]));
  const width = 560;
  const height = 210;
  const padX = 14;
  const padY = 16;
  const series = analysis.series;
  const shown = TREND_METRICS.filter((m) => !hidden.has(m.key));
  const max = Math.max(4, ...series.map((d) => d.activity));
  const stepX = (width - padX * 2) / Math.max(1, series.length - 1);
  const x = (i: number) => padX + i * stepX;
  const y = (v: number) => height - padY - (v / max) * (height - padY * 2);
  const path = (get: (d: (typeof series)[number]) => number) =>
    series.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(get(d)).toFixed(1)}`).join(" ");
  const isPreset = analysis.end === today && [7, 30, 90].includes(analysis.days) ? analysis.days : 0;
  const trendTone =
    analysis.trend === "increasing" ? "text-[#21D07A]" : analysis.trend === "decreasing" ? "text-destructive" : "text-cyan";
  const toggle = (k: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <section className="raised-panel metal-edge rounded-3xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Performance graph</p>
      <h3 className="mt-1 font-display text-lg font-bold">
        {dayShort(analysis.start)} — {dayShort(analysis.end)}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {[7, 30, 90].map((d) => (
          <Button key={d} size="sm" variant={isPreset === d ? "brand" : "outline"} className="rounded-2xl" onClick={() => onPreset(d)}>
            {d} Days
          </Button>
        ))}
        <span className="self-center text-[11px] text-muted-foreground">Custom: neeche From / To chunein</span>
      </div>

      <p className={`mt-4 text-sm font-bold ${trendTone}`}>{analysis.headline}</p>
      <p className="text-xs text-muted-foreground">{analysis.trendText}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {[
          ["Total activity", analysis.totals.activity],
          ["Working days", `${analysis.workingDays}/${analysis.series.length}`],
          ["Report completion", `${analysis.completionPercent}%`],
          ["Avg / working day", analysis.avgPerWorkingDay],
        ].map(([l, v]) => (
          <div key={String(l)} className="inset-panel rounded-2xl p-2">
            <p className="font-display text-lg font-bold">{v}</p>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-[11px] font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground" /> Total activity
        </span>
        {TREND_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => toggle(m.key)}
            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${hidden.has(m.key) ? "border-hairline opacity-50" : "border-cyan/40"}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
            {m.label}
          </button>
        ))}
      </div>

      <div className="inset-panel mt-3 rounded-2xl p-3">
        {series.length ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="Performance trend graph" preserveAspectRatio="none">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1={padX} x2={width - padX} y1={padY + f * (height - padY * 2)} y2={padY + f * (height - padY * 2)} stroke="currentColor" strokeOpacity={0.12} />
            ))}
            {series.map((d, i) =>
              d.status === "report" ? null : (
                <rect key={d.date} x={x(i) - stepX / 2} y={padY} width={Math.max(2, stepX)} height={height - padY * 2} fill={d.status === "leave" ? "#2563EB" : "#CD3737"} opacity={0.12} />
              ),
            )}
            {analysis.events.map((e) => {
              const i = series.findIndex((d) => d.date === e.date);
              return i < 0 ? null : (
                <line key={e.date} x1={x(i)} x2={x(i)} y1={padY} y2={height - padY} stroke={e.kind === "drop" ? "#FF4D5E" : "#21D07A"} strokeDasharray="4 3" strokeWidth={1.5} />
              );
            })}
            <path d={path((d) => d.activity)} fill="none" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
            {shown.map((m) => (
              <path key={m.key} d={path((d) => Number(d[m.key]) || 0)} fill="none" stroke={m.color} strokeWidth={2} strokeLinejoin="round" opacity={0.9} />
            ))}
          </svg>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Is period mein koi report data nahi.</p>
        )}
        <div className="mt-2 flex justify-between text-[9px] font-semibold uppercase text-muted-foreground">
          <span>{series[0] ? dayShort(series[0].date) : ""}</span>
          <span className="flex gap-3">
            <span className="text-[#2563EB]">■ Leave</span>
            <span className="text-destructive">■ Absent</span>
          </span>
          <span>{series.length ? dayShort(series[series.length - 1]!.date) : ""}</span>
        </div>
      </div>

      {analysis.previous ? (
        <div className="mt-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Previous period ({dayShort(analysis.previous.start)} — {dayShort(analysis.previous.end)})
          </p>
          {analysis.previous.changes.map((c) => (
            <div key={c.label} className="flex justify-between gap-3 text-xs">
              <span>{c.label}: <b>{c.current}</b> vs {c.previous}</span>
              <span className={c.percent && c.percent >= 5 ? "text-[#21D07A]" : c.percent && c.percent <= -5 ? "text-destructive" : "text-muted-foreground"}>{c.text}</span>
            </div>
          ))}
        </div>
      ) : null}
      {analysis.events.length ? (
        <ul className="mt-3 space-y-1 text-xs">
          {analysis.events.map((e) => (
            <li key={e.date} className={e.kind === "drop" ? "text-destructive" : "text-[#21D07A]"}>• {e.text}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
