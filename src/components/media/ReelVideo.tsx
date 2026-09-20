import { useState } from "react";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { useAutoPauseVideo } from "@/hooks/useAutoPauseVideo";

/**
 * Vertical clip that stops itself the moment it scrolls out of view, and shows
 * the Skyline logo loader while the video is still buffering.
 */
export function ReelVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string | undefined;
  className?: string;
}) {
  const ref = useAutoPauseVideo<HTMLVideoElement>();
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative h-full w-full">
      <video
        ref={ref}
        src={src}
        poster={poster}
        loop
        playsInline
        preload="metadata"
        controls
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onPlaying={() => setLoading(false)}
        className={className ?? "aspect-[9/16] w-full object-cover"}
      />
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[2px]">
          <SkylineLoader />
        </div>
      ) : null}
    </div>
  );
}
