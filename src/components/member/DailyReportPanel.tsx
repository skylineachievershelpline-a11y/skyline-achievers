import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Lock,
  PenLine,
  ReceiptText,
  Send,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { PaymentSlip, type PaymentSlipData } from "@/components/courses/PaymentSlip";
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
  const [reportSlip, setReportSlip] = useState<PaymentSlipData | null>(null);
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
    const days = data?.days ?? [];
    return days
      .filter((day) => day.date >= rangeStart && day.date <= rangeEnd)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [data, rangeStart, rangeEnd]);

  const chartDays = useMemo(() => {
    const map = new Map((data?.days ?? []).map((day) => [day.date, day]));
    return Array.from({ length: 14 }, (_, index) => {
      const date = shiftDay(today, -(13 - index));
      return (
        map.get(date) ?? {
          date,
          leads: 0,
          responses: 0,
          enrollments: 0,
          pending: 0,
          twoCc: 0,
          mentorshipPaid: 0,
          absent: false,
          absentReason: null,
          submitted: false,
        }
      );
    });
  }, [data, today]);

  async function buildPdf() {
    if (!data) return null;
    return await buildDailyReportPdf({
      title: "Daily working report",
      person: data.member.fullName,
      personId: data.member.memberId,
      rangeLabel: `${dayShort(rangeStart)} — ${dayShort(rangeEnd)}`,
      rows: rangeRows,
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

  function printReportSlip() {
    if (!data) return;
    setReportSlip({
      kind: "daily-report",
      title: "Daily Working Report",
      buyerName: data.member.fullName,
      buyerId: data.member.memberId,
      amount: 0,
      rangeLabel: `${dayShort(rangeStart)} — ${dayShort(rangeEnd)}`,
      reportRows: rangeRows,
      status: "Printed report",
      note: `${rangeRows.length} day${rangeRows.length === 1 ? "" : "s"} selected from your daily working report.`,
      receiptId: `DR-${data.member.memberId}-${Date.now().toString().slice(-6)}`,
      submittedAt: new Date(),
    });
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
      <MissedReportWarning level={data.warning.level} />

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
        <TrendChart days={chartDays} />

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
          <Button
            variant="outline"
            className="rounded-2xl"
            disabled={rangeRows.length === 0}
            onClick={printReportSlip}
          >
            <ReceiptText className="h-4 w-4" />
            Print Slip
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
                    <td className="p-3 text-right tabular-nums">{row.leads}</td>
                    <td className="p-3 text-right tabular-nums">{row.responses}</td>
                    <td className="p-3 text-right tabular-nums">{row.enrollments}</td>
                    <td className="p-3 text-right tabular-nums">{row.pending}</td>
                    <td className="p-3 text-right tabular-nums">{row.twoCc}</td>
                    <td className="p-3 text-right font-semibold tabular-nums text-cyan">
                      {row.mentorshipPaid}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        </section>
      </div>
      <PaymentSlip open={reportSlip !== null} data={reportSlip} onClose={() => setReportSlip(null)} />
    </div>
  );
}

/** Red warning shown when yesterday's report was not shared. */
function MissedReportWarning({ level }: { level: number }) {
  if (level < 1) return null;
  const message =
    level === 1
      ? "You did not share yesterday's report. If you stay inactive next, your account can be blocked."
      : level === 2
        ? "Last warning: two days without a report. One more missed day and your account will be blocked automatically."
        : "Your account has been blocked automatically after three days without a report. Please contact your administrator.";
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/50 bg-destructive/12 px-4 py-3 text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {level === 1 ? "Warning" : level === 2 ? "Last warning" : "Account blocked"}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

/** Premium multi-line tracking graph (blue / green / red). */
function TrendChart({ days }: { days: ReportDay[] }) {
  const width = 560;
  const height = 200;
  const padX = 12;
  const padY = 16;
  const max = Math.max(
    4,
    ...days.flatMap((day) => [day.leads, day.responses, day.enrollments]),
  );
  const stepX = (width - padX * 2) / Math.max(1, days.length - 1);
  const pointY = (value: number) => height - padY - (value / max) * (height - padY * 2);

  const path = (key: (typeof LINES)[number]["key"]) =>
    days
      .map(
        (day, index) =>
          `${index === 0 ? "M" : "L"}${(padX + index * stepX).toFixed(1)},${pointY(day[key]).toFixed(1)}`,
      )
      .join(" ");

  return (
    <section className="raised-panel metal-edge rounded-3xl p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Tracking graph
          </p>
          <h3 className="mt-1 font-display text-lg font-bold">Last 14 days performance</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {LINES.map((line) => (
            <span key={line.key} className="flex items-center gap-1.5 text-[11px] font-semibold">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: line.color, boxShadow: `0 0 10px ${line.color}` }}
              />
              {line.label}
            </span>
          ))}
        </div>
      </div>

      <div className="inset-panel mt-4 rounded-2xl p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full"
          role="img"
          aria-label="Daily report trend for the last 14 days"
          preserveAspectRatio="none"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <line
              key={fraction}
              x1={padX}
              x2={width - padX}
              y1={padY + fraction * (height - padY * 2)}
              y2={padY + fraction * (height - padY * 2)}
              stroke="currentColor"
              strokeOpacity={0.12}
              strokeWidth={1}
            />
          ))}
          {LINES.map((line) => (
            <g key={line.key}>
              <path
                d={path(line.key)}
                fill="none"
                stroke={line.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
              />
              {days.map((day, index) => (
                <circle
                  key={day.date}
                  cx={padX + index * stepX}
                  cy={pointY(day[line.key])}
                  r={2.6}
                  fill={line.color}
                />
              ))}
            </g>
          ))}
        </svg>
        <div className="mt-2 flex justify-between text-[9px] font-semibold uppercase text-muted-foreground">
          <span>{dayShort(days[0]?.date ?? "")}</span>
          <span>{dayShort(days[days.length - 1]?.date ?? "")}</span>
        </div>
      </div>
    </section>
  );
}
