import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BRAND } from "@/lib/brand";
import { getActiveStories } from "@/lib/stories.functions";
import { cn } from "@/lib/utils";

type Story = {
  id: string;
  kind: "text" | "image" | "video";
  caption: string | null;
  textBody: string | null;
  background: string | null;
  mediaUrl: string | null;
  createdAt: string;
};

const IMAGE_MS = 6000;

/**
 * The Skyline logo doubles as the platform status ring: when an admin posts a
 * story the logo gets a glowing gradient ring, and tapping it opens the
 * full-screen story viewer with Instagram-style progress segments.
 */
export function StoryLogo({ size = 36, className }: { size?: number; className?: string }) {
  const load = useServerFn(getActiveStories);
  const { data } = useQuery({
    queryKey: ["active-stories"],
    queryFn: () => load(),
    staleTime: 60_000,
    retry: false,
  });
  const [open, setOpen] = useState(false);

  const stories = ((data?.items ?? []) as Story[]).filter(
    (story) => story.kind === "text" || story.mediaUrl,
  );
  const hasStory = stories.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => hasStory && setOpen(true)}
        aria-label={hasStory ? "Watch Skyline story" : BRAND.name}
        className={cn("relative shrink-0", hasStory ? "cursor-pointer" : "cursor-default", className)}
        style={{ width: size + 8, height: size + 8 }}
      >
        {hasStory ? <span className="story-ring absolute inset-0 rounded-full" aria-hidden /> : null}
        <img
          src={BRAND.logoUrl}
          alt={BRAND.logoAlt}
          draggable={false}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover ring-1 ring-hairline"
          style={{ width: size, height: size }}
        />
      </button>

      {open && hasStory ? <StoryViewer stories={stories} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function StoryViewer({ stories, onClose }: { stories: Story[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const paused = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const story = stories[index]!;

  const next = useCallback(() => {
    setProgress(0);
    setIndex((current) => {
      if (current + 1 >= stories.length) {
        onClose();
        return current;
      }
      return current + 1;
    });
  }, [stories.length, onClose]);

  const prev = useCallback(() => {
    setProgress(0);
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  // Pictures and text auto-advance on a timer; videos advance when they end.
  useEffect(() => {
    if (story.kind === "video") return;
    const started = Date.now();
    let elapsed = 0;
    const timer = window.setInterval(() => {
      if (paused.current) return;
      elapsed = Date.now() - started;
      const value = Math.min(1, elapsed / IMAGE_MS);
      setProgress(value);
      if (value >= 1) next();
    }, 60);
    return () => window.clearInterval(timer);
  }, [story.id, story.kind, next]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background/97 backdrop-blur-xl">
      <div className="flex gap-1 px-3 pt-3">
        {stories.map((item, position) => (
          <span key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full brand-gradient transition-[width] duration-75"
              style={{
                width:
                  position < index ? "100%" : position === index ? `${progress * 100}%` : "0%",
              }}
            />
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <img
          src={BRAND.logoUrl}
          alt={BRAND.logoAlt}
          className="h-9 w-9 rounded-full object-cover ring-1 ring-cyan/40"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold">{BRAND.name}</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Story</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close story"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-glass text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className="relative flex-1 select-none overflow-hidden"
        onPointerDown={() => {
          paused.current = true;
          videoRef.current?.pause();
        }}
        onPointerUp={() => {
          paused.current = false;
          void videoRef.current?.play();
        }}
      >
        {story.kind === "video" && story.mediaUrl ? (
          <video
            ref={videoRef}
            src={story.mediaUrl}
            autoPlay
            playsInline
            controls={false}
            onTimeUpdate={(event) => {
              const media = event.currentTarget;
              if (media.duration > 0) setProgress(media.currentTime / media.duration);
            }}
            onEnded={next}
            className="h-full w-full object-contain"
          />
        ) : story.kind === "image" && story.mediaUrl ? (
          <img src={story.mediaUrl} alt={story.caption ?? "Story"} className="h-full w-full object-contain" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center px-8 text-center"
            style={{ background: story.background ?? "var(--gradient-brand, #0b1220)" }}
          >
            <p className="font-display text-2xl font-semibold leading-snug text-foreground">
              {story.textBody}
            </p>
          </div>
        )}

        {/* left / right tap zones */}
        <button
          type="button"
          aria-label="Previous story"
          onClick={prev}
          className="absolute inset-y-0 left-0 w-1/3"
        />
        <button
          type="button"
          aria-label="Next story"
          onClick={next}
          className="absolute inset-y-0 right-0 w-1/3"
        />
      </div>

      {story.caption ? (
        <p className="px-5 pb-6 pt-3 text-center text-sm text-muted-foreground">{story.caption}</p>
      ) : null}
    </div>
  );
}
