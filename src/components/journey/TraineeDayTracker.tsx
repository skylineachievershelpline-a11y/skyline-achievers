import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUplineActionQueue } from "@/lib/journey.functions";
import { TraineeProgressRecord } from "./TraineeProgressRecord";

const DAYS = [1, 2, 3, 4, 5, 6, 7, 8];
const pkt = (offsetDays = 0) =>
  new Date(Date.now() + 5 * 3600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);

/** Preferred Customers grouped by their current training day, with date filters. */
export function TraineeDayTracker({ ready }: { ready: boolean }) {
  const load = useServerFn(getUplineActionQueue);
  const { data } = useQuery({
    queryKey: ["upline-action-queue"],
    queryFn: () => load(),
    enabled: ready,
    retry: false,
  });
  const [period, setPeriod] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [day, setDay] = useState<number | null>(null);
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null);

  const today = pkt();
  const range =
    period === "today" ? [today, today]
    : period === "week" ? [pkt(6), today]
    : period === "month" ? [`${today.slice(0, 8)}01`, today]
    : period === "custom" ? [from || "0000", to || "9999"]
    : null;

  const all = ((data?.items ?? []) as any[]).filter((row) => {
    if (!range) return true;
    const joined = String(row.joinedAt ?? "").slice(0, 10);
    return joined >= (range[0] ?? "") && joined <= (range[1] ?? "9999");
  });
  const rows = day ? all.filter((row) => row.currentDay === day) : all;

  return (
    <section className="raised-panel metal-edge mt-6 rounded-3xl p-5 animate-rise-in">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <CalendarDays className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Training tracker</p>
          <p className="text-[11px] text-muted-foreground">Kon kis din par hai — tap a day to filter</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {([["all", "All"], ["today", "Today"], ["week", "Weekly"], ["month", "Monthly"], ["custom", "Custom"]] as const).map(([key, label]) => (
          <Button key={key} size="sm" variant={period === key ? "default" : "outline"} className="rounded-2xl" onClick={() => setPeriod(key)}>
            {label}
          </Button>
        ))}
      </div>
      {period === "custom" ? (
        <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
          <Input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <Input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {DAYS.map((d) => {
          const count = all.filter((row) => row.currentDay === d).length;
          const active = day === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(active ? null : d)}
              className={`glass-panel rounded-2xl p-2 text-center transition ${active ? "ring-2 ring-primary" : ""}`}
            >
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{d === 8 ? "Session 08" : `Day ${String(d).padStart(2, "0")}`}</p>
              <p className="font-display text-lg font-bold text-primary">{count}</p>
            </button>
          );
        })}
      </div>

      <ul className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <li className="text-center text-xs text-muted-foreground">No trainees here.</li>
        ) : (
          rows.map((row) => (
            <li key={row.traineeId}>
              <button
                type="button"
                onClick={() => setOpen({ id: row.traineeId, name: row.name })}
                className="glass-panel flex w-full items-center gap-3 rounded-2xl p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{row.code}</p>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                  {row.currentDay === 8 ? "Session 08" : `Day ${String(row.currentDay).padStart(2, "0")}`}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      {open ? (
        <TraineeProgressRecord traineeId={open.id} traineeName={open.name} onClose={() => setOpen(null)} />
      ) : null}
    </section>
  );
}
