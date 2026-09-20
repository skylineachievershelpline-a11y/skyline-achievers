import { useEffect, useRef } from "react";

/**
 * Pauses a video as soon as it scrolls out of view so two clips can never
 * play (and talk over each other) at the same time.
 */
export function useAutoPauseVideo<T extends HTMLVideoElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.intersectionRatio < 0.35 && !video.paused) video.pause();
      },
      { threshold: [0, 0.35, 0.8] },
    );
    observer.observe(video);
    const onHidden = () => {
      if (document.visibilityState === "hidden" && !video.paused) video.pause();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  return ref;
}
