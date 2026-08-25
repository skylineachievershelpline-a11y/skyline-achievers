import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PlayCircle } from "lucide-react";

import { EmptyState, LectureCard, LevelCard, Rail, SeriesCard } from "@/components/member/cards";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { getDashboard } from "@/lib/member.functions";
import { formatDuration } from "@/lib/format";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Member Dashboard — Skyline Achievers" },
      {
        name: "description",
        content:
          "Your Skyline Achievers training dashboard: continue watching, series and resources for your level.",
      },
      { property: "og:title", content: "Member Dashboard — Skyline Achievers" },
      { property: "og:description", content: "Continue your Skyline Achievers training." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getDashboard);
  const { data, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => load(),
    enabled: ready,
  });

  if (!ready || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  if (!data || data.blocked) {
    return (
      <MemberShell title="Access paused">
        <EmptyState
          title="Your membership is not active"
          hint="Please contact your Skyline Achievers administrator."
        />
      </MemberShell>
    );
  }

  const featured = data.featured as any;

  return (
    <MemberShell
      title={data.member?.fullName ?? "Member"}
      subtitle={`${data.member?.memberId ?? ""} · ${data.member?.level?.name ?? "Level not assigned"}`}
    >
      {featured ? (
        <section className="glass-panel-strong relative mb-7 overflow-hidden rounded-3xl">
          {featured.thumbnail_url ? (
            <img
              src={featured.thumbnail_url}
              alt={featured.title}
              className="absolute inset-0 h-full w-full object-cover opacity-35"
            />
          ) : null}
          <div className="relative p-6 sm:p-9">
            <p className="text-[11px] uppercase tracking-[0.22em] text-brand-glow">Latest release</p>
            <h1 className="mt-2 max-w-xl font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {featured.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground line-clamp-3">
              {featured.description ?? "New training content is available for your level."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatDuration(featured.duration_seconds)}
              {featured.series?.title ? ` · ${featured.series.title}` : ""}
            </p>
            <Button asChild variant="brand" size="xl" className="mt-5">
              <Link to="/lecture/$lectureId" params={{ lectureId: featured.id }}>
                <PlayCircle className="h-4 w-4" />
                Watch now
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {data.continueWatching.length > 0 ? (
        <section className="mb-7">
          <SectionTitle>Continue watching</SectionTitle>
          <Rail>
            {data.continueWatching.map((lecture: any) => (
              <LectureCard key={lecture.id} lecture={lecture} resume />
            ))}
          </Rail>
        </section>
      ) : null}

      {data.mySeries.length > 0 ? (
        <section className="mb-7">
          <SectionTitle>{data.member?.level?.name ?? "Your level"}</SectionTitle>
          <Rail>
            {data.mySeries.map((series: any) => (
              <SeriesCard key={series.id} series={series} />
            ))}
          </Rail>
        </section>
      ) : null}

      {data.latestLectures.length > 0 ? (
        <section className="mb-7">
          <SectionTitle>Newly added</SectionTitle>
          <Rail>
            {data.latestLectures.map((lecture: any) => (
              <LectureCard key={lecture.id} lecture={lecture} />
            ))}
          </Rail>
        </section>
      ) : null}

      <section className="mb-4">
        <SectionTitle>Your training levels</SectionTitle>
        {data.levels.length === 0 ? (
          <EmptyState
            title="No training content yet"
            hint="Your administrator has not published any series for your rank yet."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.levels.map((level: any) => (
              <LevelCard key={level.id} level={level} />
            ))}
          </div>
        )}
      </section>
    </MemberShell>
  );
}
