import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2, Pencil, ReceiptText, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PaymentSlip, type PaymentSlipData } from "@/components/courses/PaymentSlip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminGetMemberReport,
  adminGetRates,
  adminGetReports,
  adminSaveRates,
  adminUpdateMemberReport,
} from "@/lib/admin-reports.functions";
import { buildDailyReportPdf, saveReportBlob } from "@/lib/daily-report-pdf";

const shiftDay = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const pktToday = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

export function ReportsTab() {
  const today = pktToday();
  const [from, setFrom] = useState(() => shiftDay(pktToday(), -6));
  const [to, setTo] = useState(today);
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reportSlip, setReportSlip] = useState<PaymentSlipData | null>(null);

  const loadAll = useServerFn(adminGetReports);
  const loadOne = useServerFn(adminGetMemberReport);

  const { data, isPending } = useQuery({
    queryKey: ["admin-reports", from, to],
    queryFn: () => loadAll({ data: { from, to } } as never),
  });

  const detail = useQuery({
    queryKey: ["admin-report-member", openMember, from, to],
    queryFn: () => loadOne({ data: { memberId: openMember, from, to } } as never),
    enabled: Boolean(openMember),
  });

  const saveDay = useServerFn(adminUpdateMemberReport);
  const queryClient = useQueryClient();
  const saveReport = useMutation({
    mutationFn: () =>
      saveDay({ data: { memberId: openMember, ...editDay } } as never),
    onSuccess: () => {
      toast.success("Report updated");
      setEditDay(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-report-member"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rangeLabel = `${dayLabel(from)} — ${dayLabel(to)}`;

  async function downloadMemberPdf(memberId: string) {
    if (busy) return;
    setBusy(memberId);
    try {
      const report = await loadOne({ data: { memberId, from, to } } as never);
      const file = await buildDailyReportPdf({
        title: "Member daily report",
        person: report.member?.fullName ?? "Member",
        personId: report.member?.memberId ?? "—",
        rangeLabel,
        rows: report.days,
      });
      saveReportBlob(file.blob, file.name);
      toast.success("Member report downloaded");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function printMemberSlip(memberId: string) {
    if (busy) return;
    setBusy(memberId);
    try {
      const report = await loadOne({ data: { memberId, from, to } } as never);
      setReportSlip({
        kind: "daily-report",
        title: "Member Daily Report",
        buyerName: report.member?.fullName ?? "Member",
        buyerId: report.member?.memberId ?? "—",
        amount: 0,
        rangeLabel,
        reportRows: report.days,
        status: "Printed by admin",
        note: `${report.days.length} day${report.days.length === 1 ? "" : "s"} selected from this member's daily working report.`,
        receiptId: `DR-${report.member?.memberId ?? "member"}-${Date.now().toString().slice(-6)}`,
        submittedAt: new Date(),
      });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <RatesCard />

      <div className="raised-panel metal-edge rounded-3xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          Daily reports
        </p>
        <h2 className="mt-1 font-display text-xl font-bold">Working reports by day</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Leads, response, enrollments, pending, 2CC and Personal Mentorship fees for every member.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: "Today", days: 0 },
            { label: "Last 3 days", days: 2 },
            { label: "Last 7 days", days: 6 },
            { label: "Last 30 days", days: 29 },
          ].map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={() => {
                setFrom(shiftDay(today, -preset.days));
                setTo(today);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr] sm:max-w-md">
          <div className="space-y-2">
            <Label htmlFor="admin-report-from">From</Label>
            <Input
              id="admin-report-from"
              type="date"
              value={from}
              max={today}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-report-to">To</Label>
            <Input
              id="admin-report-to"
              type="date"
              value={to}
              max={today}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </div>

        {data ? (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Tile label="Leads" value={String(data.totals.leads)} />
            <Tile label="Response" value={String(data.totals.responses)} />
            <Tile label="Enrollments" value={String(data.totals.enrollments)} />
            <Tile label="Pending" value={String(data.totals.pending)} />
            <Tile label="2CC" value={String(data.totals.twoCc)} />
            <Tile label="PM fees" value={String(data.totals.mentorshipPaid)} />
          </div>
        ) : null}
      </div>

      <div className="raised-panel metal-edge overflow-hidden rounded-3xl">
        {isPending ? (
          <div className="flex h-40 items-center justify-center">
            <SkylineLoader />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-3">Member</th>
                  <th className="p-3">Today</th>
                  <th className="p-3 text-right">Leads</th>
                  <th className="p-3 text-right">Response</th>
                  <th className="p-3 text-right">Enroll</th>
                  <th className="p-3 text-right">Pending</th>
                  <th className="p-3 text-right">2CC</th>
                  <th className="p-3 text-right">PM fee</th>
                  <th className="p-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {(data?.members ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3">
                      <p className="font-semibold">{row.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.memberId} · {row.level ?? "—"}
                      </p>
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase ${
                          row.submittedToday
                            ? "border-cyan/35 bg-primary/12 text-cyan"
                            : "border-destructive/45 bg-destructive/12 text-destructive"
                        }`}
                      >
                        {row.submittedToday ? "Shared" : "Missing"}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{row.leads}</td>
                    <td className="p-3 text-right tabular-nums">{row.responses}</td>
                    <td className="p-3 text-right tabular-nums">{row.enrollments}</td>
                    <td className="p-3 text-right tabular-nums">{row.pending}</td>
                    <td className="p-3 text-right tabular-nums">{row.twoCc}</td>
                    <td className="p-3 text-right font-semibold tabular-nums text-cyan">
                      {row.mentorshipPaid}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => setOpenMember(row.id)}
                      >
                        View days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2 rounded-xl"
                        disabled={busy === row.id}
                        onClick={() => void downloadMemberPdf(row.id)}
                      >
                        {busy === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        PDF
                      </Button>
                      <Button
                        variant="brand"
                        size="sm"
                        className="ml-2 rounded-xl"
                        disabled={busy === row.id || row.days === 0}
                        onClick={() => void printMemberSlip(row.id)}
                      >
                        {busy === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ReceiptText className="h-4 w-4" />
                        )}
                        Print Slip
                      </Button>
                    </td>
                  </tr>
                ))}
                {(data?.members ?? []).length === 0 ? (
                  <tr>
                    <td className="p-5 text-muted-foreground" colSpan={9}>
                      No members yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openMember ? (
        <div className="raised-panel metal-edge rounded-3xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Day by day
              </p>
              <h3 className="mt-1 font-display text-lg font-bold">
                {detail.data?.member?.fullName ?? "Member"}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {detail.data?.member?.memberId ?? ""}
                </span>
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={busy === openMember}
                onClick={() => void downloadMemberPdf(openMember)}
              >
                {busy === openMember ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download PDF
              </Button>
              <Button
                variant="brand"
                size="sm"
                className="rounded-xl"
                disabled={busy === openMember || (detail.data?.days.length ?? 0) === 0}
                onClick={() => void printMemberSlip(openMember)}
              >
                {busy === openMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
                Print Slip
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                onClick={() => setOpenMember(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {detail.isPending ? (
            <div className="flex h-24 items-center justify-center">
              <SkylineLoader />
            </div>
          ) : (detail.data?.days ?? []).length === 0 ? (
            <p className="inset-panel mt-4 rounded-xl p-4 text-sm text-muted-foreground">
              No report shared for {rangeLabel}.
            </p>
          ) : (
            <div className="inset-panel mt-4 overflow-x-auto rounded-2xl">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Leads</th>
                    <th className="p-3 text-right">Response</th>
                    <th className="p-3 text-right">Enroll</th>
                    <th className="p-3 text-right">Pending</th>
                    <th className="p-3 text-right">2CC</th>
                    <th className="p-3 text-right">PM fee</th>
                    <th className="p-3 text-right">Fix</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.data?.days ?? []).map((day) =>
                    editDay?.date === day.date ? (
                      <tr key={day.date} className="border-b border-border/60 last:border-0">
                        <td className="p-3 font-semibold">{dayLabel(day.date)}</td>
                        {(
                          [
                            "leads",
                            "responses",
                            "enrollments",
                            "pending",
                            "twoCc",
                            "mentorshipPaid",
                          ] as const
                        ).map((field) => (
                          <td key={field} className="p-2">
                            <Input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              className="h-9 w-20 text-right"
                              value={String(editDay[field])}
                              onChange={(event) =>
                                setEditDay({ ...editDay, [field]: Number(event.target.value || 0) })
                              }
                            />
                          </td>
                        ))}
                        <td className="p-2 text-right">
                          <Button
                            variant="brand"
                            size="sm"
                            className="rounded-xl"
                            disabled={saveReport.isPending}
                            onClick={() => saveReport.mutate()}
                          >
                            {saveReport.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-2 rounded-xl"
                            onClick={() => setEditDay(null)}
                          >
                            Cancel
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={day.date} className="border-b border-border/60 last:border-0">
                        <td className="p-3 font-semibold">{dayLabel(day.date)}</td>
                        <td className="p-3 text-right tabular-nums">{day.leads}</td>
                        <td className="p-3 text-right tabular-nums">{day.responses}</td>
                        <td className="p-3 text-right tabular-nums">{day.enrollments}</td>
                        <td className="p-3 text-right tabular-nums">{day.pending}</td>
                        <td className="p-3 text-right tabular-nums">{day.twoCc}</td>
                        <td className="p-3 text-right font-semibold tabular-nums text-cyan">
                          {day.mentorshipPaid}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() =>
                              setEditDay({
                                date: day.date,
                                leads: day.leads,
                                responses: day.responses,
                                enrollments: day.enrollments,
                                pending: day.pending,
                                twoCc: day.twoCc,
                                mentorshipPaid: day.mentorshipPaid,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
      <PaymentSlip open={reportSlip !== null} data={reportSlip} onClose={() => setReportSlip(null)} />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="inset-panel rounded-2xl p-4">
      <p className="font-display text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/** Admin-editable money rules: lead investment and per-joining earning. */
function RatesCard() {
  const queryClient = useQueryClient();
  const load = useServerFn(adminGetRates);
  const save = useServerFn(adminSaveRates);

  const { data } = useQuery({ queryKey: ["admin-rates"], queryFn: () => load() });
  const [lead, setLead] = useState("");
  const [join, setJoin] = useState("");

  useEffect(() => {
    if (!data) return;
    setLead(String(data.lead));
    setJoin(String(data.join));
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => save({ data: { lead: Number(lead || 0), join: Number(join || 0) } } as never),
    onSuccess: () => {
      toast.success("Rates updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-rates"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="raised-panel metal-edge rounded-3xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
        Money settings
      </p>
      <h2 className="mt-1 font-display text-xl font-bold">Lead &amp; joining rates</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        These amounts are stored with every saved day for your own records.
      </p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (Number(lead) < 0 || Number(join) < 0) {
            toast.error("Amounts cannot be negative");
            return;
          }
          mutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="rate-lead">Investment per lead (PKR)</Label>
          <Input
            id="rate-lead"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={lead}
            onChange={(event) => setLead(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rate-join">Earning per joining (PKR)</Label>
          <Input
            id="rate-join"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={join}
            onChange={(event) => setJoin(event.target.value)}
          />
        </div>
        <Button type="submit" variant="brand" className="rounded-2xl" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save rates
        </Button>
      </form>
    </div>
  );
}
