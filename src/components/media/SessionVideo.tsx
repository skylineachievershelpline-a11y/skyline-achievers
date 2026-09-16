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

/** Plays an uploaded or linked training video in the configured shape. */
export function SessionVideo({
  title,
  videoUrl,
  aspectRatio,
  poster,
}: {
  title: string;
  videoUrl: string | null;
  aspectRatio: string;
  poster?: string | null;
}) {
  // A cover image is shown until the viewer taps play; embedded players cannot
  // display a poster themselves, so we overlay it and autoplay on click.
  const [started, setStarted] = useState(false);
  const showCover = Boolean(poster) && !started;

  return (
    <div className={`metal-edge relative overflow-hidden rounded-2xl bg-media shadow-lift ${RATIO_CLASS[aspectRatio] ?? "aspect-video"}`}>
      {videoUrl ? (
        isEmbeddable(videoUrl) ? (
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
    </div>
  );
}
