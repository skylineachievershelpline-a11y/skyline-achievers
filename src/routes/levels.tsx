import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { EmptyState, LevelCard } from "@/components/member/cards";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { getTrainingLevels } from "@/lib/member.functions";

export const Route = createFileRoute("/levels")({
  head: () => ({
    meta: [
      { title: "Training Levels — Skyline Achievers" },
      {
        name: "description",
        content: "Browse the Skyline Achievers training levels your membership rank unlocks.",
      },
      { property: "og:title", content: "Training Levels — Skyline Achievers" },
      { property: "og:description", content: "Rank-based training levels for Skyline members." },
    ],
  }),
  component: LevelsPage,
});

function LevelsPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getTrainingLevels);
  const { data, isPending } = useQuery({
    queryKey: ["levels"],
    queryFn: () => load(),
    enabled: ready,
  });

  return (
    <MemberShell title="Training levels" subtitle="Unlocked by your membership rank">
      {!ready || isPending ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </div>
      ) : (data?.levels.length ?? 0) === 0 ? (
        <EmptyState title="No levels unlocked yet" hint="Content will appear as soon as it is published." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data!.levels.map((level: any) => (
            <LevelCard key={level.id} level={level} />
          ))}
        </div>
      )}
    </MemberShell>
  );
}
