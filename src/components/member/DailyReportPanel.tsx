import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  CalendarDays,
  Clock,
  Download,
  FileChartColumn,
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
import { MonthlyActivityChart } from "@/components/member/MonthlyActivityChart";
import { BRAND } from "@/lib/brand";
import {
  getDailyReport,
  submitDailyReport,
  type ReportDay,
} from "@/lib/daily-report.functions";
import { buildDailyReportPdf, buildPerformancePdf, saveReportBlob } from "@/lib/daily-report-pdf";
import { performanceInsight, simpleComparison, type PerformanceAnalysis } from "@/lib/performance-trend";
import { analyzeMonth, availableMonths, monthBounds, monthLabel } from "@/lib/performance-month";

const FIELDS = [
  { key: "leads", label: "Today total leads", hint: "How many leads did you work on?" },
  { key: "responses", label: "Response", hint: "Leads that responded" },
  { key: "enrollments", label: "Enrollments", hint: "Enrollments completed" },
  { key: "pending", label: "Pending", hint: "Still pending" },
  { key: "twoCc", label: "2CC done", hint: "People who did 2CC" },
  { key: "mentorshipPaid", label: "Personal Mentorship fee paid", hint: "People who paid the fee" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

const dayShort = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

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
  const [selectedMonth, setSelectedMonth] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [graphPdfBusy, setGraphPdfBusy] = useState(false);
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
  const activeMonth = selectedMonth || today.slice(0, 7);
  const { start: rangeStart, end: rangeEnd } = monthBounds(activeMonth, today);
  const months = useMemo(() => availableMonths(data?.calendar ?? [], today), [data, today]);

  const rangeRows = useMemo(() => {
    const days = data?.calendar ?? [];
    return days
      .filter((day) => day.date >= rangeStart && day.date <= rangeEnd)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [data, rangeStart, rangeEnd]);

  const analysis = useMemo(
    () => analyzeMonth(data?.calendar ?? [], activeMonth, today),
    [data, activeMonth, today],
  );

  async function buildPdf() {
    if (!data) return null;
    return await buildDailyReportPdf({
      title: `${monthLabel(activeMonth)} monthly working report`,
      person: data.member.fullName,
      personId: data.member.memberId,
      rangeLabel: monthLabel(activeMonth),
      month: activeMonth,
      rows: rangeRows,
      analysis,
    });
  }

  async function downloadGraphPdf() {
    if (graphPdfBusy || !data) return;
    setGraphPdfBusy(true);
    try {
      const file = await buildPerformancePdf({
        person: data.member.fullName,
        personId: data.member.memberId,
        monthLabel: monthLabel(activeMonth),
        month: activeMonth,
        analysis,
      });
      saveReportBlob(file.blob, file.name);
      toast.success("Monthly graph downloaded");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setGraphPdfBusy(false);
    }
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
        <PerformanceGraph analysis={analysis} activeMonth={activeMonth} months={months} onMonth={setSelectedMonth} onGraphPdf={() => void downloadGraphPdf()} graphPdfBusy={graphPdfBusy} />

        <section className="raised-panel metal-edge rounded-3xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Report download
        </p>
        <h3 className="mt-1 font-display text-lg font-bold">{monthLabel(activeMonth)} report</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="report-month">Select month</Label>
            <select id="report-month" value={activeMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
            </select>
          </div>
          <Button
            variant="outline"
            className="rounded-2xl"
            disabled={pdfBusy}
            onClick={() => void downloadPdf()}
          >
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
             Monthly PDF
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
           {rangeRows.length} day{rangeRows.length === 1 ? "" : "s"} in {monthLabel(activeMonth)}.
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

/** Simple Performance Report: same analysis as the PDF. */
function PerformanceGraph({
  analysis,
  activeMonth,
  months,
  onMonth,
  onGraphPdf,
  graphPdfBusy,
}: {
  analysis: PerformanceAnalysis;
  activeMonth: string;
  months: string[];
  onMonth: (month: string) => void;
  onGraphPdf: () => void;
  graphPdfBusy: boolean;
}) {
  const [open, setOpen] = useState(true);
  const series = analysis.series;
  const compare = simpleComparison(analysis);
  const main = compare[0];
  const insight = performanceInsight(analysis);
  const tone = (p: number | null) =>
    p === null || p === 0 ? "text-muted-foreground" : p > 0 ? "text-success" : "text-destructive";
  const arrow = (p: number | null) => (p === null ? "" : p > 0 ? "↑" : p < 0 ? "↓" : "=");

  return (
    <section className="raised-panel metal-edge rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Performance report</p>
          <h3 className="mt-1 font-display text-lg font-bold">
            {monthLabel(activeMonth)}
          </h3>
        </div>
        <Button size="sm" variant={open ? "outline" : "brand"} className="rounded-2xl" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>

      {open ? (
        <>
          <div className="mt-3 flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="performance-month" className="flex items-center gap-1.5 text-xs"><CalendarDays className="h-3.5 w-3.5" /> Month</Label>
              <select id="performance-month" value={activeMonth} onChange={(event) => onMonth(event.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
              </select>
            </div>
            <Button type="button" variant="outline" disabled={graphPdfBusy} onClick={onGraphPdf} aria-label="Download monthly graph PDF">
              {graphPdfBusy ? <Loader2 className="animate-spin" /> : <FileChartColumn />} Graph PDF
            </Button>
          </div>

          <p className="mt-4 rounded-2xl border border-cyan/30 bg-primary/10 p-3 text-sm font-semibold">{insight}</p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
            {[
              ["Working Days", `${analysis.workingDays} / ${series.length}`],
              ["Total Activities", analysis.totals.activity],
              ["Leads", analysis.totals.leads],
              ["Responses", analysis.totals.responses],
              ["Enrollments", analysis.totals.enrollments],
            ].map(([l, v]) => (
              <div key={String(l)} className="inset-panel rounded-2xl p-3">
                <p className="font-display text-xl font-bold">{v}</p>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>

          <MonthlyActivityChart analysis={analysis} />

          {main ? (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Period comparison</p>
              <div className="inset-panel rounded-2xl p-3 text-sm">
               <p>Previous Month: <b>{main.previous}</b> Activities</p>
               <p>Selected Month: <b>{main.current}</b> Activities</p>
                <p className={`mt-1 text-base font-bold ${tone(main.percent)}`}>
                  {main.percent === null ? "New activity" : main.percent === 0 ? "Same" : `${arrow(main.percent)} ${Math.abs(main.percent)}% Activity`}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {compare.slice(1).map((c) => (
                  <div key={c.label} className="inset-panel rounded-2xl p-2">
                    <p className="font-semibold">{c.label}</p>
                    <p className="font-bold">{c.previous} → {c.current}</p>
                    <p className={tone(c.percent)}>{arrow(c.percent)} {c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {analysis.leaveDays || analysis.absentDays ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Leave: {analysis.leaveDays} din · Absent: {analysis.absentDays} din
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
