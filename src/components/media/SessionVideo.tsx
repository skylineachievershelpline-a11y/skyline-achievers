import { Play } from "lucide-react";
import { SecureYouTubePlayer, youtubeId } from "@/components/media/SecureYouTubePlayer";
import { useState } from "react";

import { useAutoPauseVideo } from "@/hooks/useAutoPauseVideo";
import { cn } from "@/lib/utils";

export const RATIO_CLASS: Record<string, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16] mx-auto max-h-[78vh] w-auto",
  "1:1": "aspect-square mx-auto max-h-[78vh]",
  "4:3": "aspect-[4/3]",
};

export function isEmbeddable(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com|facebook\.com|fb\.watch/.test(url);
}

export function toEmbedUrl(url: string): string {
  const youtube = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})/,
  );
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  if (/facebook\.com|fb\.watch/.test(url))
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`;
  return url;
}

function appendAutoplay(url: string, autoplay: boolean): string {
  if (!autoplay) return url;
  return `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;
}

/** Plays an uploaded or linked training video in the configured shape. */
export function SessionVideo({
  title,
  videoUrl,
  aspectRatio,
  poster,
  frameClassName,
  onWatched,
}: {
  title: string;
  videoUrl: string | null;
  aspectRatio: string;
  poster?: string | null;
  frameClassName?: string;
  /** Fires when a YouTube video has been watched to the end. */
  onWatched?: () => void;
}) {
  // A cover image is shown until the viewer taps play; embedded players cannot
  // display a poster themselves, so we overlay it and autoplay on click.
  const [started, setStarted] = useState(false);
  const showCover = Boolean(poster) && !started;
  const videoRef = useAutoPauseVideo<HTMLVideoElement>();

  return (
    <div
      className={cn(
        "metal-edge relative overflow-hidden rounded-2xl bg-media shadow-lift",
        RATIO_CLASS[aspectRatio] ?? "aspect-video",
        frameClassName,
      )}
    >
      {videoUrl ? (
        youtubeId(videoUrl) ? (
          !showCover ? (
            <SecureYouTubePlayer url={videoUrl} title={title} autoplay={started} onWatched={onWatched} />
          ) : null
        ) : isEmbeddable(videoUrl) ? (
          !showCover ? (
            <iframe
              src={appendAutoplay(toEmbedUrl(videoUrl), started)}
              title={title}
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : null
        ) : (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={poster ?? undefined}
            controls
            playsInline
            controlsList="nodownload"
            className="h-full w-full object-contain"
          />
        )
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          Video unavailable
        </div>
      )}

      {videoUrl && showCover && isEmbeddable(videoUrl) ? (
        <button
          type="button"
          onClick={() => setStarted(true)}
          aria-label={`Play ${title}`}
          className="absolute inset-0 h-full w-full"
        >
          <img
            src={poster!}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 bg-media/35" aria-hidden />
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan/40 bg-primary/90 text-primary-foreground shadow-brand">
            <Play className="ml-0.5 h-6 w-6" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
