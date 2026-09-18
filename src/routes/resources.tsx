import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/member/cards";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { ResourceList } from "@/components/member/ResourceList";
import { getMemberResources } from "@/lib/member.functions";
import { RESOURCE_TYPE_LABEL } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { SkylineLoader } from "@/components/brand/SkylineLoader";

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

const FILTERS = ["all", "pdf", "audio", "presentation", "book", "link", "note"] as const;

function ResourcesPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getMemberResources);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const { data, isPending } = useQuery({
    queryKey: ["member-resources"],
    queryFn: () => load(),
    enabled: ready,
  });

  const resources = (data?.resources ?? []).filter(
    (r: any) => filter === "all" || r.resource_type === filter,
  );

  return (
    <MemberShell title="Resources" subtitle="Everything unlocked for your rank">
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
