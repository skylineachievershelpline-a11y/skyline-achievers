import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { EmptyState, SeriesCard } from "@/components/member/cards";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { getLevelDetail } from "@/lib/member.functions";

export const Route = createFileRoute("/level/$slug")({
  head: () => ({
    meta: [
      { title: "Level Library — Skyline Achievers" },
      {
        name: "description",
        content: "Every training series published inside this Skyline Achievers level.",
      },
      { property: "og:title", content: "Level Library — Skyline Achievers" },
      { property: "og:description", content: "Series inside your Skyline Achievers level." },
    ],
  }),
  component: LevelPage,
});

function LevelPage() {
  const { slug } = Route.useParams();
  const ready = useMemberGuard();
  const load = useServerFn(getLevelDetail);
  const { data, isPending } = useQuery({
    queryKey: ["level", slug],
    queryFn: () => load({ data: { slug } }),
    enabled: ready,
  });

  return (
    <MemberShell
      title={data?.level?.name ?? "Level"}
      subtitle={data?.level?.description ?? "Training series"}
    >
      {!ready || isPending ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </div>
      ) : !data?.level ? (
        <EmptyState title="This level is not available" hint="Your rank does not unlock this level yet." />
      ) : data.series.length === 0 ? (
        <EmptyState title="No series published yet" hint="Check back soon." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 [&>a]:w-full">
          {data.series.map((series: any) => (
            <SeriesCard key={series.id} series={series} />
          ))}
        </div>
      )}
    </MemberShell>
  );
}
