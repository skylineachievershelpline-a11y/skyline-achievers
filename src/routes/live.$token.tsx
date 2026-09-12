import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Maximize2, Radio, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { openPremiere } from "@/lib/live.functions";

const RATIO_CLASS: Record<string, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16] mx-auto max-h-[78vh] w-auto",
  "1:1": "aspect-square mx-auto max-h-[78vh]",
  "4:3": "aspect-[4/3]",
};

export const Route = createFileRoute("/live/$token")({
  head: () => ({
    meta: [
      { title: "Live Training Premiere — Skyline Achievers" },
      {
        name: "description",
        content:
          "Join the Skyline Achievers live training premiere. The session starts for everyone at the same time.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Live Training Premiere — Skyline Achievers" },
      {
        property: "og:description",
        content: "Countdown now, live training when the premiere starts.",
      },
    ],
  }),
  component: PremierePage,
});

function PremierePage() {
  const { token } = Route.useParams();
  const open = useServerFn(openPremiere);

  const { data, isPending, refetch } = useQuery({
    queryKey: ["premiere", token],
    queryFn: () => open({ data: { token } }),
    retry: false,
  });

  const premiere = data?.status === "ok" ? data.premiere : null;
  const [videoEnded, setVideoEnded] = useState(false);

  // Server clock is the source of truth so a device with a wrong local time
  // cannot start the premiere early.
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!premiere) return;
    setOffset(new Date(premiere.serverNow).getTime() - Date.now());
  }, [premiere]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const startAt = premiere ? new Date(premiere.scheduledAt).getTime() : 0;
  const remaining = premiere ? startAt - (now + offset) : 0;
  const isLive = Boolean(premiere) && remaining <= 0;
  const elapsedSeconds = isLive ? Math.max(0, Math.floor(-remaining / 1000)) : 0;

  // A session lasts exactly as long as its video: once the video is over the
  // page shows "session finished" instead of a black player.
  const duration = premiere?.durationSeconds ?? null;
  const isOver =
    data?.status === "ended" || videoEnded || Boolean(duration && elapsedSeconds > duration);

  // When the countdown hits zero we still need the signed video link, which the
  // server only mints once the premiere has actually started.
  const requested = useRef(false);
  useEffect(() => {
    if (isLive && premiere && !premiere.videoUrl && !requested.current) {
      requested.current = true;
      void refetch();
    }
  }, [isLive, premiere, refetch]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen px-4 pb-16 pt-6 sm:px-8">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center gap-3 animate-rise-in">
          <BrandLogo size="sm" withWordmark={false} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <Radio className="h-3.5 w-3.5" /> Live training
            </p>
            <h1 className="truncate font-display text-lg font-semibold tracking-tight">
              {premiere?.title ?? (data?.status === "ended" ? data.title : "Premiere")}
            </h1>
          </div>
        </header>

        {isOver ? (
          <div className="glass-panel-strong animate-rise-in rounded-3xl p-8 text-center">
            <p className="font-display text-lg font-semibold">This live session has finished</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              The session ran for its full length and the link has now expired. Ask your supervisor
              for the next session link.
            </p>
            <Link to="/" className="mt-6 inline-block">
              <Button variant="brand" size="xl">
                Back to sign in
              </Button>
            </Link>
          </div>
        ) : !premiere ? (
          <div className="glass-panel-strong rounded-3xl p-8 text-center animate-rise-in">
            <p className="font-display text-lg font-semibold">This premiere link is not valid</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              The link may have been removed or the session is no longer published. Ask your
              supervisor for a fresh link.
            </p>
            <Link to="/" className="mt-6 inline-block">
              <Button variant="brand" size="xl">
                Back to sign in
              </Button>
            </Link>
          </div>
        ) : !isLive ? (
          <Countdown
            remaining={remaining}
            startAt={startAt}
            title={premiere.title}
            thumbnailUrl={premiere.thumbnailUrl}
            aspectRatio={premiere.aspectRatio}
          />
        ) : (
          <div className="animate-rise-in space-y-5">
            <div className="glass-panel-strong overflow-hidden rounded-3xl p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatClock(elapsedSeconds)} into the session
                </span>
              </div>
              <div
                className={`overflow-hidden rounded-2xl bg-black ${
                  RATIO_CLASS[premiere.aspectRatio] ?? "aspect-video"
                }`}
              >
                {premiere.videoUrl ? (
                  premiere.isExternal ? (
                    <iframe
                      src={toLiveEmbedUrl(premiere.videoUrl, elapsedSeconds)}
                      title={premiere.title}
                      allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  ) : (
                    <LivePlayer
                      src={premiere.videoUrl}
                      poster={premiere.thumbnailUrl}
                      elapsedSeconds={elapsedSeconds}
                      onEnded={() => setVideoEnded(true)}
                    />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Starting the live session…
                  </div>
                )}
              </div>
            </div>

            <section className="glass-panel rounded-3xl p-6">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                {premiere.title}
              </h2>
              {premiere.description ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {premiere.description}
                </p>
              ) : null}
              <p className="mt-4 text-[11px] text-muted-foreground">
                Everyone watches together — you cannot skip ahead in a live session.
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Countdown({
  remaining,
  startAt,
  title,
  thumbnailUrl,
  aspectRatio,
}: {
  remaining: number;
  startAt: number;
  title: string;
  thumbnailUrl: string | null;
  aspectRatio: string;
}) {
  const total = Math.max(0, Math.ceil(remaining / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const parts = [
    ...(days > 0 ? [{ label: "Days", value: days }] : []),
    { label: "Hours", value: hours },
    { label: "Minutes", value: minutes },
    { label: "Seconds", value: seconds },
  ];

  return (
    <div className="animate-rise-in space-y-5">
      <div className="glass-panel-strong overflow-hidden rounded-3xl p-3 sm:p-4">
        <div
          className={`relative overflow-hidden rounded-2xl bg-black ${
            RATIO_CLASS[aspectRatio] ?? "aspect-video"
          }`}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={`${title} premiere cover`}
              className="h-full w-full object-cover opacity-40"
            />
          ) : null}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">Premiere starts in</p>
            <div className="flex items-end gap-3 sm:gap-5">
              {parts.map((part) => (
                <div key={part.label} className="min-w-14">
                  <p className="font-display text-3xl font-semibold tabular-nums text-white sm:text-5xl">
                    {String(part.value).padStart(2, "0")}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/60">
                    {part.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="glass-panel rounded-3xl p-6 text-center">
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Goes live on{" "}
          {new Date(startAt).toLocaleString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
          . Keep this page open — it starts by itself.
        </p>
      </section>
    </div>
  );
}

/** Plays the session in sync with the premiere clock and blocks seeking. */
function LivePlayer({
  src,
  poster,
  elapsedSeconds,
  onEnded,
}: {
  src: string;
  poster: string | null;
  elapsedSeconds: number;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [playbackError, setPlaybackError] = useState(false);
  const target = useRef(elapsedSeconds);
  target.current = elapsedSeconds;
  const finish = useRef(onEnded);
  finish.current = onEnded;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const resume = () => {
      if (video.paused && !video.ended) {
        void video.play().catch(() => undefined);
      }
    };
    const sync = (initial = false) => {
      if (!Number.isFinite(video.duration)) return;
      // Past the end of the video the session is over, not stuck on black.
      if (target.current >= video.duration - 0.5) {
        finish.current();
        return;
      }
      const expected = Math.min(target.current, Math.max(0, video.duration - 0.25));
      const drift = expected - video.currentTime;

      // A hard seek every few seconds can repeatedly throw a slow mobile
      // connection out of its buffered range. Only jump on initial load or
      // when substantially out of sync; use a tiny speed correction otherwise.
      if (initial || Math.abs(drift) > 10) {
        try {
          video.currentTime = expected;
        } catch {
          /* metadata not ready yet */
        }
        video.playbackRate = 1;
      } else if (drift > 1.5) {
        video.playbackRate = 1.08;
      } else if (drift < -1.5) {
        video.playbackRate = 0.92;
      } else {
        video.playbackRate = 1;
      }
      resume();
    };
    const onLoaded = () => sync(true);
    const onCanPlay = () => {
      setBuffering(false);
      setPlaybackError(false);
      resume();
    };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onError = () => {
      setBuffering(false);
      setPlaybackError(true);
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);
    const id = window.setInterval(() => sync(false), 5000);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
      window.clearInterval(id);
    };
  }, []);

  function retryPlayback() {
    const video = videoRef.current;
    if (!video) return;
    setPlaybackError(false);
    setBuffering(true);
    video.load();
    void video.play().catch(() => undefined);
  }

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        autoPlay
        muted={muted}
        playsInline
        preload="auto"
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        onContextMenu={(event) => event.preventDefault()}
        className="h-full w-full object-contain"
      />
      {buffering && !playbackError ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/35">
          <Loader2 className="h-7 w-7 animate-spin text-foreground" />
        </div>
      ) : null}
      {playbackError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 p-6 text-center">
          <p className="text-sm text-foreground">The video could not continue.</p>
          <Button type="button" variant="outline" size="sm" onClick={retryPlayback}>
            <RotateCcw className="h-4 w-4" /> Try again
          </Button>
        </div>
      ) : null}
      <div className="absolute bottom-3 right-3 flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setMuted((value) => !value);
            void videoRef.current?.play().catch(() => undefined);
          }}
          aria-label={muted ? "Unmute" : "Mute"}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-transform hover:scale-105"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void videoRef.current?.requestFullscreen?.()}
          aria-label="Fullscreen"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-transform hover:scale-105"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

function toLiveEmbedUrl(url: string, elapsedSeconds: number): string {
  const youtube = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})/,
  );
  if (youtube)
    return `https://www.youtube.com/embed/${youtube[1]}?autoplay=1&controls=0&modestbranding=1&rel=0&start=${elapsedSeconds}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo)
    return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&controls=0#t=${elapsedSeconds}s`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  if (/facebook\.com|fb\.watch/.test(url))
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=1`;
  return url;
}
