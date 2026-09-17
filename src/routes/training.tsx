import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { toast } from "sonner";

import { EmptyState, TrainingVideoCard } from "@/components/member/cards";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { Input } from "@/components/ui/input";
import { getTrainingLibrary } from "@/lib/member.functions";

export const Route = createFileRoute("/training")({
  head: () => ({
    meta: [
      { title: "Training Videos — Skyline Achievers" },
      {
        name: "description",
        content:
          "Watch every Skyline Achievers training video unlocked for your rank, from first steps to advanced online earning skills.",
      },
      { property: "og:title", content: "Training Videos — Skyline Achievers" },
      {
        property: "og:description",
        content: "Every training video unlocked for your Skyline Achievers rank.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrainingPage,
});

function TrainingPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getTrainingLibrary);
  const [query, setQuery] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["training-library"],
    queryFn: () => load(),
    enabled: ready,
  });

  const all = (data?.videos ?? []) as any[];
  const videos = all.filter((video) =>
    query.trim() ? String(video.title ?? "").toLowerCase().includes(query.trim().toLowerCase()) : true,
  );
  const unlocked = all.filter((video) => !video.locked).length;

  return (
    <MemberShell title="Training" subtitle="Your training library" executive>
      <div className="raised-panel metal-edge rounded-3xl p-5 animate-rise-in">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Skyline training library
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">Training videos</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {unlocked} of {all.length} videos unlocked for your rank. Locked ones open as you rise.
        </p>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search training videos"
          className="mt-4 h-11 rounded-2xl"
        />
      </div>

      <section className="mt-6">
        <SectionTitle>All videos</SectionTitle>
        {!ready || isPending ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : videos.length === 0 ? (
          <EmptyState
            title="No training videos yet"
            hint="Nothing has been published yet — check back soon."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video: any, index: number) => (
              <div
                key={video.id}
                className="animate-rise-in"
                style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
              >
                <TrainingVideoCard
                  video={video}
                  onLocked={() =>
                    toast.info(
                      video.levels?.name
                        ? `This video opens at ${video.levels.name}. Keep going — you are close!`
                        : "This video is locked for your rank right now.",
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </MemberShell>
  );
}
