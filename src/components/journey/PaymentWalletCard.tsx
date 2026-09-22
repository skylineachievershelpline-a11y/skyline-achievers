import { AlertTriangle, Wallet } from "lucide-react";

import { countdownText } from "@/lib/journey";
import { formatDateTime } from "@/lib/format";
import { useNow } from "./useCountdown";

function pkr(value: number): string {
  return `Rs. ${Math.round(value).toLocaleString("en-PK")}`;
}

export type WalletData = {
  required: number;
  verified: number;
  remaining: number;
  ccTarget: number;
  ccVerified: number;
  ccRemaining: number;
  pendingCount: number;
  history: {
    id: string;
    purpose: string;
    claimed: number;
    verified: number;
    status: string;
    adminNote: string | null;
    createdAt: string;
    verifiedAt: string | null;
  }[];
};

const PURPOSE_LABEL: Record<string, string> = {
  mentorship: "Personal Mentorship",
  two_cc: "2CC",
};

/**
 * The wallet only ever shows amounts the office has verified. It is a record of
 * training payments, not withdrawable money.
 */
export function PaymentWalletCard({
  wallet,
  dueAt,
  showCc,
}: {
  wallet: WalletData;
  dueAt: string | null;
  showCc?: boolean;
}) {
  const now = useNow(Boolean(dueAt) && wallet.remaining > 0);
  const dueMs = dueAt ? new Date(dueAt).getTime() - now : null;
  const partial = wallet.verified > 0 && wallet.remaining > 0;

  return (
    <section className="raised-panel mt-5 overflow-hidden rounded-[28px] p-5 animate-rise-in">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-brand-glow">
          <Wallet className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Skyline Achievers Payment Wallet
          </p>
          <p className="text-[11px] text-muted-foreground">
            A record of your verified training payments — not withdrawable money.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="inset-panel rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Required</p>
          <p className="mt-1 font-display text-base font-semibold tabular-nums">
            {pkr(wallet.required)}
          </p>
        </div>
        <div className="inset-panel rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Verified</p>
          <p className="mt-1 font-display text-base font-semibold tabular-nums text-brand-glow">
            {pkr(wallet.verified)}
          </p>
        </div>
        <div className="inset-panel rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Remaining</p>
          <p className="mt-1 font-display text-base font-semibold tabular-nums">
            {pkr(wallet.remaining)}
          </p>
        </div>
      </div>

      {wallet.remaining === 0 && wallet.verified > 0 ? (
        <p className="mt-4 rounded-2xl border border-cyan/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-brand-glow">
          ✅ Personal Mentorship payment completed
        </p>
      ) : partial ? (
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" /> Payment not complete yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pkr(wallet.remaining)} is still remaining. Complete it to keep the lower 2CC
            requirement of {pkr(wallet.ccTarget)}.
          </p>
          {dueMs !== null ? (
            <p className="mt-2 font-mono text-lg tabular-nums text-amber-300">
              {dueMs > 0 ? countdownText(dueMs) : "Time is up — talk to your upline today"}
            </p>
          ) : null}
        </div>
      ) : null}

      {wallet.pendingCount > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {wallet.pendingCount} payment {wallet.pendingCount === 1 ? "claim is" : "claims are"}{" "}
          waiting for the office to verify the amount received.
        </p>
      ) : null}

      {showCc ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="inset-panel rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              2CC target
            </p>
            <p className="mt-1 font-display text-base font-semibold tabular-nums">
              {pkr(wallet.ccTarget)}
            </p>
          </div>
          <div className="inset-panel rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              2CC verified
            </p>
            <p className="mt-1 font-display text-base font-semibold tabular-nums text-brand-glow">
              {pkr(wallet.ccVerified)}
            </p>
          </div>
          <div className="inset-panel rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              2CC remaining
            </p>
            <p className="mt-1 font-display text-base font-semibold tabular-nums">
              {pkr(wallet.ccRemaining)}
            </p>
          </div>
        </div>
      ) : null}

      {wallet.history.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {wallet.history.map((row) => (
            <li key={row.id} className="glass-panel rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">
                  {PURPOSE_LABEL[row.purpose] ?? row.purpose}
                </p>
                <span
                  className={
                    row.status === "verified"
                      ? "text-[11px] font-semibold text-brand-glow"
                      : row.status === "rejected"
                        ? "text-[11px] font-semibold text-destructive"
                        : "text-[11px] font-semibold text-amber-300"
                  }
                >
                  {row.status === "verified"
                    ? "Verified"
                    : row.status === "rejected"
                      ? "Rejected"
                      : "Pending verification"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Submitted {formatDateTime(row.createdAt)} · claimed {pkr(row.claimed)}
                {row.status === "verified" ? ` · verified ${pkr(row.verified)}` : ""}
                {row.verifiedAt ? ` · checked ${formatDateTime(row.verifiedAt)}` : ""}
              </p>
              {row.adminNote ? (
                <p className="mt-1 text-[11px] text-muted-foreground">Note: {row.adminNote}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
