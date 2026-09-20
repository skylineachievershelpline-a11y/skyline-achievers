import { useAutoPauseVideo } from "@/hooks/useAutoPauseVideo";

/** Vertical clip that stops itself the moment it scrolls out of view. */
export function ReelVideo({
  src,
  poster,
  muted,
  className,
}: {
  src: string;
  poster?: string | undefined;
  muted: boolean;
  className?: string;
}) {
  const ref = useAutoPauseVideo<HTMLVideoElement>();
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted={muted}
      loop
      playsInline
      preload="metadata"
      controls
      className={className ?? "aspect-[9/16] w-full object-cover"}
    />
  );
}
