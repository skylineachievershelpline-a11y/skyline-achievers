import { PlayCircle } from "lucide-react";

import type { LandingIntro } from "@/lib/landing.functions";

function toEmbedUrl(url: string): string | null {
  const youtube = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})/,
  );
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}?rel=0&modestbranding=1`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  return null;
}

const ratioClass: Record<string, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16] max-h-[720px]",
  "1:1": "aspect-square",
  "4:3": "aspect-[4/3]",
};

export function IntroPlayer({ intro }: { intro: LandingIntro | null }) {
  const ratio = ratioClass[intro?.aspectRatio ?? "16:9"] ?? "aspect-video";

  if (!intro?.videoUrl) {
    return (
      <div className={`${ratio} intro-empty grid w-full place-items-center overflow-hidden rounded-lg border border-hairline bg-surface`}>
        <div className="max-w-sm px-6 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-hairline bg-glass text-brand-glow">
            <PlayCircle className="h-7 w-7" />
          </span>
          <p className="mt-5 font-display text-xl font-semibold">Introduction coming soon</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The Skyline Achievers introduction will appear here when it is published.
          </p>
        </div>
      </div>
    );
  }

  const embed = intro.videoSource === "external" ? toEmbedUrl(intro.videoUrl) : null;
  if (embed) {
    return (
      <iframe
        src={embed}
        title={intro.title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className={`${ratio} w-full rounded-lg border border-hairline bg-surface shadow-[var(--shadow-lift)]`}
      />
    );
  }

  return (
    <video
      controls
      preload="metadata"
      poster={intro.thumbnailUrl ?? undefined}
      className={`${ratio} w-full rounded-lg border border-hairline bg-surface object-contain shadow-[var(--shadow-lift)]`}
    >
      <source src={intro.videoUrl} />
      Your browser does not support video playback.
    </video>
  );
}