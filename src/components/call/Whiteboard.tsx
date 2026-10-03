/** Teaching whiteboard drawn by Skyline AI Teacher during a class. */
import type { WhiteboardData } from "@/lib/live-relay.types";
import { cn } from "@/lib/utils";

export function Whiteboard({ board, compact = false }: { board: WhiteboardData | null; compact?: boolean }) {
  if (!board) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center rounded-2xl border border-dashed border-cyan/30 p-4 text-center text-xs text-muted-foreground">
        Whiteboard — Skyline AI yahan likh kar aur bana kar samjhayega
      </div>
    );
  }
  const max = Math.max(1, ...(board.chart?.bars.map((b) => b.value) ?? [1]));
  return (
    <div className={cn("whiteboard-surface rounded-2xl border border-cyan/30 p-4", compact ? "max-h-64 overflow-y-auto" : "")}>
      <p className="whiteboard-ink font-display text-lg font-bold">{board.title}</p>
      {board.flow.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {board.flow.map((step, i) => (
            <div key={`${step}-${i}`} className="flex items-center gap-1.5">
              <span className="whiteboard-pop rounded-xl border-2 border-cyan/60 px-2.5 py-1.5 text-xs font-bold" style={{ animationDelay: `${i * 180}ms` }}>
                {step}
              </span>
              {i < board.flow.length - 1 ? <span className="text-cyan">→</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      {board.items.length ? (
        <ol className="mt-3 space-y-1.5">
          {board.items.map((item, i) => (
            <li key={`${item.text}-${i}`} className="whiteboard-pop flex gap-2 text-sm" style={{ animationDelay: `${(board.flow.length + i) * 180}ms` }}>
              <span className="w-6 shrink-0 text-center">{item.icon || `${i + 1}.`}</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {board.chart && board.chart.bars.length ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase text-cyan">{board.chart.caption}</p>
          <div className="mt-2 flex h-28 items-end gap-2">
            {board.chart.bars.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="whiteboard-bar w-full rounded-t-lg bg-cyan/70" style={{ height: `${(b.value / max) * 100}%` }} />
                <span className="text-[10px] text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
