import { Maximize, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* Minimal typing for the YouTube IFrame API. */
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(s: number, allow: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiPromise;
}

export function youtubeId(url: string): string | null {
  return (
    url.match(
      /(?:youtube(?:-nocookie)?\.com\/watch\?v=|youtu\.be\/|youtube(?:-nocookie)?\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([\w-]{6,})/,
    )?.[1] ?? null
  );
}

const fmt = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/**
 * In-site YouTube player: no YouTube controls, links, recommendations or end screen.
 * Forward seeking is limited to the furthest point already watched (saved per video).
 */
export function SecureYouTubePlayer({
  url,
  title,
  autoplay,
  onWatched,
}: {
  url: string;
  title: string;
  autoplay?: boolean;
  /** Called once the full video has been watched. */
  onWatched?: () => void;
}) {
  const id = youtubeId(url)!;
  const key = `sa-watch:${id}`;
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const maxRef = useRef(0);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [maxWatched, setMaxWatched] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [notice, setNotice] = useState("");
  const watchedCb = useRef(onWatched);
  watchedCb.current = onWatched;

  useEffect(() => {
    maxRef.current = Number(localStorage.getItem(key) || 0);
    setMaxWatched(maxRef.current);
    let cancelled = false;
    void loadApi().then(() => {
      if (cancelled || !host.current || !window.YT) return;
      player.current = new window.YT.Player(host.current, {
        videoId: id,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          autoplay: autoplay ? 1 : 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            setDuration(e.target.getDuration());
            if (maxRef.current > 5) e.target.seekTo(Math.max(0, maxRef.current - 2), true);
          },
          onStateChange: (e: { data: number }) => {
            setPlaying(e.data === 1);
            if (e.data === 0) {
              setEnded(true);
              player.current?.stopVideo();
              watchedCb.current?.();
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
    };
  }, [id, key, autoplay]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const p = player.current;
      if (!p?.getCurrentTime) return;
      const now = p.getCurrentTime();
      const d = p.getDuration() || 0;
      if (d) setDuration(d);
      // Block forward jumps (e.g. keyboard / any player seek) beyond watched content.
      if (now > maxRef.current + 3) {
        p.seekTo(maxRef.current, true);
        setNotice("Aage skip nahi kar sakte — pehle video dekhein.");
        return;
      }
      if (now > maxRef.current) {
        maxRef.current = now;
        setMaxWatched(now);
        localStorage.setItem(key, String(Math.floor(now)));
      }
      setTime(now);
    }, 500);
    return () => window.clearInterval(t);
  }, [key]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 2500);
    return () => window.clearTimeout(t);
  }, [notice]);

  const toggle = () => {
    const p = player.current;
    if (!p) return;
    if (ended) {
      setEnded(false);
      p.seekTo(0, true);
      p.playVideo();
      return;
    }
    if (playing) p.pauseVideo();
    else p.playVideo();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = player.current;
    if (!p || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    let target = ((e.clientX - r.left) / r.width) * duration;
    if (target > maxRef.current) {
      target = maxRef.current;
      setNotice("Aage skip nahi kar sakte — sirf dekha hua hissa dobara dekh sakte hain.");
    }
    setEnded(false);
    p.seekTo(target, true);
    setTime(target);
  };

  const full = () => {
    const el = wrap.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const pct = (v: number) => (duration ? `${Math.min(100, (v / duration) * 100)}%` : "0%");

  return (
    <div ref={wrap} className="relative h-full w-full bg-media" onContextMenu={(e) => e.preventDefault()}>
      <div className="pointer-events-none absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full">
        <div ref={host} title={title} />
      </div>
      {/* Click shield: no taps ever reach YouTube's own links. */}
      <button type="button" aria-label={playing ? "Pause" : "Play"} className="absolute inset-0 h-full w-full" onClick={toggle} />

      {ended ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-media text-center">
          <p className="font-display text-base font-bold text-foreground">Video mukammal ho gayi ✅</p>
          <button type="button" onClick={toggle} className="flex items-center gap-2 rounded-full border border-cyan/40 bg-primary/80 px-4 py-2 text-sm font-semibold text-primary-foreground">
            <RotateCcw className="h-4 w-4" /> Dobara dekhein
          </button>
        </div>
      ) : !playing ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan/40 bg-primary/90 text-primary-foreground shadow-brand">
          <Play className="ml-0.5 h-6 w-6" />
        </span>
      ) : null}

      {notice ? (
        <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-media/90 px-3 py-1 text-[11px] font-semibold text-foreground">{notice}</p>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-media to-transparent px-3 pb-2 pt-6 text-[11px] text-foreground">
        <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <span className="tabular-nums">{fmt(time)}</span>
        <div className="relative h-2 flex-1 cursor-pointer rounded-full bg-foreground/20" onClick={seek} role="slider" aria-label="Video progress" aria-valuenow={Math.round(time)} aria-valuemax={Math.round(duration)}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-foreground/35" style={{ width: pct(maxWatched) }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: pct(time) }} />
        </div>
        <span className="tabular-nums">{fmt(duration)}</span>
        <button type="button" onClick={full} aria-label="Full screen">
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
