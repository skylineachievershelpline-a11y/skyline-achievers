/**
 * The Growth Executive's own money card inside their private workspace:
 * current 10-day cycle, what they earned and what the next tier needs.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Timer, Wallet } from "lucide-react";

import { cycleCountdown, money } from "@/lib/growth-cycle";
import { getAssistantEarnings } from "@/lib/growth.functions";

export function AssistantEarningsCard({ token }: { token: string }) {
  const load = useServerFn(getAssistantEarnings);
  const { data } = useQuery({
    queryKey: ["assistant-earnings", token],
    queryFn: () => load({ data: { token } }),
    retry: false,
  });
  if (!data) return null;
  const e = data.earnings;
  const left = cycleCountdown(data.cycle);

  return (
    <section className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="size-4 text-primary" /> Meri kamai
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          <Timer className="size-3" /> {left.days}d {left.hours}h
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-primary">{money(e.total)}</p>
      <p className="text-[11px] text-muted-foreground">{data.cycle.label} — is cycle ka hisaab</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Box label="Leads" value={String(e.leads)} />
        <Box label={`Enrolled (${e.conversionRate}%)`} value={`${e.enrolled} × ${money(e.enrollmentRate)}`} />
        <Box label="2CC" value={`${e.ccDone} × ${money(e.ccRate)}`} />
      </div>
      {e.nextEnrollmentTier ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Batch mein {e.nextEnrollmentTier.count} verified enrollments par har enrollment {money(e.nextEnrollmentTier.perEnrollment)} ka ho jayega.
        </p>
      ) : null}
      {e.nextCcTier ? (
        <p className="text-[11px] text-muted-foreground">
          {e.nextCcTier.minCount} 2CC is cycle mein karein to har 2CC {money(e.nextCcTier.perCc)}.
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Box label="Verified" value={money(data.ledger.verified)} />
        <Box label="Payable" value={money(data.ledger.payable)} />
        <Box label="Paid" value={money(data.ledger.paid)} />
      </div>
    </section>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card/50 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
