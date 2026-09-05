import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Link2, Loader2, Radio, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/member/cards";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPremiereLink, deletePremiereLink, getLiveTrainingHub } from "@/lib/live.functions";

export const Route = createFileRoute("/live-training")({
  head: () => ({
    meta: [
      { title: "Live Training — Skyline Achievers" },
      {
        name: "description",
        content:
          "Schedule a Skyline Achievers live training premiere and share the generated link with your team.",
      },
      { property: "og:title", content: "Live Training — Skyline Achievers" },
      {
        property: "og:description",
        content: "Pick a session, set the date and time, and generate a premiere link.",
      },
    ],
  }),
  component: LiveTrainingPage,
});

function LiveTrainingPage() {
  const ready = useMemberGuard();
  const queryClient = useQueryClient();
  const load = useServerFn(getLiveTrainingHub);
  const create = useServerFn(createPremiereLink);
  const remove = useServerFn(deletePremiereLink);

  const { data, isPending } = useQuery({
    queryKey: ["live-training-hub"],
    queryFn: () => load(),
    enabled: ready,
    retry: false,
  });

  const [trainingId, setTrainingId] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: async () => {
      if (!trainingId) throw new Error("Select a session first.");
      if (!when) throw new Error("Select the date and time.");
      return create({ data: { trainingId, scheduledAt: new Date(when).toISOString() } });
    },
    onSuccess: (result) => {
      setGenerated(premiereUrl(result.token));
      toast.success("Premiere link generated");
      void queryClient.invalidateQueries({ queryKey: ["live-training-hub"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Link removed");
      void queryClient.invalidateQueries({ queryKey: ["live-training-hub"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <MemberShell title="Live training" subtitle="Schedule a session premiere">
      {!ready || isPending ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </div>
      ) : !data?.allowed ? (
        <EmptyState
          title="Live training is not unlocked for your rank"
          hint="Assistant Supervisor rank and above can schedule live sessions."
        />
      ) : (
        <div className="space-y-5 animate-rise-in">
          <section className="glass-panel-strong rounded-3xl p-5">
            <div className="mb-4 flex items-center gap-2">
              <Radio className="h-4 w-4 text-brand" />
              <h2 className="font-display text-base font-semibold">Select a session</h2>
            </div>

            {data.trainings.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No live training sessions are available yet.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {(data.trainings as any[]).map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setTrainingId(t.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                        trainingId === t.id
                          ? "border-brand bg-brand/10 scale-[1.01]"
                          : "border-hairline hover:border-brand/50"
                      }`}
                    >
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                        {t.thumbnail_url ? (
                          <img
                            src={t.thumbnail_url}
                            alt={t.title}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{t.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t.aspect_ratio ?? "16:9"}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label>Premiere date and time</Label>
                <Input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </div>
              <Button
                variant="brand"
                size="xl"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
              >
                {generate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Generate link
              </Button>
            </div>

            {generated ? (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-brand/40 bg-brand/10 p-3">
                <p className="min-w-0 flex-1 truncate text-xs">{generated}</p>
                <Button variant="outline" size="sm" onClick={() => void copy(generated)}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            ) : null}
          </section>

          <section className="glass-panel rounded-3xl p-5">
            <h2 className="mb-3 font-display text-base font-semibold">Your premiere links</h2>
            {(data.premieres as any[]).length === 0 ? (
              <p className="text-xs text-muted-foreground">No premiere links yet.</p>
            ) : (
              <ul className="space-y-2">
                {(data.premieres as any[]).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl border border-hairline p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {p.live_trainings?.title ?? "Session"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(p.scheduled_at).toLocaleString()} · /live/{p.token}
                      </p>
                    </div>
                    <button
                      onClick={() => void copy(premiereUrl(p.token))}
                      className="text-muted-foreground transition-colors hover:text-brand"
                      aria-label="Copy premiere link"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => del.mutate(p.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Delete premiere link"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </MemberShell>
  );
}

function premiereUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/live/${token}`;
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Link copied");
  } catch {
    toast.error("Copy failed — long press the link to copy it.");
  }
}
