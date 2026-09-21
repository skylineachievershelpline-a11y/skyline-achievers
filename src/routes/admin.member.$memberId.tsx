import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PaymentSlip, type PaymentSlipData } from "@/components/courses/PaymentSlip";
import { formatRankName, RankPin } from "@/components/member/RankPin";
import { Button } from "@/components/ui/button";
import { adminGetMemberDashboard } from "@/lib/admin.functions";
import { BRAND } from "@/lib/brand";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  Eye,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/member/$memberId")({
  head: () => ({
    meta: [
      { title: "Member Dashboard Preview — Skyline Achievers" },
      { name: "description", content: "Secure administrator preview of a Skyline Achievers member dashboard." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Member Dashboard Preview — Skyline Achievers" },
      { property: "og:description", content: "Restricted administrator member dashboard preview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminMemberDashboardPage,
});

function AdminMemberDashboardPage() {
  const { memberId } = Route.useParams();
  const load = useServerFn(adminGetMemberDashboard);
  const [reportSlip, setReportSlip] = useState<PaymentSlipData | null>(null);
  const query = useQuery({
    queryKey: ["admin-member-dashboard", memberId],
    queryFn: () => load({ data: { id: memberId } }),
    retry: false,
  });

  if (query.isPending) {
    return <div className="flex min-h-screen items-center justify-center"><SkylineLoader variant="page" /></div>;
  }

  if (query.isError || !query.data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="raised-panel metal-edge w-full max-w-md rounded-2xl p-7 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-cyan" />
          <h1 className="mt-4 font-display text-xl font-semibold">Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your admin session may have expired, or this member no longer exists.</p>
          <Button asChild variant="brand" className="mt-5"><Link to="/admin"><ArrowLeft />Back to Admin Panel</Link></Button>
        </div>
      </main>
    );
  }

  const { member, tracking, dailyReport, recentActivity } = query.data;
  const initial = member.fullName.trim().slice(0, 1).toUpperCase() || "S";
  const rangeLabel = dailyReport.length > 0
    ? `${dayLabel(dailyReport[dailyReport.length - 1]!.date)} — ${dayLabel(dailyReport[0]!.date)}`
    : "Last 30 days";
  const stats = [
    { label: "30-day leads", value: tracking.leads.toLocaleString("en-PK"), icon: TrendingUp },
    { label: "Investment", value: `PKR ${tracking.investment.toLocaleString("en-PK")}`, icon: CircleDollarSign },
    { label: "Team", value: `${tracking.activeTeam}/${tracking.team}`, icon: Users },
    { label: "Active days", value: tracking.activeDays.toLocaleString("en-PK"), icon: CalendarDays },
  ];

  function printDailyReportSlip() {
    setReportSlip({
      kind: "daily-report",
      title: "Daily Working Report",
      buyerName: member.fullName,
      buyerId: member.memberId,
      rank: formatRankName(member.level?.name),
      avatarUrl: member.avatarUrl,
      amount: 0,
      rangeLabel,
      reportRows: dailyReport,
      status: "Admin dashboard report",
      note: `${dailyReport.length} day${dailyReport.length === 1 ? "" : "s"} selected from this member's working report.`,
      receiptId: `DR-${member.memberId}-${Date.now().toString().slice(-6)}`,
      submittedAt: new Date(),
    });
  }

  return (
    <main className="motion-scope cinematic-shell infographic-grid relative min-h-screen bg-background pb-14 text-foreground">
      <div className="cinematic-ambient pointer-events-none fixed inset-0" aria-hidden />
      <header className="cinematic-nav sticky top-0 z-30 border-b border-cyan/20 bg-background/90 shadow-glass backdrop-blur-md">
        <div className="relative mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="Back to Admin Panel"><ArrowLeft /></Link></Button>
          <BrandLogo size="sm" withWordmark={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold">{member.fullName}</p>
            <p className="truncate text-[11px] text-muted-foreground">Admin dashboard preview</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan/30 bg-primary/15 px-2.5 py-1.5 text-[10px] font-bold uppercase text-cyan">
            <Eye className="h-3.5 w-3.5" /> Read only
          </span>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan/25 bg-primary/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-cyan" /><span>You are securely viewing this member’s dashboard as administrator.</span></div>
          <Button asChild variant="outline" size="sm"><Link to="/admin">Return to Admin Panel</Link></Button>
        </div>

        <section className="mx-auto w-full max-w-3xl space-y-6 py-3 font-achiever animate-rise-in">
          <div className="flex items-start gap-5 sm:gap-7">
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt={`${member.fullName} profile`} className="h-24 w-24 shrink-0 rounded-full border-2 border-cyan/40 object-cover shadow-brand sm:h-28 sm:w-28" />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-cyan/40 bg-surface-2 font-display text-3xl font-bold text-cyan shadow-brand sm:h-28 sm:w-28">{initial}</div>
            )}
            <div className="min-w-0 flex-1 pt-1">
               <div className="flex items-center gap-1.5">
                 <h1 className="min-w-0 break-words font-display text-xl font-bold leading-tight sm:text-2xl">{member.fullName}</h1>
                 <RankPin rank={member.level?.name} className="h-12 w-12" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-5 sm:max-w-sm">
                <div><p className="break-all font-achiever-display text-sm font-bold text-cyan sm:text-base">{member.memberId}</p><p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Member ID</p></div>
                <div><p className="break-words font-achiever-display text-sm font-bold sm:text-base">{formatRankName(member.level?.name)}</p><p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Level</p></div>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-cyan">Skyline Achiever</p>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{member.bio || "Learning today. Earning with purpose. Leading by example."}</p>
            <p className="pt-1 text-xs font-semibold text-cyan">{BRAND.name} • {BRAND.tagline}</p>
          </div>
        </section>

        <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => <div key={stat.label} className="glass-panel metal-edge rounded-2xl p-4"><stat.icon className="h-5 w-5 text-cyan" /><p className="mt-4 break-words font-display text-xl font-semibold">{stat.value}</p><p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{stat.label}</p></div>)}
        </section>

        <section className="raised-panel metal-edge mt-5 overflow-hidden rounded-2xl">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Daily working report</h2>
              <p className="text-xs text-muted-foreground">{rangeLabel} · {dailyReport.length} report days</p>
            </div>
            <Button variant="brand" size="sm" disabled={dailyReport.length === 0} onClick={printDailyReportSlip}>
              <ReceiptText className="h-4 w-4" />
              Print Slip
            </Button>
          </div>
          {dailyReport.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No daily working report found for this member.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-surface/70 text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2 text-right">Leads</th>
                    <th className="px-4 py-2 text-right">Response</th>
                    <th className="px-4 py-2 text-right">Enroll</th>
                    <th className="px-4 py-2 text-right">Pending</th>
                    <th className="px-4 py-2 text-right">2CC</th>
                    <th className="px-4 py-2 text-right">PM Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyReport.slice(0, 10).map((row: any) => (
                    <tr key={row.date} className="border-t border-border">
                      <td className="px-4 py-2 font-semibold">{dayLabel(row.date)}</td>
                      <td className="px-4 py-2 text-right">{row.leads}</td>
                      <td className="px-4 py-2 text-right">{row.responses}</td>
                      <td className="px-4 py-2 text-right">{row.enrollments}</td>
                      <td className="px-4 py-2 text-right">{row.pending}</td>
                      <td className="px-4 py-2 text-right">{row.twoCc}</td>
                      <td className="px-4 py-2 text-right">{row.mentorshipPaid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="raised-panel metal-edge mt-5 overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="font-display text-base font-semibold">Recent training activity</h2><p className="text-xs text-muted-foreground">Latest videos this member opened</p></div><Activity className="h-5 w-5 text-cyan" /></div>
          {recentActivity.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No recent training activity.</p> : <div>{recentActivity.map((item: any) => <div key={`${item.lectures.id}-${item.updated_at}`} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.lectures.title}</p><p className="text-[11px] text-muted-foreground">Last opened {new Date(item.updated_at).toLocaleDateString("en-GB")}</p></div><span className="shrink-0 text-xs font-semibold text-cyan">{Math.floor(Number(item.position_seconds ?? 0) / 60)} min</span></div>)}</div>}
        </section>
      </div>
      <PaymentSlip open={reportSlip !== null} data={reportSlip} onClose={() => setReportSlip(null)} />
    </main>
  );
}

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}