import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { toast } from "sonner";

import { EmptyState, TrainingVideoCard } from "@/components/member/cards";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { Input } from "@/components/ui/input";
import { getTrainingLibrary } from "@/lib/member.functions";
import { RELATED_THRESHOLD, relevance, tokenize } from "@/lib/search-match";

export const Route = createFileRoute("/training")({
  head: () => ({
    meta: [
      { title: "Training Videos — Skyline Achievers" },
      {
        name: "description",
        content:
          "Open any Skyline Achievers training section — podcast, motivational or core training — and watch every video unlocked for your rank.",
      },
      { property: "og:title", content: "Training Videos — Skyline Achievers" },
      {
        property: "og:description",
        content: "Browse Skyline Achievers training by section: podcast, motivational and more.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrainingPage,
});

type Section = {
  id: string;
  name: string;
  description: string | null;
  group_id?: string | null;
};

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
  const sections = ((data?.categories ?? []) as Section[]).slice();
  const hasLoose = all.some((video) => !video.category_id);
  const visibleSections: Section[] = hasLoose
    ? [...sections, { id: "__none", name: "Other videos", description: null, group_id: null }]
    : sections;
  const tokens = tokenize(query);
  const videosBySection = useMemo(
    () =>
      visibleSections
        .map((section) => {
          const inSection = all.filter((video) =>
            section.id === "__none" ? !video.category_id : video.category_id === section.id,
          );
          const videos =
            tokens.length === 0
              ? inSection
              : inSection
                  .map((video) => ({
                    video,
                    score: relevance(tokens, {
                      fields: [
                        { text: video.title, weight: 1 },
                        { text: video.description, weight: 0.8 },
                        { text: section.name, weight: 0.4 },
                      ],
                    }),
                  }))
                  .filter((item) => item.score >= RELATED_THRESHOLD)
                  .sort((a, b) => b.score - a.score)
                  .map((item) => item.video);
          return { section, videos, total: inSection.length };
        })
        .filter((entry) => entry.total > 0 || tokens.length === 0),
    [all, tokens, visibleSections],
  );

  return (
    <MemberShell title="Training" subtitle="Your training library" executive>
      <div className="raised-panel metal-edge rounded-3xl p-5 animate-rise-in">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Skyline training library
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">Training Videos</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Every unlocked section is open below — Prospecting, Sales and every other training area show directly here.
        </p>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search all training videos"
            className="h-11 rounded-2xl pl-9"
          />
        </div>
      </div>

      {!ready || isPending ? (
        <div className="flex justify-center py-14">
          <SkylineLoader />
        </div>
      ) : visibleSections.length === 0 ? (
        <section className="mt-6">
          <SectionTitle>Training Sections</SectionTitle>
          <EmptyState
            title="No training sections yet"
            hint="Training sections appear here as soon as they are published."
          />
        </section>
      ) : videosBySection.every((entry) => entry.videos.length === 0) ? (
        <section className="mt-6">
          <SectionTitle>No matching videos</SectionTitle>
          <EmptyState title="No video matched your search" hint="Try a different word." />
        </section>
      ) : (
        <div className="mt-6 space-y-8">
          {videosBySection.map(({ section, videos, total }, sectionIndex) => (
            <section
              key={section.id}
              className="animate-rise-in"
              style={{ animationDelay: `${Math.min(sectionIndex, 8) * 40}ms` }}
            >
              <div className="mb-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <SectionTitle>{section.name}</SectionTitle>
                  {section.description ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{section.description}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full border border-metal/30 bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {total} video{total === 1 ? "" : "s"}
                </span>
              </div>
              {videos.length === 0 ? (
                <EmptyState title="No matching videos here" />
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
          ))}
        </div>
      )}
    </MemberShell>
  );
}