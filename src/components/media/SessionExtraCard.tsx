import { ExternalLink, FileText, ImageIcon } from "lucide-react";

import { SessionVideo } from "@/components/media/SessionVideo";
import { Button } from "@/components/ui/button";

export type SessionExtraItem = {
  id: string;
  title: string;
  description: string | null;
  kind?: string | null;
  aspectRatio: string;
  url?: string | null;
  videoUrl?: string | null;
  thumbnailUrl: string | null;
};

/** One extra item with a session: video player, picture, PDF or plain link. */
export function SessionExtraCard({ extra }: { extra: SessionExtraItem }) {
  const kind = extra.kind ?? "video";
  const url = extra.url ?? extra.videoUrl ?? null;

  return (
    <article className="raised-panel rounded-3xl p-3 sm:p-4">
      {kind === "video" ? (
        <SessionVideo
          title={extra.title}
          videoUrl={url}
          aspectRatio={extra.aspectRatio}
          poster={extra.thumbnailUrl}
        />
      ) : kind === "image" ? (
        url ? (
          <img
            src={url}
            alt={extra.title}
            loading="lazy"
            className="metal-edge w-full rounded-2xl object-contain"
          />
        ) : null
      ) : (
        <div className="metal-edge flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan/30 bg-primary/15 text-brand-glow">
            {kind === "pdf" ? (
              <FileText className="h-5 w-5" />
            ) : (
              <ExternalLink className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{extra.title}</p>
            <p className="text-[11px] text-muted-foreground">
              {kind === "pdf" ? "PDF document" : "External link"}
            </p>
          </div>
        </div>
      )}

      <div className="px-2 pb-1 pt-3">
        <p className="text-sm font-semibold">{extra.title}</p>
        {extra.description ? (
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
            {extra.description}
          </p>
        ) : null}
        {kind !== "video" && url ? (
          <a href={url} target="_blank" rel="noreferrer" className="mt-3 block">
            <Button variant="brand" size="xl" className="w-full">
              {kind === "pdf" ? (
                <FileText className="h-4 w-4" />
              ) : kind === "image" ? (
                <ImageIcon className="h-4 w-4" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {kind === "pdf"
                ? "Open PDF"
                : kind === "image"
                  ? "View full picture"
                  : "Open link"}
            </Button>
          </a>
        ) : null}
      </div>
    </article>
  );
}
