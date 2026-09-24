import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, Eye, EyeOff, ListChecks } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getDailyReport } from "@/lib/daily-report.functions";
import { formatPkr } from "@/lib/mentorship";
import { getUplineActionQueue } from "@/lib/journey.functions";
import { getMyFboTeam } from "@/lib/team.functions";
import { Link } from "@tanstack/react-router";
import { TraineeProgressRecord } from "@/components/journey/TraineeProgressRecord";

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const pktNow = () => new Date(Date.now() + PKT_OFFSET_MS);
const pktDate = () => pktNow().toISOString().slice(0, 10);
const pktHour = () => pktNow().getUTCHours();

type Person = { id: string; name: string; trainee?: boolean };
type Item = { id: string; text: string; tone: "info" | "urgent"; people?: Person[]; link?: string; linkLabel?: string };

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

  const loadTeam = useServerFn(getMyFboTeam);
  const [openTrainee, setOpenTrainee] = useState<{ id: string; name: string } | null>(null);
  const team = useQuery({ queryKey: ["my-fbo-team"], queryFn: () => loadTeam(), retry: false });
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
    if (report.data && !(report.data as any).trainingOnly && !report.data.todaySubmitted) {
      list.push({
        id: "report",
        text: report.data.windowOpen
          ? "Submit today's daily working report (before 12 midnight)."
          : `Today's daily report opens after ${report.data.openHourLabel}.`,
        tone: report.data.windowOpen ? "urgent" : "info",
      });
    }
    if (remaining && remaining > 0) {
      list.push({
        id: "payment",
        text: `Complete the remaining Personal Mentorship amount of ${formatPkr(remaining)}${
          deadline ? ` — last date ${new Date(deadline).toLocaleDateString("en-GB")}` : ""
        }.`,
        tone: "urgent",
      });
    }
    const trainees = (queue.data?.items ?? []) as any[];
    for (let d = 1; d <= 4; d += 1) {
      const people = trainees.filter((row) => row.currentDay === d).map((row) => ({ id: row.traineeId, name: row.name, trainee: true }));
      if (people.length) list.push({ id: `day-${d}`, text: `Aaj in ka Day ${String(d).padStart(2, "0")} hai (${people.length}):`, tone: "info", people });
    }
    const pending = trainees.filter((row) => row.pendingReviewSession).map((row) => ({ id: row.traineeId, name: `${row.name} · Session ${String(row.pendingReviewSession).padStart(2, "0")}`, trainee: true }));
    if (pending.length) list.push({ id: "reviews", text: `In ke reviews abhi approve nahi hue — tap karke approve karein (${pending.length}):`, tone: "urgent", people: pending });
    const today = pktDate();
    const due = ((team.data?.team ?? []) as any[]).filter(
      (p) => p.kind === "mentorship" && (p.payment?.remaining ?? 0) > 0 && p.payment?.dueAt && new Date(new Date(p.payment.dueAt).getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10) === today,
    );
    if (due.length) list.push({ id: "pm-due", text: `Aaj Personal Mentorship ki due date: ${due.map((p) => `${p.fullName} (${formatPkr(p.payment.remaining)} baqi)`).join(", ")}`, tone: "urgent", link: "/team", linkLabel: "Team kholein" });
    list.push({ id: "training", text: "Aaj kam az kam ek training zaroor dekhein.", tone: "info", link: "/training", linkLabel: "Training kholein" });
    return list;
  }, [report.data, queue.data, team.data, remaining, deadline]);

  // The list appears at 8 AM and lives until midnight Pakistan time.
  if (pktHour() < 8) return null;
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
          <p className="font-display text-sm font-semibold">Today's to-do list</p>
          <p className="text-[11px] text-muted-foreground">
            {openCount === 0 ? "All done — great work!" : `${openCount} task${openCount === 1 ? "" : "s"} remaining`}
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
              <li key={item.id} className={`glass-panel rounded-2xl p-3 ${ticked ? "opacity-60" : ""}`}>
                <button type="button" onClick={() => toggleDone(item.id)} className="flex w-full items-start gap-3 text-left">
                  {ticked ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
                  ) : (
                    <Circle className={`mt-0.5 h-4 w-4 shrink-0 ${item.tone === "urgent" ? "text-brand-glow" : "text-muted-foreground"}`} />
                  )}
                  <span className={`text-xs leading-5 ${ticked ? "line-through" : ""}`}>{item.text}</span>
                </button>
                {item.people?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                    {item.people.map((person) => (
                      <button key={item.id + person.id} type="button" onClick={() => setOpenTrainee({ id: person.id, name: person.name })} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        {person.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                {item.link ? (
                  <div className="mt-2 pl-7">
                    <Link to={item.link as any} className="text-[11px] font-semibold text-primary underline">{item.linkLabel}</Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {openTrainee ? (
        <TraineeProgressRecord traineeId={openTrainee.id} traineeName={openTrainee.name} onClose={() => setOpenTrainee(null)} />
      ) : null}
    </section>
  );
}
