import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { SectionTiles } from "@/components/media/SectionTiles";
import { EmptyState } from "@/components/member/cards";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { ResourceList } from "@/components/member/ResourceList";
import { Button } from "@/components/ui/button";
import { getMemberResources } from "@/lib/member.functions";
import { RESOURCE_TYPE_LABEL } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources — Skyline Achievers" },
      {
        name: "description",
        content: "PDFs, audio, books, notes and important links unlocked for your Skyline rank.",
      },
      { property: "og:title", content: "Resources — Skyline Achievers" },
      { property: "og:description", content: "Every training resource unlocked for your rank." },
    ],
  }),
  component: ResourcesPage,
});

const FILTERS = ["all", "pdf", "image", "audio", "presentation", "book", "link", "note"] as const;
const OTHER = "__other__";

function ResourcesPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getMemberResources);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [openSection, setOpenSection] = useState<string | null>(null);
  const { data, isPending } = useQuery({
    queryKey: ["member-resources"],
    queryFn: () => load(),
    enabled: ready,
  });

  const allResources = (data?.resources ?? []) as any[];
  const sections = ((data as any)?.sections ?? []) as {
    id: string;
    name: string;
    thumbnailUrl: string | null;
  }[];
  const loose = allResources.filter((r) => !r.section_id);
  const tiles = [
    ...sections.map((section) => ({
      id: section.id,
      name: section.name,
      thumbnailUrl: section.thumbnailUrl,
      count: allResources.filter((r) => r.section_id === section.id).length,
    })),
    ...(loose.length > 0
      ? [
          {
            id: OTHER,
            name: "Other material",
            thumbnailUrl: (loose[0]?.thumbnail_url ?? null) as string | null,
            count: loose.length,
          },
        ]
      : []),
  ].filter((tile) => tile.count > 0);

  const scoped =
    openSection === null
      ? allResources
      : openSection === OTHER
        ? loose
        : allResources.filter((r) => r.section_id === openSection);

  const resources = scoped.filter((r: any) => filter === "all" || r.resource_type === filter);
  const activeTile = tiles.find((tile) => tile.id === openSection);

  if (ready && !isPending && tiles.length > 1 && openSection === null) {
    return (
      <MemberShell title="Resources" subtitle="Pick a category to open">
        <SectionTiles sections={tiles} onOpen={(id) => setOpenSection(id)} />
      </MemberShell>
    );
  }

  return (
    <MemberShell title="Resources" subtitle={activeTile?.name ?? "Everything unlocked for your rank"}>
      {activeTile ? (
        <Button
          variant="outline"
          size="sm"
          className="mb-3 rounded-2xl"
          onClick={() => setOpenSection(null)}
        >
          <ArrowLeft className="h-4 w-4" />
          All categories
        </Button>
      ) : null}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className={cn(
              "shrink-0 rounded-full border border-hairline px-3.5 py-1.5 text-xs transition-colors",
              filter === option
                ? "brand-gradient text-brand-foreground"
                : "bg-glass text-muted-foreground hover:text-foreground",
            )}
          >
            {option === "all" ? "All" : (RESOURCE_TYPE_LABEL[option] ?? option)}
          </button>
        ))}
      </div>

      {!ready || isPending ? (
        <div className="flex justify-center py-16">
          <SkylineLoader />
        </div>
      ) : resources.length === 0 ? (
        <EmptyState title="No resources here yet" hint="New material appears as soon as it is published." />
      ) : (
        <ResourceList resources={resources as any} />
      )}
    </MemberShell>
  );
}
