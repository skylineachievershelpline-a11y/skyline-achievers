import { Languages, Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

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

/**
 * A small "listen" control: plays the section's guidance in Urdu or English
 * with the device voice, and lets the member switch language or stop it.
 */
/**
 * Compact header control: one speaker button that reads the page guidance, and
 * a small chip to switch between Urdu and English. Always visible on mobile.
 */
export function VoiceGuideButton({ ur, en }: { ur: string; en: string }) {
  const [lang, setLang] = useState<VoiceLang>("ur");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(supportsVoice());
    setLang(readVoiceLang());
    return () => stopVoice();
  }, []);

  if (!ready) return null;

  function play(next: VoiceLang) {
    setLang(next);
    writeVoiceLang(next);
    speak(next === "ur" ? ur : en, next);
  }

  return (
    <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-metal/30 bg-surface shadow-glass">
      <button
        type="button"
        onClick={() => play(lang)}
        aria-label="Listen to the guide for this screen"
        className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <Volume2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => play(lang === "ur" ? "en" : "ur")}
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
  const [speaking, setSpeaking] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(supportsVoice());
    setLang(readVoiceLang());
    return () => stopVoice();
  }, []);

  if (!ready) return null;

  function play(next: VoiceLang) {
    setLang(next);
    writeVoiceLang(next);
    setSpeaking(true);
    speak(next === "ur" ? ur : en, next);
    // The engine gives no reliable end event on every device; release the state.
    window.setTimeout(() => setSpeaking(false), 1200);
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => play(lang)}
      >
        <Volume2 className="h-3.5 w-3.5" />
        {label}
      </Button>
      <div className="flex items-center overflow-hidden rounded-full border border-hairline">
        <Languages className="ml-2 h-3 w-3 text-muted-foreground" aria-hidden />
        {(["ur", "en"] as VoiceLang[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => play(option)}
            aria-label={option === "ur" ? "Urdu voice" : "English voice"}
            className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              lang === option ? "bg-primary/20 text-brand-glow" : "text-muted-foreground"
            }`}
          >
            {option === "ur" ? "Urdu" : "English"}
          </button>
        ))}
      </div>
      {speaking ? (
        <button
          type="button"
          onClick={() => {
            stopVoice();
            setSpeaking(false);
          }}
          aria-label="Stop voice"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
