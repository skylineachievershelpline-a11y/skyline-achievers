/**
 * Browser voice guide. Speaks short guidance in Urdu or English using the
 * device's own speech engine — no external service and no API key.
 * Client only: every function guards for the browser.
 */

export type VoiceLang = "ur" | "en";

const STORE_KEY = "skyline-voice-lang";
const ENABLED_KEY = "skyline-voice-enabled";

export function supportsVoice(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function readVoiceLang(): VoiceLang {
  if (typeof window === "undefined") return "ur";
  return window.localStorage.getItem(STORE_KEY) === "en" ? "en" : "ur";
}

export function writeVoiceLang(lang: VoiceLang): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORE_KEY, lang);
}

export function readVoiceEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ENABLED_KEY) !== "off";
}

export function writeVoiceEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ENABLED_KEY, enabled ? "on" : "off");
}

export function stopVoice(): void {
  if (!supportsVoice()) return;
  window.speechSynthesis.cancel();
}

function pickVoice(lang: VoiceLang): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const wanted = lang === "ur" ? ["ur", "hi"] : ["en"];
  for (const prefix of wanted) {
    const match = voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix));
    if (match) return match;
  }
  return null;
}

/** Speaks the given text once. Any speech already playing is stopped first. */
export function speak(text: string, lang: VoiceLang): void {
  if (!supportsVoice() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const say = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? (lang === "ur" ? "ur-PK" : "en-US");
    utterance.rate = lang === "ur" ? 0.94 : 1;
    utterance.pitch = 1;
    synth.speak(utterance);
  };
  if (synth.getVoices().length === 0) {
    // Voice list loads asynchronously on first use.
    const once = () => {
      synth.removeEventListener("voiceschanged", once);
      say();
    };
    synth.addEventListener("voiceschanged", once);
    window.setTimeout(say, 350);
    return;
  }
  say();
}

/** Short alert tone before an announcement. */
export function playAlertTone(): void {
  if (typeof window === "undefined") return;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + index * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    // Audio is a nice-to-have; ignore blocked audio contexts.
  }
}
