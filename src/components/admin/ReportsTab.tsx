import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ChevronLeft, ChevronRight, Download, FileText, Loader2, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminGetMemberReport,
  adminGetRates,
  adminGetReports,
  adminSaveRates,
} from "@/lib/admin-reports.functions";
import {
import { SkylineLoader } from "@/components/brand/SkylineLoader";
  buildMemberReportPdf,
  buildTeamReportPdf,
  saveReportBlob,
} from "@/lib/admin-report-pdf";

const money = (value: number) => `PKR ${value.toLocaleString("en-PK")}`;
const monthKey = (date: Date) => date.toISOString().slice(0, 7);
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

function shiftMonth(key: string, delta: number) {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  return monthKey(new Date(Date.UTC(year, month - 1 + delta, 1)));
}

export function ReportsTab() {
  const [month, setMonth] = useState(() => monthKey(new Date(Date.now() + 5 * 3600_000)));
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [scope, setScope] = useState<"month" | "all">("month");
  const [busy, setBusy] = useState<string | null>(null);
  const rangeLabel = scope === "all" ? "Complete record (all time)" : monthLabel(month);

  const loadAll = useServerFn(adminGetReports);
  const loadOne = useServerFn(adminGetMemberReport);

  const { data, isPending } = useQuery({
    queryKey: ["admin-reports", month, scope],
    queryFn: () => loadAll({ data: { month, all: scope === "all" } } as never),
  });

  const detail = useQuery({
    queryKey: ["admin-report-member", openMember, month, scope],
    queryFn: () =>
      loadOne({ data: { memberId: openMember, month, all: scope === "all" } } as never),
    enabled: Boolean(openMember),
  });

  /** One PDF with every member's totals for the chosen period. */
  async function downloadTeamPdf() {
    if (!data || busy) return;
    setBusy("team");
    try {
      const file = await buildTeamReportPdf(data, rangeLabel);
      saveReportBlob(file.blob, file.name);
      toast.success("All members report downloaded");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** Complete day-by-day PDF for a single member. */
  async function downloadMemberPdf(memberId: string) {
    if (busy) return;
    setBusy(memberId);
    try {
      const report = await loadOne({
        data: { memberId, month, all: scope === "all" },
      } as never);
      const file = await buildMemberReportPdf(report, rangeLabel);
      saveReportBlob(file.blob, file.name);
      toast.success("Member report downloaded");
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Member reports
            </p>
            <h2 className="mt-1 font-display text-xl font-bold">Daily &amp; monthly progress</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Leads, investment, joinings and earning for every member.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setMonth(shiftMonth(month, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="inset-panel flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" /> {monthLabel(month)}
            </span>
            <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setMonth(shiftMonth(month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant={scope === "month" ? "brand" : "outline"}
            size="sm"
            className="rounded-2xl"
            onClick={() => setScope("month")}
          >
            This month
          </Button>
          <Button
            variant={scope === "all" ? "brand" : "outline"}
            size="sm"
            className="rounded-2xl"
            onClick={() => setScope("all")}
          >
            Complete record
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-2xl"
            disabled={!data || busy === "team"}
            onClick={() => void downloadTeamPdf()}
          >
            {busy === "team" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            All members PDF
          </Button>
        </div>

        {data ? (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Month leads" value={String(data.totals.leads)} />
            <Tile label="Month investment" value={money(data.totals.investment)} />
            <Tile label="Month joinings" value={String(data.totals.joins)} />
            <Tile label="Month earning" value={money(data.totals.earning)} />
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
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-3">Member</th>
                  <th className="p-3">Rank</th>
                  <th className="p-3 text-right">Today leads</th>
                  <th className="p-3 text-right">Month leads</th>
                  <th className="p-3 text-right">Investment</th>
                  <th className="p-3 text-right">Joinings</th>
                  <th className="p-3 text-right">Earning</th>
                  <th className="p-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {(data?.members ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3">
                      <p className="font-semibold">{row.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.memberId}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{row.level ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{row.todayLeads}</td>
                    <td className="p-3 text-right tabular-nums">{row.leads}</td>
                    <td className="p-3 text-right tabular-nums text-muted-foreground">
                      {money(row.investment)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{row.joins}</td>
                    <td className="p-3 text-right font-semibold tabular-nums text-cyan">
                      {money(row.earning)}
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
                    </td>
                  </tr>
                ))}
                {(data?.members ?? []).length === 0 ? (
                  <tr>
                    <td className="p-5 text-muted-foreground" colSpan={8}>
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
              <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setOpenMember(null)}>
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
              No tracking saved for {rangeLabel}.
            </p>
          ) : (
            <div className="inset-panel mt-4 overflow-x-auto rounded-2xl">
              <table className="w-full min-w-[460px] text-left text-xs">
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
                  {(detail.data?.days ?? []).map((day) => (
                    <tr key={day.date} className="border-b border-border/60 last:border-0">
                      <td className="p-3 font-semibold">
                        {dayLabel(day.date)}
                        {day.absent && day.absentReason ? (
                          <span className="mt-1 block max-w-[240px] text-[10px] font-normal text-muted-foreground">
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
      ) : null}
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
    mutationFn: () =>
      save({ data: { lead: Number(lead || 0), join: Number(join || 0) } } as never),
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
        These amounts are used everywhere: member dashboards, reports and PDFs. Already saved past
        days keep the lead rate they were saved with.
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
