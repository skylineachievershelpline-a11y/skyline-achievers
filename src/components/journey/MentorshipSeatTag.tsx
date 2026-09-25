import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Sparkles } from "lucide-react";

import { getMentorshipSeats } from "@/lib/journey.functions";

/** Seats shown on the tag even when the policy keeps a smaller internal number. */
const DISPLAY_TOTAL = 15;

/**
 * Premium "locking" tag that sits next to the trainee name / ID / picture and
 * shows how many Personal Mentorship seats are still open.
 */
export function MentorshipSeatTag({ className = "" }: { className?: string }) {
  const load = useServerFn(getMentorshipSeats);
  const { data } = useQuery({
    queryKey: ["mentorship-seats-tag"],
    queryFn: () => load(),
    staleTime: 60_000,
  });

  const total = Math.max(DISPLAY_TOTAL, Number(data?.total ?? 0));
  const left = Math.max(0, Math.min(Number(data?.available ?? 2), total));

  return (
    <span
      className={`relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-brand/45 bg-surface-2/70 px-3 py-1.5 shadow-brand backdrop-blur-md ${className}`}
    >
      <span className="absolute inset-0 -z-10 brand-gradient opacity-[0.18]" aria-hidden />
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-brand/50 bg-background/60">
        <Lock className="h-3 w-3 text-brand-glow" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Personal Mentorship
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums text-brand-glow">
          <Sparkles className="h-3 w-3" />
          {left} of {total} seats left
        </span>
      </span>
    </span>
  );
}
