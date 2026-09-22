import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, Eye, EyeOff, ListChecks } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getDailyReport } from "@/lib/daily-report.functions";
import { formatPkr } from "@/lib/mentorship";
import { getUplineActionQueue } from "@/lib/journey.functions";

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const pktNow = () => new Date(Date.now() + PKT_OFFSET_MS);
const pktDate = () => pktNow().toISOString().slice(0, 10);
const pktHour = () => pktNow().getUTCHours();

type Item = { id: string; text: string; tone: "info" | "urgent" };

/**
 * The reminder list the website builds by itself every morning at 6 AM Pakistan
 * time. It closes at midnight, can be hidden, and every finished job is ticked.
 */
export function DailyTodoList({
  remaining,
  deadline,
}: {
  remaining?: number | null;
  deadline?: string | null;
}) {
  const [day, setDay] = useState(pktDate());
  const [hidden, setHidden] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const loadReport = useServerFn(getDailyReport);
  const loadQueue = useServerFn(getUplineActionQueue);

  const report = useQuery({
    queryKey: ["daily-report"],
    queryFn: () => loadReport(),
    retry: false,
  });
  const queue = useQuery({
    queryKey: ["upline-action-queue"],
    queryFn: () => loadQueue(),
    retry: false,
  });

  // Keep the list tied to the Pakistan calendar day: it disappears at midnight.
  useEffect(() => {
    const timer = window.setInterval(() => setDay(pktDate()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setHidden(window.localStorage.getItem(`skyline-todo-hidden-${day}`) === "1");
    try {
      setDone(JSON.parse(window.localStorage.getItem(`skyline-todo-done-${day}`) ?? "[]"));
    } catch {
      setDone([]);
    }
  }, [day]);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    if (report.data && !report.data.todaySubmitted) {
      list.push({
        id: "report",
        text: report.data.windowOpen
          ? "Aaj ka daily working report submit karein (12 baje tak)."
          : `Aaj ka daily report ${report.data.openHourLabel} ke baad submit karna hai.`,
        tone: report.data.windowOpen ? "urgent" : "info",
      });
    }
    if (remaining && remaining > 0) {
      list.push({
        id: "payment",
        text: `Personal Mentorship ki baqi raqam ${formatPkr(remaining)} complete karein${
          deadline ? ` — last date ${new Date(deadline).toLocaleDateString("en-GB")}` : ""
        }.`,
        tone: "urgent",
      });
    }
    for (const row of (queue.data?.items ?? []) as any[]) {
      list.push({
        id: `trainee-${row.traineeId}`,
        text: `${row.name} (${row.code}): ${row.action?.now ?? "follow up karein"}`,
        tone: row.pendingReviewSession ? "urgent" : "info",
      });
    }
    return list;
  }, [report.data, queue.data, remaining, deadline]);

  // The list only lives between 6 AM and midnight Pakistan time.
  if (pktHour() < 6) return null;
  if (items.length === 0) return null;

  function persistHidden(next: boolean) {
    setHidden(next);
    window.localStorage.setItem(`skyline-todo-hidden-${day}`, next ? "1" : "0");
  }

  function toggleDone(id: string) {
    const next = done.includes(id) ? done.filter((value) => value !== id) : [...done, id];
    setDone(next);
    window.localStorage.setItem(`skyline-todo-done-${day}`, JSON.stringify(next));
  }

  const openCount = items.filter((item) => !done.includes(item.id)).length;

  return (
    <section className="raised-panel metal-edge rounded-3xl p-5 animate-rise-in">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-brand-glow">
          <ListChecks className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold">Aaj ka kaam</p>
          <p className="text-[11px] text-muted-foreground">
            {openCount === 0 ? "Sab kaam mukammal — shabash!" : `${openCount} kaam baqi hain`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 rounded-xl"
          onClick={() => persistHidden(!hidden)}
        >
          {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {hidden ? "Show" : "Hide"}
        </Button>
      </div>

      {hidden ? null : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => {
            const ticked = done.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggleDone(item.id)}
                  className={`glass-panel flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors ${
                    ticked ? "opacity-60" : ""
                  }`}
                >
                  {ticked ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
                  ) : (
                    <Circle
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        item.tone === "urgent" ? "text-brand-glow" : "text-muted-foreground"
                      }`}
                    />
                  )}
                  <span className={`text-xs leading-5 ${ticked ? "line-through" : ""}`}>
                    {item.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
