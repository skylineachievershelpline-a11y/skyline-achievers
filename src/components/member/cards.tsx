import { Link } from "@tanstack/react-router";
import { PlayCircle, Clock } from "lucide-react";
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
        <img src={url} alt={label} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
  levels?: { id?: string; name: string } | null;
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
          {lecture.levels?.name ? <span className="truncate">· {lecture.levels.name}</span> : null}
        </p>
      </div>
    </Link>
  );
}

/** Grid tile for one training video on the dashboard. */
export function VideoCard({ video }: { video: LectureCardData }) {
  return (
    <Link
      to="/lecture/$lectureId"
      params={{ lectureId: video.id }}
      className="glass-panel depth-hover group block w-full rounded-2xl p-2.5"
    >
      <Poster url={video.thumbnail_url} label={video.title} />
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-brand-glow">
          {video.title}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDuration(video.duration_seconds)}
          {video.levels?.name ? <span className="truncate">· {video.levels.name}</span> : null}
        </p>
      </div>
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
