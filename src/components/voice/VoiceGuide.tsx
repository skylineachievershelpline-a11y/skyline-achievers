import { Languages, Loader2, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  readVoiceLang,
  speak,
  stopVoice,
  supportsVoice,
  writeVoiceLang,
  type VoiceLang,
} from "@/lib/voice-guide";

type Props = {
  /** Urdu script (Roman Urdu reads well on most devices). */
  ur: string;
  /** English script. */
  en: string;
  /** Small label shown beside the speaker button. */
  label?: string;
  className?: string;
};

type PlayState = "idle" | "searching" | "speaking";

/**
 * Shared play logic: shows a "Searching…" state while the device voice engine
 * prepares, then switches to the speaking state until the voice finishes.
 */
function useVoicePlayer() {
  const [state, setState] = useState<PlayState>("idle");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopVoice();
    };
  }, []);

  function play(text: string, lang: VoiceLang) {
    stopVoice();
    setState("searching");
    speak(text, lang, {
      onStart: () => mounted.current && setState("speaking"),
      onEnd: () => mounted.current && setState("idle"),
    });
  }

  function stop() {
    stopVoice();
    setState("idle");
  }

  return { state, play, stop };
}

/**
 * Compact header control: one speaker button that reads the page guidance, and
 * a small chip to switch between Urdu and English. Always visible on mobile.
 */
export function VoiceGuideButton({ ur, en }: { ur: string; en: string }) {
  const [lang, setLang] = useState<VoiceLang>("ur");
  const [ready, setReady] = useState(false);
  const { state, play, stop } = useVoicePlayer();

  useEffect(() => {
    setReady(supportsVoice());
    setLang(readVoiceLang());
  }, []);

  if (!ready) return null;

  function start(next: VoiceLang) {
    setLang(next);
    writeVoiceLang(next);
    play(next === "ur" ? ur : en, next);
  }

  const busy = state !== "idle";

  return (
    <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-metal/30 bg-surface shadow-glass">
      <button
        type="button"
        onClick={() => (busy ? stop() : start(lang))}
        aria-label={busy ? "Stop the voice guide" : "Listen to the guide for this screen"}
        className="flex h-9 items-center gap-1 px-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {state === "searching" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-brand-glow" />
            <span className="text-[10px] font-semibold text-brand-glow">Searching…</span>
          </>
        ) : state === "speaking" ? (
          <Square className="h-4 w-4 text-brand-glow" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        onClick={() => start(lang === "ur" ? "en" : "ur")}
        aria-label="Switch voice language"
        className="h-9 border-l border-metal/30 px-2 text-[10px] font-semibold uppercase tracking-wide text-brand-glow"
      >
        {lang === "ur" ? "UR" : "EN"}
      </button>
    </div>
  );
}

export function VoiceGuide({ ur, en, label = "Listen", className = "" }: Props) {
  const [lang, setLang] = useState<VoiceLang>("ur");
  const [ready, setReady] = useState(false);
  const { state, play, stop } = useVoicePlayer();

  useEffect(() => {
    setReady(supportsVoice());
    setLang(readVoiceLang());
  }, []);

  if (!ready) return null;

  function start(next: VoiceLang) {
    setLang(next);
    writeVoiceLang(next);
    play(next === "ur" ? ur : en, next);
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => start(lang)}
        disabled={state === "searching"}
      >
        {state === "searching" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </>
        ) : (
          <>
            <Volume2 className="h-3.5 w-3.5" />
            {label}
          </>
        )}
      </Button>
      <div className="flex items-center overflow-hidden rounded-full border border-hairline">
        <Languages className="ml-2 h-3 w-3 text-muted-foreground" aria-hidden />
        <span className="px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Language
        </span>
        {(["ur", "en"] as VoiceLang[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => start(option)}
            aria-label={option === "ur" ? "Urdu voice" : "English voice"}
            className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              lang === option ? "bg-primary/20 text-brand-glow" : "text-muted-foreground"
            }`}
          >
            {option === "ur" ? "Urdu" : "English"}
          </button>
        ))}
      </div>
      {state === "speaking" ? (
        <button
          type="button"
          onClick={stop}
          aria-label="Stop voice"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
