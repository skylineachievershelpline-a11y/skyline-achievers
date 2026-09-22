import { Clock, Compass, UserCheck } from "lucide-react";

import { countdownText, type NextAction } from "@/lib/journey";
import { formatDateTime } from "@/lib/format";
import { useNow } from "./useCountdown";

const OWNER_LABEL: Record<NextAction["owner"], string> = {
  trainee: "You",
  upline: "Your upline",
  admin: "Skyline Achievers office",
};

/** The always-visible "where am I and what do I do now" panel. */
export function WhatDoINowCard({ action }: { action: NextAction }) {
  const now = useNow(Boolean(action.dueAt));
  const dueMs = action.dueAt ? new Date(action.dueAt).getTime() - now : null;

  return (
    <section className="raised-panel relative overflow-hidden rounded-[28px] p-5 animate-rise-in">
      <span className="connector-line absolute inset-x-0 top-0 h-1" aria-hidden />
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-brand-glow">
          <Compass className="h-4 w-4" />
        </span>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          What do I do now?
        </p>
      </div>

      <p className="mt-3 font-display text-lg font-semibold tracking-tight">{action.where}</p>
      <p className="mt-1 text-sm text-foreground">{action.now}</p>
      <p className="mt-2 text-xs text-muted-foreground">Next: {action.next}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="inset-panel flex items-center gap-2 rounded-2xl px-3 py-2.5">
          <UserCheck className="h-4 w-4 text-brand-glow" />
          <span className="text-xs text-muted-foreground">
            Action by <span className="text-foreground">{OWNER_LABEL[action.owner]}</span>
          </span>
        </div>
        <div className="inset-panel flex items-center gap-2 rounded-2xl px-3 py-2.5">
          <Clock className="h-4 w-4 text-brand-glow" />
          <span className="text-xs text-muted-foreground">
            {action.dueAt ? (
              dueMs !== null && dueMs > 0 ? (
                <>
                  Opens in{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {countdownText(dueMs)}
                  </span>
                </>
              ) : (
                <>Open since {formatDateTime(action.dueAt)}</>
              )
            ) : (
              "No deadline right now"
            )}
          </span>
        </div>
      </div>
    </section>
  );
}
