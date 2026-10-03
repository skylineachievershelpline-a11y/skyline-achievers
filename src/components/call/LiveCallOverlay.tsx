/**
 * Skyline AI Live Teacher — the call screen.
 * One mounted owner for the call so it survives route changes: the person can
 * minimise the call, move around the website, and Skyline AI keeps seeing
 * the shared screen and pointing things out.
 */
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  Hand,
  Maximize2,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Phone,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  UserPlus,
  Circle,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import robot from "@/assets/skyline-ai-robot-clean.png";
import { Button } from "@/components/ui/button";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { summarizeLiveCall, type CallSummary } from "@/lib/live-call.functions";
import {
  CALL_UI_ATTR,
  captureFrame,
  collectAppScreen,
  startDisplayShare,
  supportsDisplayShare,
} from "@/lib/live-call/screen";
import { closeLiveCall, useLiveCallOpen } from "@/lib/live-call/store";
import { getAccessToken } from "@/lib/session-token";
import { cn } from "@/lib/utils";

import { LiveAnnotations, type LiveMark } from "./LiveAnnotations";

type Line = { role: "user" | "assistant"; text: string; at: number };
type Share = null | "app" | "display";

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function LiveCallOverlay() {
  const open = useLiveCallOpen();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mode, setMode] = useState<"voice" | "video">("voice");
  const [view, setView] = useState<"full" | "mini">("full");
  const [lines, setLines] = useState<Line[]>([]);
  const [speakingAt, setSpeakingAt] = useState(0);
  const [hearingAt, setHearingAt] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [marks, setMarks] = useState<LiveMark[]>([]);
  const [share, setShare] = useState<Share>(null);
  const [shareNotice, setShareNotice] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  const [, setTick] = useState(0);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const displayStream = useRef<MediaStream | null>(null);
  const displayVideo = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const lastSent = useRef("");
  const markTimer = useRef<number | undefined>(undefined);
  const summarize = useServerFn(summarizeLiveCall);

  const onEvent = useCallback((event: LiveEvent) => {
    const type = event.type;
    if (type === "session.output_transcript.delta" || type === "session.input_transcript.delta") {
      const delta = typeof event["delta"] === "string" ? event["delta"] : "";
      if (!delta) return;
      const role: Line["role"] = type === "session.output_transcript.delta" ? "assistant" : "user";
      const now = Date.now();
      if (role === "assistant") setSpeakingAt(now);
      else setHearingAt(now);
      setLines((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === role && now - last.at < 4000) {
          return [...prev.slice(0, -1), { role, text: last.text + delta, at: now }];
        }
        return [...prev, { role, text: delta.trimStart(), at: now }].slice(-80);
      });
    } else if (type === "app.connected") {
      setStartedAt(Date.now());
    } else if (type === "app.delegation.pending") {
      setThinking(true);
    } else if (type === "app.delegation.done") {
      setThinking(false);
    } else if (type === "app.annotate") {
      const raw = Array.isArray(event["marks"]) ? (event["marks"] as Omit<LiveMark, "key">[]) : [];
      const next = raw.map((m, i) => ({ ...m, key: `${Date.now()}-${i}` }));
      setMarks((prev) => (event["clear_previous"] ? next : [...prev, ...next].slice(-6)));
      window.clearTimeout(markTimer.current);
      markTimer.current = window.setTimeout(() => setMarks([]), 30_000);
    } else if (type === "app.closed") {
      setEndedAt(Date.now());
      setThinking(false);
    }
  }, []);

  const voice = useLiveVoice({
    onEvent,
    getStartPayload: async () => ({ token: (await getAccessToken()) ?? "" }),
  });
  const live = voice.status === "connecting" || voice.status === "connected";

  // Re-render the timer and speaking state.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 500);
    return () => window.clearInterval(id);
  }, [live]);

  const stopDisplay = useCallback(() => {
    displayStream.current?.getTracks().forEach((t) => t.stop());
    displayStream.current = null;
    if (displayVideo.current) displayVideo.current.srcObject = null;
  }, []);

  const stopShare = useCallback(() => {
    stopDisplay();
    setShare(null);
    setMarks([]);
    lastSent.current = "";
    voice.sendApp({ type: "app.screen.stopped" });
  }, [stopDisplay, voice]);

  const stopCamera = useCallback(() => {
    cameraStream.current?.getTracks().forEach((t) => t.stop());
    cameraStream.current = null;
    setCameraOn(false);
  }, []);

  // Live screen feed while sharing: the current Skyline view (and frames of a real screen share).
  useEffect(() => {
    if (!share || voice.status !== "connected") return;
    let frameAt = 0;
    const send = (force = false) => {
      const app = collectAppScreen();
      const sig = `${app.route}|${app.elements}`;
      const wantFrame = share === "display" && Date.now() - frameAt > 4000;
      if (!force && sig === lastSent.current && !wantFrame) return;
      const image = wantFrame && displayVideo.current ? captureFrame(displayVideo.current) : null;
      if (image) frameAt = Date.now();
      if (voice.sendApp({ type: "app.screen", source: share, ...app, ...(image ? { image } : {}) })) {
        lastSent.current = sig;
      }
    };
    send(true);
    const id = window.setInterval(() => send(), 2000);
    return () => window.clearInterval(id);
  }, [share, voice.status, pathname, voice]);

  // Call ended: release screen and camera.
  useEffect(() => {
    if (voice.status === "closed") {
      stopDisplay();
      setShare(null);
      setMarks([]);
      stopCamera();
      setView("full");
    }
  }, [voice.status, stopDisplay, stopCamera]);

  if (!open) return <audio ref={voice.audioRef} className="hidden" autoPlay />;

  const now = Date.now();
  const speaking = now - speakingAt < 1400;
  const hearing = now - hearingAt < 1400;
  const state =
    voice.status === "connecting"
      ? "CONNECTING"
      : voice.status === "stopping"
        ? "ENDING"
        : voice.status === "closed"
          ? "ENDED"
          : voice.muted
            ? "MUTED"
            : speaking
              ? "SPEAKING"
              : thinking
                ? "THINKING"
                : "LISTENING";
  const stateText: Record<string, string> = {
    CONNECTING: "Skyline AI se rabta ho raha hai…",
    LISTENING: hearing ? "Aap ki baat sun raha hai" : "Sun raha hai — boliye",
    THINKING: "Soch raha hai…",
    SPEAKING: "Bol raha hai",
    MUTED: "Aap ka mic band hai — AI aap ko nahi sun sakta",
    ENDING: "Call band ho rahi hai…",
    ENDED: "Call khatam",
  };
  const elapsed = startedAt ? (endedAt || now) - startedAt : 0;
  const idle = voice.status === "idle";
  const ended = voice.status === "closed";

  function begin(kind: "voice" | "video") {
    setMode(kind);
    setLines([]);
    setSummary(null);
    setStartedAt(0);
    setEndedAt(0);
    setThinking(false);
    voice.start();
  }

  function toggleMute() {
    const next = !voice.muted;
    voice.setMuted(next);
    voice.sendApp({ type: "app.mute", muted: next });
  }

  function excuseMe() {
    if (voice.muted) {
      voice.setMuted(false);
      voice.sendApp({ type: "app.mute", muted: false });
    }
    const audio = voice.audioRef.current;
    if (audio) {
      audio.volume = 0;
      window.setTimeout(() => {
        if (voice.audioRef.current) voice.audioRef.current.volume = 1;
      }, 700);
    }
    voice.sendApp({ type: "app.excuse" });
  }

  function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    if (voice.audioRef.current) voice.audioRef.current.muted = !next;
  }

  async function toggleCamera() {
    if (cameraOn) {
      stopCamera();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      cameraStream.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (cameraVideo.current) cameraVideo.current.srcObject = stream;
      });
    } catch {
      toast.error("Camera ki ijazat nahi mili. Browser settings se camera allow karein.");
    }
  }

  async function beginShare(kind: "app" | "display") {
    setShareNotice(false);
    if (kind === "display") {
      try {
        const stream = await startDisplayShare();
        displayStream.current = stream;
        stream.getVideoTracks()[0]?.addEventListener("ended", () => stopShare());
        if (displayVideo.current) {
          displayVideo.current.srcObject = stream;
          void displayVideo.current.play().catch(() => {});
        }
        setShare("display");
        setView("mini");
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotAllowedError") return;
        toast.message("Is device par poori screen share nahi ho saki. Skyline screen share shuru kar raha hoon.");
        setShare("app");
        setView("mini");
      }
      return;
    }
    setShare("app");
    setView("mini");
  }

  async function endCall() {
    voice.stop();
  }

  async function makeSummary() {
    const transcript = lines
      .map((l) => `${l.role === "assistant" ? "AI" : "User"}: ${l.text.trim()}`)
      .join("\n")
      .slice(-16_000);
    if (!transcript.trim()) return toast.message("Is call mein summary ke liye baat cheet nahi mili.");
    setSummarizing(true);
    try {
      setSummary(await summarize({ data: { transcript } }));
    } catch {
      toast.error("Summary abhi nahi ban saki. Dobara koshish karein.");
    } finally {
      setSummarizing(false);
    }
  }

  function closeAll() {
    if (live) voice.stop();
    stopCamera();
    stopDisplay();
    setShare(null);
    setMarks([]);
    closeLiveCall();
  }

  const lastAi = [...lines].reverse().find((l) => l.role === "assistant");
  const lastUser = [...lines].reverse().find((l) => l.role === "user");
  const stateChip = (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide",
        state === "MUTED" || state === "ENDED" ? "border-destructive/40 text-destructive" : "border-cyan/40 text-cyan",
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", state === "MUTED" ? "bg-destructive" : "bg-cyan", (state === "SPEAKING" || state === "LISTENING") && "animate-pulse")} />
      {state}
    </span>
  );

  return (
    <>
      <audio ref={voice.audioRef} className="hidden" autoPlay />
      <video ref={displayVideo} className="hidden" muted playsInline />
      <LiveAnnotations marks={marks} />

      {view === "mini" && !ended && !idle ? (
        <div
          {...{ [CALL_UI_ATTR]: "" }}
          className="fixed inset-x-3 bottom-3 z-[96] mx-auto max-w-md rounded-3xl border border-cyan/30 bg-card/95 p-3 shadow-brand backdrop-blur-xl"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-3">
            <img src={robot} alt="" className={cn("h-10 w-10 rounded-full object-cover ring-2", speaking ? "ring-cyan" : "ring-border")} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {stateChip}
                <span className="font-mono text-xs text-muted-foreground">{clock(elapsed)}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {share ? (share === "display" ? "Screen share on" : "Skyline screen share on") : stateText[state]}
              </p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Call screen kholein" onClick={() => setView("full")}>
              <Maximize2 />
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <Button variant={voice.muted ? "destructive" : "secondary"} className="h-12" onClick={toggleMute} aria-label={voice.muted ? "Unmute" : "Mute"}>
              {voice.muted ? <MicOff /> : <Mic />}
            </Button>
            <Button variant="brand" className="h-12" onClick={excuseMe} aria-label="Excuse me">
              <Hand />
            </Button>
            <Button variant="secondary" className="h-12" onClick={share ? stopShare : () => setShareNotice(true)} aria-label={share ? "Stop sharing" : "Share screen"}>
              {share ? <MonitorX /> : <MonitorUp />}
            </Button>
            <Button variant="destructive" className="h-12" onClick={() => void endCall()} aria-label="End call">
              <PhoneOff />
            </Button>
          </div>
        </div>
      ) : null}

      {view === "full" || idle || ended ? (
        <div
          {...{ [CALL_UI_ATTR]: "" }}
          className="fixed inset-0 z-[96] flex flex-col bg-background/97 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
          role="dialog"
          aria-label="Skyline AI call"
        >
          <header className="flex items-center justify-between px-4 py-3">
            {live ? (
              <Button size="icon" variant="ghost" aria-label="Call chhota karein" onClick={() => setView("mini")}>
                <ChevronDown />
              </Button>
            ) : (
              <Button size="icon" variant="ghost" aria-label="Band karein" onClick={closeAll}>
                <X />
              </Button>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {!idle ? stateChip : null}
              {share ? (
                <span className="rounded-full border border-primary/40 px-3 py-1 text-[11px] font-bold text-primary">SCREEN SHARING</span>
              ) : null}
            </div>
            <span className="w-10 text-right font-mono text-xs text-muted-foreground">{startedAt ? clock(elapsed) : ""}</span>
          </header>

          <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-5">
            {idle ? (
              <div className="w-full max-w-sm text-center">
                <img src={robot} alt="Skyline AI" className="mx-auto h-32 w-32 rounded-full object-cover ring-4 ring-cyan/40" />
                <h2 className="mt-5 font-display text-2xl font-bold">Call Skyline AI</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Apne Skyline teacher se baat karein. Screen share karein to wo aap ki screen dekh kar samjhayega.
                </p>
                <div className="mt-7 grid gap-3">
                  <Button variant="brand" size="xl" className="rounded-2xl" onClick={() => begin("voice")}>
                    <Phone /> Voice Call
                  </Button>
                  <Button variant="secondary" size="xl" className="rounded-2xl" onClick={() => begin("video")}>
                    <Video /> Video Call
                  </Button>
                </div>
                {voice.error ? <p className="mt-4 text-sm text-destructive" role="alert">{voice.error}</p> : null}
              </div>
            ) : ended ? (
              <div className="w-full max-w-sm text-center">
                <PhoneOff className="mx-auto h-10 w-10 text-muted-foreground" />
                <h2 className="mt-3 font-display text-2xl font-bold">Call Ended</h2>
                <p className="mt-1 font-mono text-sm text-muted-foreground">{clock(elapsed)}</p>
                {voice.error && !voice.hasConnected ? <p className="mt-3 text-sm text-destructive" role="alert">{voice.error}</p> : null}
                {summary ? (
                  <div className="raised-panel mt-5 space-y-3 rounded-2xl p-4 text-left text-sm">
                    <div>
                      <p className="text-xs font-bold uppercase text-cyan">What we covered</p>
                      <ul className="mt-1 list-disc pl-5">{summary.covered.map((c) => <li key={c}>{c}</li>)}</ul>
                    </div>
                    <p><span className="text-xs font-bold uppercase text-cyan">Questions</span> — {summary.questions}</p>
                    {summary.unclear.length ? (
                      <div>
                        <p className="text-xs font-bold uppercase text-cyan">Still unclear</p>
                        <ul className="mt-1 list-disc pl-5">{summary.unclear.map((c) => <li key={c}>{c}</li>)}</ul>
                      </div>
                    ) : null}
                    {summary.next ? <p><span className="text-xs font-bold uppercase text-cyan">Next step</span> — {summary.next}</p> : null}
                  </div>
                ) : lines.length ? (
                  <Button variant="secondary" className="mt-5 w-full" disabled={summarizing} onClick={() => void makeSummary()}>
                    {summarizing ? "Summary ban rahi hai…" : "Call ki summary dekhein"}
                  </Button>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">Ye call record nahi hui aur kisi ke saath share nahi hoti.</p>
                <div className="mt-5 grid gap-2">
                  <Button variant="brand" onClick={() => begin(mode)}>Dobara call karein</Button>
                  <Button variant="ghost" onClick={closeAll}>Band karein</Button>
                </div>
              </div>
            ) : (
              <>
                <div className={cn("grid w-full max-w-md gap-3", mode === "video" ? "grid-cols-1" : "")}>
                  <div className="raised-panel relative flex aspect-[4/3] flex-col items-center justify-center rounded-3xl">
                    <div className={cn("rounded-full p-1 transition-shadow", speaking ? "shadow-[0_0_0_6px_var(--color-cyan)]" : "")}>
                      <img src={robot} alt="Skyline AI" className="h-28 w-28 rounded-full object-cover" />
                    </div>
                    <p className="mt-3 font-display text-lg font-bold">Skyline AI</p>
                    <p className="text-xs text-muted-foreground">{stateText[state]}</p>
                  </div>
                  {mode === "video" ? (
                    <div className="raised-panel relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl">
                      {cameraOn ? (
                        <video ref={cameraVideo} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
                      ) : (
                        <p className="px-6 text-center text-sm text-muted-foreground">Aap ka camera band hai</p>
                      )}
                      <span className="absolute bottom-2 left-3 text-xs font-bold">Aap</span>
                    </div>
                  ) : null}
                </div>
                {mode === "video" && cameraOn ? (
                  <p className="text-center text-[11px] text-muted-foreground">Camera sirf aap ko dikhta hai — Skyline AI aap ka camera nahi dekhta.</p>
                ) : null}
                <div className="w-full max-w-md space-y-2 text-sm" aria-live="polite">
                  {lastUser ? <p className="truncate text-muted-foreground"><span className="font-bold">Aap:</span> {lastUser.text}</p> : null}
                  {lastAi ? <p className="line-clamp-3"><span className="font-bold text-cyan">Skyline AI:</span> {lastAi.text}</p> : null}
                </div>
                {voice.playbackBlocked ? (
                  <Button variant="brand" onClick={voice.resumePlayback}><Volume2 /> Awaaz chalayein</Button>
                ) : null}
                {voice.error ? <p className="text-center text-sm text-destructive" role="alert">{voice.error}</p> : null}
              </>
            )}
          </main>

          {live ? (
            <footer className="px-4 pb-5 pt-2">
              <Button variant="brand" size="xl" className="mb-3 w-full rounded-2xl" onClick={excuseMe} disabled={voice.status !== "connected"}>
                <Hand /> Excuse Me
              </Button>
              <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
                <CallControl label={voice.muted ? "Unmute" : "Mute"} active={voice.muted} danger={voice.muted} onClick={toggleMute} disabled={voice.status !== "connected"}>
                  {voice.muted ? <MicOff /> : <Mic />}
                </CallControl>
                <CallControl label={speakerOn ? "Speaker" : "Speaker off"} active={!speakerOn} onClick={toggleSpeaker}>
                  {speakerOn ? <Volume2 /> : <VolumeX />}
                </CallControl>
                <CallControl label={share ? "Stop share" : "Share Screen"} active={Boolean(share)} onClick={share ? stopShare : () => setShareNotice(true)} disabled={voice.status !== "connected"}>
                  {share ? <MonitorX /> : <MonitorUp />}
                </CallControl>
                {mode === "video" ? (
                  <CallControl label={cameraOn ? "Camera off" : "Camera"} active={cameraOn} onClick={() => void toggleCamera()}>
                    {cameraOn ? <Video /> : <VideoOff />}
                  </CallControl>
                ) : (
                  <CallControl label="Add (jald)" disabled onClick={() => {}}>
                    <UserPlus />
                  </CallControl>
                )}
                {mode === "video" ? (
                  <CallControl label="Add (jald)" disabled onClick={() => {}}>
                    <UserPlus />
                  </CallControl>
                ) : null}
                <CallControl label="Record (jald)" disabled onClick={() => {}}>
                  <Circle />
                </CallControl>
                <div className={cn("flex flex-col items-center gap-1", mode === "video" ? "col-span-2" : "col-span-2")}>
                  <Button variant="destructive" className="h-14 w-full rounded-2xl" onClick={() => void endCall()} aria-label="End call">
                    <PhoneOff /> End
                  </Button>
                </div>
              </div>
            </footer>
          ) : null}
        </div>
      ) : null}

      {shareNotice ? (
        <div {...{ [CALL_UI_ATTR]: "" }} className="fixed inset-0 z-[98] flex items-end justify-center bg-background/70 p-4 sm:items-center">
          <div className="raised-panel w-full max-w-sm rounded-3xl p-5">
            <MonitorUp className="h-7 w-7 text-cyan" />
            <h3 className="mt-3 font-display text-lg font-bold">Screen share</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your selected screen/window will be visible to Skyline AI during this call.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Screen save nahi hoti. Share band karte hi Skyline AI aap ki screen dekhna band kar deta hai.
            </p>
            <div className="mt-5 grid gap-2">
              {supportsDisplayShare() ? (
                <>
                  <Button variant="brand" onClick={() => void beginShare("display")}>Screen share karein</Button>
                  <Button variant="secondary" onClick={() => void beginShare("app")}>Sirf Skyline screen dikhayein</Button>
                </>
              ) : (
                <>
                  <Button variant="brand" onClick={() => void beginShare("app")}>Skyline screen share karein</Button>
                  <p className="text-[11px] text-muted-foreground">
                    Is phone ke browser mein poori screen share nahi hoti. Skyline AI wahi Skyline screen dekhega jo aap khole hue hain.
                  </p>
                </>
              )}
              <Button variant="ghost" onClick={() => setShareNotice(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CallControl({
  label,
  children,
  onClick,
  active,
  danger,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant={danger ? "destructive" : active ? "brand" : "secondary"}
        className="h-14 w-full rounded-2xl"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        {children}
      </Button>
      <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}
