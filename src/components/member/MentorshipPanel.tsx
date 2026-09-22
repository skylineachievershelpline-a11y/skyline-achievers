import { AlertTriangle, Clock, Lock, ReceiptText, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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
export function MentorshipFeeCard({
  progress,
  onPrintReceipt,
  ccTargets,
}: {
  progress: MemberProgress;
  onPrintReceipt?: () => void;
  ccTargets?: { full: number; partial: number } | null;
}) {
  return (
    <section className="raised-panel metal-edge space-y-4 rounded-3xl p-5">
      {ccTargets ? (
        <div className="space-y-2 rounded-2xl border border-cyan/30 bg-cyan/5 p-3 text-xs leading-5">
          <p className="font-display text-sm font-bold text-cyan">
            Special 2CC Offer — zaroor parhein
          </p>
          <p className="text-muted-foreground">
            Agar aap neeche diye gaye time ke andar apni Personal Mentorship ki remaining amount
            complete kar lete hain, to aapka 2CC{" "}
            <span className="font-bold text-foreground">{formatPkr(ccTargets.partial)}</span> ka
            nahi, balke Personal Mentorship ki wajah se discount ke sath sirf{" "}
            <span className="font-bold text-cyan">{formatPkr(ccTargets.full)}</span> ka hoga.
          </p>
          <p className="text-muted-foreground">
            Lekin agar aap is time ke andar amount complete nahi karte, to yeh offer aap ke liye
            khatam ho jayegi aur aap ka 2CC {formatPkr(ccTargets.full)} ki jagah{" "}
            <span className="font-bold text-foreground">{formatPkr(ccTargets.partial)}</span> ka ho
            jayega. Aap ka dashboard aur training phir bhi khula rahega.
          </p>
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

      <Button asChild variant="brand" size="xl" className="w-full rounded-2xl font-display">
        <Link to="/pay-mentorship">
          <Wallet className="h-4 w-4" />
          Pay remaining amount
        </Link>
      </Button>

      {progress.feePaid > 0 && onPrintReceipt ? (
        <Button type="button" variant="outline" className="w-full rounded-2xl font-display" onClick={onPrintReceipt}>
          <ReceiptText className="h-4 w-4" />
          Print Personal Mentorship receipt
        </Button>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Clock className="h-4 w-4" /> Time left
        </span>
        <Countdown until={progress.dueAt} />
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Your dashboard stays open. Complete the remaining amount before the deadline to keep the
        lower 2CC target — your verified amount updates as soon as the admin checks your payment.
      </p>
    </section>
  );
}

/** Shown once the Personal Mentorship amount is complete: the 2CC money view. */
export function CcAmountCard({
  money,
}: {
  money: { total: number; received: number; remaining: number; discounted: boolean };
}) {
  const percent = money.total ? Math.min(100, Math.round((money.received / money.total) * 100)) : 0;
  return (
    <section className="raised-panel metal-edge space-y-4 rounded-3xl p-5">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-cyan" />
        <h2 className="font-display text-base font-semibold">2CC amount</h2>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold">{formatPkr(money.total)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Total</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold text-cyan">{formatPkr(money.received)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Received</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold text-destructive">
            {formatPkr(money.remaining)}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Remaining</p>
        </div>
      </div>

      <Bar percent={percent} />

      <p className="text-xs leading-5 text-muted-foreground">
        Aap ki Personal Mentorship amount complete ho gayi hai — us ki wajah se aap ka 2CC target{" "}
        <span className="font-bold text-cyan">{formatPkr(money.total)}</span> hai. Received mein aap
        ki verified amount shamil hai, baqi{" "}
        <span className="font-bold text-foreground">{formatPkr(money.remaining)}</span> complete
        karni hai.
      </p>
    </section>
  );
}
