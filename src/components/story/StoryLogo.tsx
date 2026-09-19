import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Play, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { BRAND } from "@/lib/brand";
import { getActiveStories } from "@/lib/stories.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Story = {
  id: string;
  kind: "text" | "image" | "video" | "audio";
  caption: string | null;
  textBody: string | null;
  background: string | null;
  mediaUrl: string | null;
  createdAt: string;
};

const IMAGE_MS = 6000;

/**
 * Shows a clear story action beside the official Skyline logo. The viewer uses
 * familiar full-screen progress segments without altering the logo itself.
 */
export function StoryLogo({ size = 36, className }: { size?: number; className?: string }) {
  const load = useServerFn(getActiveStories);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user.id ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);
  const { data } = useQuery({
    queryKey: ["active-stories", userId],
    queryFn: () => load(),
    enabled: Boolean(userId),
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
       <div className={cn("flex shrink-0 items-center gap-2", className)}>
        <img
          src={BRAND.logoUrl}
          alt={BRAND.logoAlt}
          draggable={false}
           className="shrink-0 rounded-full object-cover ring-1 ring-hairline"
          style={{ width: size, height: size }}
        />
         {hasStory ? (
           <Button
             type="button"
             variant="brand"
             size="sm"
             onClick={() => setOpen(true)}
             className="h-8 rounded-full px-3 text-[11px] shadow-brand"
           >
             <Play className="h-3.5 w-3.5" /> Watch Story
           </Button>
         ) : null}
       </div>

      {open && hasStory && typeof document !== "undefined"
        ? createPortal(
            <StoryViewer stories={stories} onClose={() => setOpen(false)} />,
            document.body,
          )
        : null}
    </>
  );
}

function StoryViewer({ stories, onClose }: { stories: Story[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const paused = useRef(false);
  const mediaRef = useRef<HTMLMediaElement | null>(null);

  const story = stories[index]!;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

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
    if (story.kind === "video" || story.kind === "audio") return;
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
    <div className="story-viewer-layer fixed inset-0 z-[9999] flex min-h-[100dvh] justify-center overflow-hidden bg-background/97 backdrop-blur-xl">
      <div className="story-viewer-panel relative flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-x border-hairline bg-background shadow-lift">
      <div className="flex gap-1 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
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

       <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline bg-surface/90 px-4 pb-4 pt-1 shadow-glass">
        <div className="flex min-w-0 items-center gap-3">
        <img
          src={BRAND.logoUrl}
          alt={BRAND.logoAlt}
           className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-cyan/40 shadow-brand"
        />
        <div className="min-w-0 flex-1">
           <p className="truncate font-display text-base font-semibold">{BRAND.name}</p>
           <p className="text-[11px] font-medium uppercase text-brand-glow">Story · Learn • Earn • Lead</p>
        </div>
        </div>
         <Button
          type="button"
          onClick={onClose}
          aria-label="Close story"
           variant="outline"
           size="icon"
           className="h-11 w-11 shrink-0 rounded-full"
        >
          <X className="h-4 w-4" />
         </Button>
       </header>

      <div
         className="relative min-h-0 flex-1 select-none overflow-hidden bg-surface-2"
      >
        {story.kind === "video" && story.mediaUrl ? (
          <video
            ref={(node) => {
              mediaRef.current = node;
            }}
            src={story.mediaUrl}
            autoPlay
            playsInline
            controls={false}
            onTimeUpdate={(event) => {
              const media = event.currentTarget;
              if (media.duration > 0) setProgress(media.currentTime / media.duration);
            }}
            onEnded={next}
            className="relative z-10 h-full w-full object-contain"
          />
        ) : story.kind === "audio" && story.mediaUrl ? (
           <div className="relative z-10 flex h-full w-full items-center justify-center px-6">
            <div className="glass-panel-strong w-full max-w-md rounded-3xl p-8 text-center shadow-lift">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-cyan/40 bg-primary/20 text-brand-glow shadow-brand">
                <Volume2 className="h-7 w-7" />
              </span>
              <p className="mt-5 font-display text-xl font-semibold">{story.caption || "Skyline voice story"}</p>
              <audio
                ref={(node) => {
                  mediaRef.current = node;
                }}
                src={story.mediaUrl}
                autoPlay
                controls
                onTimeUpdate={(event) => {
                  const media = event.currentTarget;
                  if (media.duration > 0) setProgress(media.currentTime / media.duration);
                }}
                onEnded={next}
                className="mt-5 w-full"
              />
            </div>
          </div>
        ) : story.kind === "image" && story.mediaUrl ? (
           <img src={story.mediaUrl} alt={story.caption ?? "Story"} className="relative z-10 h-full w-full object-contain" />
        ) : (
          <div
             className="relative z-10 flex h-full w-full items-center justify-center px-8 text-center"
            style={{ background: story.background ?? "var(--gradient-brand, #0b1220)" }}
          >
            <p className="font-display text-2xl font-semibold leading-snug text-foreground">
              {story.textBody}
            </p>
          </div>
        )}

        {/* left / right tap zones (hold anywhere to pause) */}
         <Button
          type="button"
          aria-label="Previous story"
          onClick={prev}
           onPointerDown={() => {
             paused.current = true;
             mediaRef.current?.pause();
           }}
           onPointerUp={() => {
             paused.current = false;
             void mediaRef.current?.play();
           }}
           variant="ghost"
           className="absolute inset-y-0 left-0 z-20 h-full w-1/5 rounded-none border-0 bg-transparent p-0 hover:bg-transparent"
        />
         <Button
          type="button"
          aria-label="Next story"
          onClick={next}
           onPointerDown={() => {
             paused.current = true;
             mediaRef.current?.pause();
           }}
           onPointerUp={() => {
             paused.current = false;
             void mediaRef.current?.play();
           }}
           variant="ghost"
           className="absolute inset-y-0 right-0 z-20 h-full w-1/5 rounded-none border-0 bg-transparent p-0 hover:bg-transparent"
        />

        {/* visible skip controls so a story can be changed before it finishes */}
        {stories.length > 1 ? (
          <>
            <Button
              type="button"
              aria-label="Previous story"
              onClick={prev}
              disabled={index === 0}
              variant="outline"
              size="icon"
              className="absolute left-3 top-1/2 z-30 h-10 w-10 -translate-y-1/2 rounded-full bg-background/70 backdrop-blur disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              aria-label="Next story"
              onClick={next}
              variant="outline"
              size="icon"
              className="absolute right-3 top-1/2 z-30 h-10 w-10 -translate-y-1/2 rounded-full bg-background/70 backdrop-blur"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <span className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full border border-hairline bg-background/70 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
              {index + 1} / {stories.length}
            </span>
          </>
        ) : null}

      </div>

      {story.caption ? (
         <p className="border-t border-hairline bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 text-center text-sm text-foreground">{story.caption}</p>
      ) : null}
      </div>
    </div>
  );
}
