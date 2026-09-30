/**
 * FBO view of the running 10-day cycle: live countdown, per-assistant
 * conversion and the commission each one has earned so far.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Timer, TrendingUp, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { SectionTitle } from "@/components/member/MemberShell";
import { cycleCountdown, money } from "@/lib/growth-cycle";
import { getGrowthOverview } from "@/lib/growth.functions";

const ROLE = { calling: "Calling", full_funnel: "Full Funnel" } as const;

export function GrowthCyclePanel() {
  const load = useServerFn(getGrowthOverview);
  const { data } = useQuery({ queryKey: ["growth-overview"], queryFn: () => load(), retry: false });
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!data) return null;
  const left = cycleCountdown(data.cycle);

  return (
    <div className="space-y-4">
      <section className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionTitle>{data.cycle.label}</SectionTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.cycle.start} se {data.cycle.end} tak — is cycle ka hisaab
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            <Timer className="size-3.5" /> {left.days}d {left.hours}h baqi
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<Users className="size-4" />} label="Leads" value={String(data.totals.leads)} />
          <Stat icon={<TrendingUp className="size-4" />} label="Enrolled" value={String(data.totals.enrolled)} />
          <Stat icon={<Trophy className="size-4" />} label="2CC" value={String(data.totals.ccDone)} />
          <Stat icon={<Trophy className="size-4" />} label="Commission" value={money(data.totals.amount)} />
        </div>
        {data.unassigned > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">{data.unassigned} leads abhi kisi ko assign nahi hui.</p>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Is cycle ki performance</SectionTitle>
        {(data.rows ?? []).length === 0 && <p className="text-sm text-muted-foreground">Abhi koi assistant nahi.</p>}
        {(data.rows ?? []).map((r) => (
          <div key={r.id} className="glass-panel rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE[r.role]} · {r.totalLeads} total leads
                </p>
              </div>
              <p className="text-lg font-semibold text-primary">{money(r.total)}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Cell label="Cycle leads" value={String(r.leads)} />
              <Cell label="Enrolled" value={`${r.enrolled} (${r.conversionRate}%)`} />
              <Cell label="Verified enrollment" value={String(r.enrolled)} />
              <Cell label="Verified 2CC" value={String(r.ccDone)} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Commission is added only after office verification.</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </span>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card/50 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
