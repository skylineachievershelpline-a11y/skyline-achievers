import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Loader2, PlayCircle } from "lucide-react";
import { useState } from "react";

import { toast } from "sonner";

import { EmptyState, TrainingVideoCard } from "@/components/member/cards";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTrainingLibrary } from "@/lib/member.functions";
import { RELATED_THRESHOLD, relevance, tokenize } from "@/lib/search-match";

import { cn } from "@/lib/utils";

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
type Bucket = { id: string; name: string };

function TrainingPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getTrainingLibrary);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["training-library"],
    queryFn: () => load(),
    enabled: ready,
  });

  const all = (data?.videos ?? []) as any[];
  const sections = ((data?.categories ?? []) as Section[]).slice();
  const hasLoose = all.some((video) => !video.category_id);
  const menu: Section[] = hasLoose
    ? [...sections, { id: "__none", name: "Other videos", description: null, group_id: null }]
    : sections;

  const active = menu.find((section) => section.id === openSection) ?? null;

  // Sections are grouped under the categories the admin created (Sales, Mindset…).
  const buckets = ((data as any)?.groups ?? []) as Bucket[];
  const grouped: { bucket: Bucket; items: Section[] }[] = [];
  for (const bucket of buckets) {
    const items = menu.filter((section) => section.group_id === bucket.id);
    if (items.length > 0) grouped.push({ bucket, items });
  }
  const ungrouped = menu.filter(
    (section) => !section.group_id || !buckets.some((b) => b.id === section.group_id),
  );
  if (ungrouped.length > 0) {
    grouped.push({ bucket: { id: "__other", name: "More sections" }, items: ungrouped });
  }

  const inSection = active
    ? all.filter((video) =>
        active.id === "__none" ? !video.category_id : video.category_id === active.id,
      )
    : [];
  // Related topics count as a match too, not only the exact words in the title.
  const tokens = tokenize(query);
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
              ],
            }),
          }))
          .filter((item) => item.score >= RELATED_THRESHOLD)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.video);


  function countFor(section: Section) {
    return all.filter((video) =>
      section.id === "__none" ? !video.category_id : video.category_id === section.id,
    ).length;
  }

  return (
    <MemberShell title="Training" subtitle="Your training library" executive>
      <div className="raised-panel metal-edge rounded-3xl p-5 animate-rise-in">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Skyline training library
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold">
          {active ? active.name : "Training sections"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {active
            ? (active.description ??
              `${inSection.filter((v) => !v.locked).length} of ${inSection.length} videos unlocked for your rank.`)
            : "Choose a section to open its videos."}
        </p>
        {active ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search in ${active.name}`}
              className="h-11 rounded-2xl"
            />
            <Button
              variant="secondary"
              size="xl"
              onClick={() => {
                setOpenSection(null);
                setQuery("");
              }}
            >
              All sections
            </Button>
          </div>
        ) : null}
      </div>

      {!ready || isPending ? (
        <div className="flex justify-center py-14">
          <SkylineLoader />
        </div>
      ) : !active ? (
        <section className="mt-6">
          <SectionTitle>Sections</SectionTitle>
          {menu.length === 0 ? (
            <EmptyState
              title="No training sections yet"
              hint="Sections appear here as soon as they are published."
            />
          ) : (
            <div className="space-y-5">
              {grouped.map(({ bucket, items }) => (
                <div key={bucket.id}>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {bucket.name}
                  </p>
                  <ul className="space-y-2">
                    {items.map((section, index) => {
                      const total = countFor(section);
                      const open = all.filter(
                        (video) =>
                          !video.locked &&
                          (section.id === "__none"
                            ? !video.category_id
                            : video.category_id === section.id),
                      ).length;
                      return (
                        <li
                          key={section.id}
                          className="animate-rise-in"
                          style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenSection(section.id);
                              setQuery("");
                            }}
                            className={cn(
                              "glass-panel metal-edge depth-hover flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left",
                            )}
                          >
                            <span className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-brand-foreground shadow-brand">
                              <PlayCircle className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-display text-sm font-semibold">
                                {section.name}
                              </span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {total} video{total === 1 ? "" : "s"} · {open} unlocked
                              </span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-6">
          <SectionTitle>{active.name}</SectionTitle>
          {videos.length === 0 ? (
            <EmptyState
              title="No videos here yet"
              hint="Nothing has been published in this section — check back soon."
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
      )}
    </MemberShell>
  );
}
