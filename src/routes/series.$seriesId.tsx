import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PlayCircle } from "lucide-react";

import { EmptyState } from "@/components/member/cards";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { ResourceList } from "@/components/member/ResourceList";
import { getSeriesDetail } from "@/lib/member.functions";
import { formatDuration } from "@/lib/format";

export const Route = createFileRoute("/series/$seriesId")({
  head: () => ({
    meta: [
      { title: "Training Series — Skyline Achievers" },
      {
        name: "description",
        content: "All lectures and resources inside this Skyline Achievers training series.",
      },
      { property: "og:title", content: "Training Series — Skyline Achievers" },
      { property: "og:description", content: "Lectures and resources in this series." },
    ],
  }),
  component: SeriesPage,
});

function SeriesPage() {
  const { seriesId } = Route.useParams();
  const ready = useMemberGuard();
  const load = useServerFn(getSeriesDetail);
  const { data, isPending } = useQuery({
    queryKey: ["series", seriesId],
    queryFn: () => load({ data: { seriesId } }),
    enabled: ready,
  });

  return (
    <MemberShell
      title={data?.series?.title ?? "Series"}
      subtitle={(data?.series as any)?.levels?.name ?? undefined}
    >
      {!ready || isPending ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </div>
      ) : !data?.series ? (
        <EmptyState title="Series unavailable" hint="Your rank does not unlock this series." />
      ) : (
        <>
          <section className="glass-panel-strong relative mb-6 overflow-hidden rounded-3xl">
            {data.series.thumbnail_url ? (
              <img
                src={data.series.thumbnail_url}
                alt={data.series.title}
                className="absolute inset-0 h-full w-full object-cover opacity-30"
              />
            ) : null}
            <div className="relative p-6">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{data.series.title}</h1>
              {data.series.description ? (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.series.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {data.lectures.length} lecture{data.lectures.length === 1 ? "" : "s"}
              </p>
            </div>
          </section>

          <section className="mb-7">
            <SectionTitle>Lectures</SectionTitle>
            {data.lectures.length === 0 ? (
              <EmptyState title="No lectures yet" />
            ) : (
              <ol className="space-y-2">
                {data.lectures.map((lecture: any, index: number) => (
                  <li key={lecture.id}>
                    <Link
                      to="/lecture/$lectureId"
                      params={{ lectureId: lecture.id }}
                      className="glass-panel flex items-center gap-3 rounded-2xl p-3 transition-transform hover:-translate-y-0.5"
                    >
                      <span className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface-2">
                        {lecture.thumbnail_url ? (
                          <img
                            src={lecture.thumbnail_url}
                            alt={lecture.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">
                            <PlayCircle className="h-5 w-5 text-brand" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {index + 1}. {lecture.title}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {formatDuration(lecture.duration_seconds)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {data.resources.length > 0 ? (
            <section>
              <SectionTitle>Series resources</SectionTitle>
              <ResourceList resources={data.resources as any} />
            </section>
          ) : null}
        </>
      )}
    </MemberShell>
  );
}
