import { GraduationCap } from "lucide-react";

import { formatDateTime12 } from "@/lib/format";

/**
 * A premium tag that hangs from two cords at the very top of the trainee
 * dashboard and shows the scheduled Final Interview date and time in Pakistan
 * time. It only appears once the upline has set a time.
 */
export function InterviewTimeTag({ scheduledAt }: { scheduledAt: string | null }) {
  if (!scheduledAt) return null;
  return (
    <div className="pointer-events-none flex justify-center">
      <div className="seat-tag-swing flex flex-col items-center">
        <span className="flex items-end gap-10" aria-hidden>
          <span className="h-7 w-px bg-gradient-to-b from-transparent via-hairline to-brand/60" />
          <span className="h-7 w-px bg-gradient-to-b from-transparent via-hairline to-brand/60" />
        </span>
        <span className="glass-panel metal-edge -mt-px rounded-2xl border border-red-500/40 px-5 py-2.5 text-center shadow-glass">
          <span className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-red-300">
            <GraduationCap className="h-3.5 w-3.5" />
            Final Interview
          </span>
          <span className="mt-1 block font-display text-sm font-semibold text-foreground">
            {formatDateTime12(scheduledAt)}
          </span>
          <span className="mt-0.5 block text-[10px] tracking-[0.16em] text-brand-glow">PKT</span>
        </span>
      </div>
    </div>
  );
}
