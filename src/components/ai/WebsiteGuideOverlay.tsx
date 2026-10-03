import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info, Lock, Mic, MicOff, Pause, Play, Send, Volume2, VolumeX, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { guideSpeak, guideTeach, guideTranscribe, type GuideIntent } from "@/lib/ai-guide.functions";
import {
  GUIDE_STEPS, emitGuideEvent, readGuide, stepAllowed, stepContext, subscribeGuide, writeGuide, type GuideProgress, type GuideStep,
} from "@/lib/ai-guide";
import { GUIDE_CARD_ATTR, highlightElement, watchGuidedClick } from "@/lib/guide/highlight";
import { VoiceInputService, blobToBase64, voiceInputSupported, type VoiceInputError } from "@/lib/guide/voice-input";
import { VoiceOutputService, deviceProvider, skylineProvider } from "@/lib/guide/voice-output";
import { cn } from "@/lib/utils";

let snapshot: string | null = null;
function getSnap() {
  const g = readGuide();
  snapshot = g ? JSON.stringify(g) : null;
  return snapshot;
}

export function useGuideProgress(): GuideProgress | null {
  const raw = useSyncExternalStore(subscribeGuide, getSnap, () => null);
  return raw ? (JSON.parse(raw) as GuideProgress) : null;
}

const SPEAKER_KEY = "skyline-guide-speaker";
type VoiceState = "idle" | "listening" | "thinking" | "speaking";
type Turn = { role: "ai" | "user"; text: string };

/** Floating Website Teacher shown on every page while the guide runs. */
export function WebsiteGuideOverlay() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const guide = useGuideProgress();
  if (!mounted || !guide?.active) return null;
  if (guide.paused) return createPortal(<PausedPill guide={guide} />, document.body);
  return createPortal(<GuideCard guide={guide} />, document.body);
}

function PausedPill({ guide }: { guide: GuideProgress }) {
  return (
    <div {...{ [GUIDE_CARD_ATTR]: "" }} className="fixed bottom-3 left-1/2 z-[250] flex -translate-x-1/2 items-center gap-2 rounded-full glass-panel-strong metal-edge px-3 py-2 shadow-glass">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Paused · Step {guide.stepIndex + 1}</span>
      <Button size="sm" variant="brand" onClick={() => writeGuide({ ...guide, paused: false, resumed: true })}><Play /> Resume</Button>
      <Button size="icon" variant="ghost" aria-label="Close guide" onClick={() => writeGuide({ ...guide, active: false, paused: false })}><X /></Button>
    </div>
  );
}

function GuideCard({ guide }: { guide: GuideProgress }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const teach = useServerFn(guideTeach);
  const transcribe = useServerFn(guideTranscribe);
  const remoteSpeak = useServerFn(guideSpeak);

  const step = (GUIDE_STEPS[guide.stepIndex] ?? GUIDE_STEPS[0]) as GuideStep;
  const allowed = stepAllowed(step, guide.role);
  // Beginners do not have the member dashboard, so dashboard-based clicks skip.
  const route = step.route === "/dashboard" && guide.role !== "member" ? undefined : step.route;
  const level = guide.level ?? (guide.role === "trainee" ? "beginner" : "standard");

  const [open, setOpen] = useState(true);
  const [details, setDetails] = useState(false);
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [voice, setVoice] = useState<VoiceState>("idle");
  const [locked, setLocked] = useState(false);
  const [awaitingClick, setAwaitingClick] = useState(false);
  const [expectingAnswer, setExpectingAnswer] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(() => localStorage.getItem(SPEAKER_KEY) !== "off");
  const conversational = useRef(false);
  const confusion = useRef(0);
  const guideRef = useRef(guide);
  guideRef.current = guide;

  const output = useMemo(() => new VoiceOutputService([
    skylineProvider((t) => remoteSpeak({ data: { text: t } })),
    deviceProvider(),
  ]), [remoteSpeak]);
  const input = useMemo(() => new VoiceInputService(), []);
  const passed = guide.checks?.[step.id]?.passed ?? false;

  const save = useCallback((patch: Partial<GuideProgress>) => writeGuide({ ...guideRef.current, ...patch }), []);

  // ---- speaking / listening -------------------------------------------------
  const listenRef = useRef<() => void>(() => {});
  const say = useCallback(async (reply: string, then?: () => void) => {
    setTurns((t) => [...t, { role: "ai" as const, text: reply }].slice(-12));
    if (!speakerOn) { setVoice("idle"); then?.(); return; }
    setVoice("speaking");
    const ok = await output.speak(reply, {
      onEnd: () => {
        setVoice((v) => (v === "speaking" ? "idle" : v));
        if (then) then();
        else if (conversational.current) listenRef.current();
      },
    });
    if (!ok) { setVoice("idle"); then?.(); }
  }, [output, speakerOn]);

  const busy = useRef(false);
  const go = useCallback((delta: number) => {
    const g = guideRef.current;
    const s = (GUIDE_STEPS[g.stepIndex] ?? GUIDE_STEPS[0]) as GuideStep;
    output.stop(); input.stop();
    const completed = delta > 0 && !g.completed.includes(s.id) ? [...g.completed, s.id] : g.completed;
    const skipped = delta > 0 && (!stepAllowed(s, g.role) || locked) ? Array.from(new Set([...(g.skipped ?? []), s.id])) : (g.skipped ?? []);
    if (delta > 0 && g.stepIndex === GUIDE_STEPS.length - 1) {
      writeGuide({ ...g, active: false, completed, skipped });
      toast.success("Website Guide mukammal! Shabash.");
      return;
    }
    writeGuide({ ...g, stepIndex: Math.min(GUIDE_STEPS.length - 1, Math.max(0, g.stepIndex + delta)), completed, skipped, resumed: false });
  }, [input, output, locked]);

  // ---- conversation turn ------------------------------------------------------
  const handleUtterance = useCallback(async (utterance: string) => {
    if (!utterance.trim() || busy.current) return;
    busy.current = true;
    output.stop();
    setTurns((t) => [...t, { role: "user" as const, text: utterance }].slice(-12));
    setVoice("thinking");
    try {
      const res = await teach({ data: {
        mode: "turn", stepTitle: step.title, stepContext: stepContext(step), question: step.question,
        actionSay: step.action?.say, locked: locked || !allowed, level, stepNumber: guide.stepIndex + 1,
        totalSteps: GUIDE_STEPS.length, welcome: "none", expectingAnswer, confusion: confusion.current,
        utterance, history: turns.slice(-10),
      } });
      const g = guideRef.current;
      const intent: GuideIntent = res.intent;
      if (intent === "question") save({ questions: [...(g.questions ?? []), { stepId: step.id, text: utterance }].slice(-50) });
      if (intent === "confused") {
        confusion.current += 1;
        save({ struggled: Array.from(new Set([...(g.struggled ?? []), step.id])) });
      }
      if (intent === "answer" && step.question) {
        const prev = g.checks?.[step.id] ?? { passed: false, attempts: 0 };
        const ok = res.correct === true;
        save({
          checks: { ...(g.checks ?? {}), [step.id]: { passed: prev.passed || ok, attempts: prev.attempts + 1 } },
          struggled: !ok && prev.attempts >= 1 ? Array.from(new Set([...(g.struggled ?? []), step.id])) : (g.struggled ?? []),
        });
        emitGuideEvent({ type: "answer-result", step, text: res.reply, correct: ok });
        if (ok) { setExpectingAnswer(false); await say(res.reply, () => go(1)); return; }
        setExpectingAnswer(true);
      }
      if (intent === "next" && (!step.question || passed || !allowed || locked)) { await say(res.reply, () => go(1)); return; }
      if (intent === "previous") { go(-1); return; }
      if (intent === "pause") { output.stop(); save({ paused: true }); return; }
      await say(res.reply);
    } catch (e) {
      setVoice("idle");
      toast.error(e instanceof Error ? e.message : "Skyline AI jawab nahi de saka.");
    } finally { busy.current = false; }
  }, [allowed, expectingAnswer, go, guide.stepIndex, level, locked, output, passed, save, say, step, teach, turns]);

  const startListening = useCallback(async () => {
    output.stop();
    if (!voiceInputSupported()) { toast.info("Is browser mein awaaz wala mode nahi chalta. Filhal text mode mein continue karein."); return; }
    conversational.current = true;
    setVoice("listening");
    try {
      const { blob, mime } = await input.listen();
      setVoice("thinking");
      const { text: heard } = await transcribe({ data: { audio: await blobToBase64(blob), mime } });
      if (!heard) { setVoice("idle"); await say("Mujhe aapki baat clear nahi mili. Dobara bol dein."); return; }
      await handleUtterance(heard);
    } catch (err) {
      setVoice("idle");
      const code = err as VoiceInputError;
      if (code === "denied") {
        conversational.current = false;
        toast.error("Microphone permission band hai. Aap browser settings se microphone allow kar sakte hain, ya filhal text mode mein continue kar sakte hain.");
      } else if (code === "empty") {
        conversational.current = false;
      } else {
        toast.error("Mujhe aapki baat clear nahi mili. Dobara bol dein.");
      }
    }
  }, [handleUtterance, input, output, say, transcribe]);
  listenRef.current = () => { void startListening(); };

  // ---- step enter: navigate, detect access, highlight, teach -----------------
  useEffect(() => {
    setTurns([]); setText(""); setLocked(false); setAwaitingClick(false); setExpectingAnswer(false); setOpen(true);
    confusion.current = 0;
    emitGuideEvent({ type: "step-enter", step });
    if (allowed && route && pathname !== route) void navigate({ to: route });
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let isLocked = false;
      if (allowed && route && !["/dashboard", "/notifications", "/ai"].includes(route)) {
        const nav = document.querySelector(`[data-ai-guide="nav:${route}"]`);
        if (document.querySelector('[data-ai-guide="menu-button"]') && (!nav || nav.getAttribute("data-ai-guide-locked") === "true")) isLocked = true;
      }
      setLocked(isLocked);
      const g = guideRef.current;
      const welcome = g.stepIndex === 0 && g.completed.length === 0 && !g.resumed ? "first" : g.resumed ? "resume" : "none";
      setVoice("thinking");
      try {
        const res = await teach({ data: {
          mode: "teach", stepTitle: step.title, stepContext: stepContext(step), question: step.question,
          actionSay: step.action?.say, locked: isLocked || !allowed, level, stepNumber: g.stepIndex + 1,
          totalSteps: GUIDE_STEPS.length, welcome, expectingAnswer: false, confusion: 0, history: [],
        } });
        if (cancelled) return;
        if (g.resumed) save({ resumed: false });
        const clickable = Boolean(step.action && allowed && !isLocked && route);
        setAwaitingClick(clickable);
        setExpectingAnswer(!clickable && Boolean(step.question) && allowed && !isLocked && !(g.checks?.[step.id]?.passed));
        if (step.question) emitGuideEvent({ type: "question", step, text: step.question });
        await say(res.reply);
      } catch {
        if (!cancelled) { setVoice("idle"); setTurns([{ role: "ai", text: `${step.where} ${step.what}` }]); }
      }
    }, 900);
    return () => { cancelled = true; window.clearTimeout(timer); output.stop(); input.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  // Exact highlight follows the current screen.
  useEffect(() => {
    if (!allowed || !step.target) return;
    let cleanup = () => {};
    const t = window.setTimeout(() => { cleanup = highlightElement(step.target as string, { strong: awaitingClick }); }, 700);
    return () => { window.clearTimeout(t); cleanup(); };
  }, [allowed, awaitingClick, pathname, step.target]);

  // Guided click: the user must click the exact element themselves.
  useEffect(() => {
    if (!awaitingClick || !step.action) return;
    const action = step.action;
    return watchGuidedClick(action.target, {
      onCorrect: () => {
        setAwaitingClick(false);
        setExpectingAnswer(Boolean(step.question) && !passed);
        void say(action.success + (step.question && !passed ? ` ${step.question}` : ""));
      },
      onWrong: () => {
        highlightElement(action.target, { strong: true });
        void say("Ye nahi. Main aapko correct option highlight karta hoon.");
      },
    });
  }, [awaitingClick, passed, say, step]);

  useEffect(() => () => { output.stop(); input.stop(); }, [input, output]);

  function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    localStorage.setItem(SPEAKER_KEY, next ? "on" : "off");
    if (!next) { output.stop(); setVoice((v) => (v === "speaking" ? "idle" : v)); }
  }

  function onMic() {
    if (voice === "listening") { input.stop(); conversational.current = false; return; }
    void startListening();
  }

  const total = GUIDE_STEPS.length;
  const pct = Math.round(((guide.stepIndex + 1) / total) * 100);
  const STATE: Record<VoiceState, { label: string; tone: string }> = {
    idle: { label: "READY", tone: "text-muted-foreground" },
    listening: { label: "LISTENING · AI sun raha hai", tone: "text-cyan" },
    thinking: { label: "THINKING · AI soch raha hai", tone: "text-brand-glow" },
    speaking: { label: "SPEAKING · AI bol raha hai", tone: "text-cyan" },
  };
  const lastAi = [...turns].reverse().find((t) => t.role === "ai");

  return (
    <div {...{ [GUIDE_CARD_ATTR]: "" }} className="fixed inset-x-2 bottom-2 z-[250] mx-auto max-w-md sm:bottom-4" role="dialog" aria-label="Website Guide">
      <div className="glass-panel-strong metal-edge overflow-hidden rounded-2xl text-foreground shadow-glass">
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan">Website Guide · Step {guide.stepIndex + 1} of {total}</p>
            <p className="truncate font-display text-sm font-semibold">{step.title}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label={speakerOn ? "Speaker off" : "Speaker on"} onClick={toggleSpeaker}>{speakerOn ? <Volume2 /> : <VolumeX />}</Button>
          <Button variant="ghost" size="icon" aria-label={open ? "Collapse" : "Expand"} onClick={() => setOpen((v) => !v)}>{open ? <ChevronDown /> : <ChevronUp />}</Button>
          <Button variant="ghost" size="icon" aria-label="Pause tour" onClick={() => { output.stop(); input.stop(); save({ paused: true }); }}><X /></Button>
        </div>
        <div className="h-1 bg-surface-2"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>

        <div className={cn("flex items-center gap-2 px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.14em]", STATE[voice].tone)} aria-live="polite">
          <span className={cn("guide-state-dot", voice !== "idle" && "is-active")} />
          {STATE[voice].label}
        </div>

        {open ? (
          <div className="max-h-[42dvh] space-y-2 overflow-y-auto px-3 py-2 text-sm leading-6">
            {!allowed || locked ? (
              <p className="flex items-start gap-2 rounded-lg border border-hairline bg-surface p-2 text-muted-foreground">
                <Lock className="mt-1 h-4 w-4 shrink-0" />
                Ye feature aapke current level par available nahi hai. Jab aap required stage par pohanchein ge to ye option unlock hoga.
              </p>
            ) : null}
            {turns.length === 0 ? <p className="text-muted-foreground">{step.where}</p> : null}
            {turns.slice(-4).map((t, i) => (
              <p key={i} className={cn("whitespace-pre-wrap rounded-xl px-3 py-2", t.role === "ai" ? "border border-hairline bg-surface" : "ml-8 bg-primary/15 text-right")}>{t.text}</p>
            ))}
            {awaitingClick && step.action ? <p className="rounded-lg border border-cyan/40 bg-primary/10 p-2 text-xs font-semibold">{step.action.say}</p> : null}

            <button type="button" onClick={() => setDetails((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Info className="h-3.5 w-3.5" /> {details ? "Details chhupayein" : "Is section ki details"}
            </button>
            {details ? (
              <div className="space-y-1 rounded-lg border border-hairline p-2 text-xs text-muted-foreground">
                <p>{step.what}</p>
                <p><span className="font-semibold text-foreground">Kyun? </span>{step.why}</p>
                <ul className="ml-4 list-disc">{step.canDo.map((c) => <li key={c}>{c}</li>)}</ul>
                {step.buttons ? <ul className="ml-4 list-disc">{step.buttons.map((b) => <li key={b}>{b}</li>)}</ul> : null}
                {step.avoid ? <p className="text-destructive">Dhyan rakhein: {step.avoid}</p> : null}
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1000}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const v = text; setText(""); void handleUtterance(v); } }}
                placeholder={expectingAnswer ? "Apna jawab likhein ya bolein..." : "Ask AI: is section ke baare mein poochein..."} className="min-h-10 bg-surface" />
              <Button size="icon" variant="outline" aria-label="Send" disabled={!text.trim() || voice === "thinking"} onClick={() => { const v = text; setText(""); void handleUtterance(v); }}><Send /></Button>
            </div>
          </div>
        ) : lastAi ? <p className="line-clamp-2 px-3 py-1 text-xs text-muted-foreground">{lastAi.text}</p> : null}

        <div className="flex items-center gap-2 border-t border-hairline px-3 py-2">
          <Button size="icon" variant="outline" className="h-11 w-11" aria-label="Previous step" disabled={guide.stepIndex === 0} onClick={() => go(-1)}><ChevronLeft /></Button>
          <Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Pause guide" onClick={() => { output.stop(); input.stop(); save({ paused: true }); }}><Pause /></Button>
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={onMic}
              aria-label={voice === "listening" ? "Stop listening" : "Start listening"}
              className={cn("guide-mic flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glass", voice === "listening" && "is-listening")}
            >
              {voice === "listening" ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
          </div>
          <Button size="sm" variant="brand" className="h-11" onClick={() => go(1)}>{guide.stepIndex === total - 1 ? "Finish" : "Next"} <ChevronRight /></Button>
        </div>
        <p className="px-3 pb-2 text-center text-[10px] text-muted-foreground">Mic dabakar kabhi bhi AI ko rok kar sawal poochein.</p>
      </div>
    </div>
  );
}
