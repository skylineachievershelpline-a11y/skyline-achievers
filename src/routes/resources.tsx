import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BookOpen, FileText, Headphones, ImageIcon, Link2, NotebookPen, Presentation, Video } from "lucide-react";
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

const FILTERS = ["all", "video", "image", "pdf", "audio", "presentation", "book", "link", "note"] as const;
const OTHER = "__other__";

const FILTER_ICONS = {
  video: Video,
  image: ImageIcon,
  pdf: FileText,
  audio: Headphones,
  presentation: Presentation,
  book: BookOpen,
  link: Link2,
  note: NotebookPen,
} as const;

type ResourceRow = {
  id: string;
  title: string;
  description?: string | null;
  resource_type: string;
  body?: string | null;
  thumbnail_url?: string | null;
  section_id?: string | null;
  lectures?: { id: string; title: string } | null;
};

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

  const allResources = (data?.resources ?? []) as ResourceRow[];
  const sections = ((data as any)?.sections ?? []) as {
    id: string;
    name: string;
    thumbnailUrl: string | null;
  }[];
  const matchingResources = allResources.filter(
    (resource) => filter === "all" || resource.resource_type === filter,
  );
  const loose = matchingResources.filter((resource) => !resource.section_id);
  const tiles = [
    ...sections.map((section) => ({
      id: section.id,
      name: section.name,
      thumbnailUrl: section.thumbnailUrl,
      count: matchingResources.filter((resource) => resource.section_id === section.id).length,
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
      ? matchingResources
      : openSection === OTHER
        ? loose
        : matchingResources.filter((resource) => resource.section_id === openSection);

  const activeTile = tiles.find((tile) => tile.id === openSection);
  const showingCategories = ready && !isPending && openSection === null && tiles.length > 0;

  function chooseFilter(option: (typeof FILTERS)[number]) {
    setFilter(option);
    setOpenSection(null);
  }

  return (
    <MemberShell
      title="Resources"
      subtitle={activeTile?.name ?? (showingCategories ? "Choose a category" : "Everything unlocked for your rank")}
    >
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
        {FILTERS.map((option) => {
          const Icon = option === "all" ? null : FILTER_ICONS[option];
          return (
            <Button
              key={option}
              type="button"
              variant={filter === option ? "brand" : "outline"}
              size="sm"
              onClick={() => chooseFilter(option)}
              className={cn("shrink-0 rounded-full px-3.5 text-xs", filter !== option && "bg-glass text-muted-foreground")}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {option === "all" ? "All" : option === "image" ? "Pictures" : (RESOURCE_TYPE_LABEL[option] ?? option)}
            </Button>
          );
        })}
      </div>

      {!ready || isPending ? (
        <div className="flex justify-center py-16">
          <SkylineLoader />
        </div>
      ) : matchingResources.length === 0 ? (
        <EmptyState title="No resources here yet" hint="New material appears as soon as it is published." />
      ) : showingCategories ? (
        <SectionTiles sections={tiles} onOpen={setOpenSection} />
      ) : (
        <ResourceList resources={scoped} />
      )}
    </MemberShell>
  );
}
