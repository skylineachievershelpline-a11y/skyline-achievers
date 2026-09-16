import { Link } from "@tanstack/react-router";
import { PlayCircle, Layers, Clock } from "lucide-react";
import type { ReactNode } from "react";

import { formatClock, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Rail({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
      {children}
    </div>
  );
}

function Poster({
  url,
  label,
  className,
}: {
  url?: string | null | undefined;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "metal-edge relative aspect-video w-full overflow-hidden rounded-2xl border bg-surface-2 shadow-lift",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={label} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center brand-gradient/10">
          <PlayCircle className="h-8 w-8 text-brand" />
        </div>
      )}
    </div>
  );
}

export type LectureCardData = {
  id: string;
  title: string;
  duration_seconds?: number | null;
  thumbnail_url?: string | null;
  position_seconds?: number;
  series?: { id: string; title: string; levels?: { name: string } | null } | null;
};

export function LectureCard({ lecture, resume }: { lecture: LectureCardData; resume?: boolean }) {
  return (
    <Link
      to="/lecture/$lectureId"
      params={{ lectureId: lecture.id }}
      className="glass-panel depth-hover group w-[240px] shrink-0 snap-start rounded-2xl p-2.5 sm:w-[268px]"
    >
      <Poster url={lecture.thumbnail_url} label={lecture.title} />
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-brand-glow">
          {lecture.title}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {resume && lecture.position_seconds
            ? `Resume at ${formatClock(lecture.position_seconds)}`
            : formatDuration(lecture.duration_seconds)}
          {lecture.series?.title ? <span className="truncate">· {lecture.series.title}</span> : null}
        </p>
      </div>
    </Link>
  );
}

export function SeriesCard({
  series,
}: {
  series: {
    id: string;
    title: string;
    description?: string | null;
    thumbnail_url?: string | null;
    lecture_count?: number;
  };
}) {
  return (
    <Link
      to="/series/$seriesId"
      params={{ seriesId: series.id }}
      className="glass-panel depth-hover group w-[240px] shrink-0 snap-start rounded-2xl p-2.5 sm:w-[268px]"
    >
      <Poster url={series.thumbnail_url} label={series.title} />
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-brand-glow">
          {series.title}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {series.lecture_count ?? 0} lecture{(series.lecture_count ?? 0) === 1 ? "" : "s"}
        </p>
      </div>
    </Link>
  );
}

export function LevelCard({
  level,
}: {
  level: { id: string; name: string; slug: string; description?: string | null; series_count?: number };
}) {
  return (
    <Link
      to="/level/$slug"
      params={{ slug: level.slug }}
      className="glass-panel metal-edge depth-hover group flex items-center gap-3 rounded-2xl p-4"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan/30 brand-gradient text-brand-foreground shadow-brand">
        <Layers className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-sm font-semibold">{level.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {level.series_count ?? 0} series available
        </span>
      </span>
    </Link>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="glass-panel metal-edge rounded-2xl px-5 py-10 text-center">
      <p className="font-display text-sm font-semibold">{title}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
