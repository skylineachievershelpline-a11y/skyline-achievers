import { AlertTriangle, Clock, Lock, Target, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { formatCountdown, formatPkr, type MemberProgress } from "@/lib/mentorship";

/** Re-renders once a second so the countdown keeps moving. */
function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
}

function Countdown({ until }: { until: string | null }) {
  useTick();
  if (!until) return <span className="font-display text-lg font-bold">—</span>;
  const left = new Date(until).getTime() - Date.now();
  return (
    <span
      className={`font-display text-2xl font-bold tabular-nums ${left <= 0 ? "text-destructive" : "text-cyan"}`}
    >
      {left <= 0 ? "Time over" : formatCountdown(left)}
    </span>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full border border-hairline bg-surface-2">
      <div
        className="brand-gradient h-full rounded-full transition-[width] duration-700"
        style={{ width: `${Math.max(3, percent)}%` }}
      />
    </div>
  );
}

/** Money card shown until the Personal Mentorship amount is complete. */
export function MentorshipFeeCard({ progress }: { progress: MemberProgress }) {
  return (
    <section className="raised-panel metal-edge space-y-4 rounded-3xl p-5">
      {progress.warning ? (
        <div
          className={`flex items-start gap-2 rounded-2xl border p-3 text-xs font-semibold ${
            progress.warningStage >= 3
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-amber-400/40 bg-amber-400/10 text-amber-300"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{progress.warning}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-cyan" />
        <h2 className="font-display text-base font-semibold">Personal Mentorship amount</h2>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold">{formatPkr(progress.feeTotal)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Total</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold text-cyan">{formatPkr(progress.feePaid)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Received</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold text-destructive">
            {formatPkr(progress.feeRemaining)}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Remaining</p>
        </div>
      </div>

      <Bar percent={progress.feePercent} />

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Clock className="h-4 w-4" /> Time left
        </span>
        <Countdown until={progress.dueAt} />
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Training, reels and every other section stay locked until your Personal Mentorship amount is
        complete. Pay the remaining amount and your admin will update it right away.
      </p>
    </section>
  );
}

/** "Your Target" card: next rank plus Case Credit progress. */
export function TargetCard({ progress }: { progress: MemberProgress }) {
  return (
    <section className="raised-panel metal-edge space-y-3 rounded-3xl p-5">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-cyan" />
        <h2 className="font-display text-base font-semibold">Your Target</h2>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Next rank</p>
          <p className="font-display text-lg font-bold">{progress.nextRank}</p>
        </div>
        {progress.ccTarget !== null ? (
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Required</p>
            <p className="font-display text-lg font-bold text-cyan">{progress.ccTarget} CC</p>
          </div>
        ) : null}
      </div>

      {progress.ccTarget !== null ? (
        <>
          <Bar percent={progress.ccPercent} />
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-cyan">{progress.ccDone} CC done</span>
            <span className="text-muted-foreground">{progress.ccRemaining} CC remaining</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{progress.requirementNote}</p>
      )}

      {progress.ccDueAt && (progress.ccRemaining ?? 0) > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Clock className="h-4 w-4" /> Time for this target
          </span>
          <Countdown until={progress.ccDueAt} />
        </div>
      ) : null}

      {progress.warning && progress.feeComplete ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs font-semibold text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{progress.warning}</span>
        </div>
      ) : null}
    </section>
  );
}
