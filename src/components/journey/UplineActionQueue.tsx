import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getUplineActionQueue } from "@/lib/journey.functions";
import { TraineeProgressRecord } from "./TraineeProgressRecord";

/** The upline's "action required" list across every trainee in the team. */
export function UplineActionQueue({ ready }: { ready: boolean }) {
  const load = useServerFn(getUplineActionQueue);
  const [openTrainee, setOpenTrainee] = useState<{
    id: string;
    name: string;
    phone: string | null;
  } | null>(null);

  const { data } = useQuery({
    queryKey: ["upline-action-queue"],
    queryFn: () => load(),
    enabled: ready,
    retry: false,
  });

  const rows = (data?.items ?? []) as any[];
  if (rows.length === 0) return null;

  return (
    <>
      <section className="raised-panel metal-edge mt-6 rounded-3xl p-5 animate-rise-in">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-brand-glow">
            <BellRing className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Action required
            </p>
            <p className="text-[11px] text-muted-foreground">
              Your trainees are waiting on these steps
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.traineeId} className="glass-panel rounded-2xl p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.code} · {row.action?.now ?? "Keep following up"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={row.action?.owner === "upline" ? "brand" : "outline"}
                  className="shrink-0 rounded-xl"
                  onClick={() =>
                    setOpenTrainee({
                      id: row.traineeId,
                      name: row.name,
                      phone: row.phone ?? null,
                    })
                  }
                >
                  {row.pendingReviewSession
                    ? "Review now"
                    : row.action?.owner === "upline"
                      ? "Open"
                      : "View"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {openTrainee ? (
        <TraineeProgressRecord
          traineeId={openTrainee.id}
          traineeName={openTrainee.name}
          onClose={() => setOpenTrainee(null)}
        />
      ) : null}
    </>
  );
}
