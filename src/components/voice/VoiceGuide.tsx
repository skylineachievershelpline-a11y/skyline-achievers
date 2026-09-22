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
