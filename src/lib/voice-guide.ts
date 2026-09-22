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

const FEMALE_HINTS = [
  "female",
  "woman",
  "girl",
  "zira",
  "samantha",
  "susan",
  "hazel",
  "heera",
  "kalpana",
  "aria",
  "jenny",
  "michelle",
  "serena",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "veena",
  "swara",
  "asma",
  "uzma",
  "ayesha",
  "google uk english female",
];

const MALE_HINTS = [
  "male",
  "man",
  "david",
  "george",
  "daniel",
  "arthur",
  "ryan",
  "oliver",
  "thomas",
  "james",
  "guy",
  "mark",
  "alex",
  "fred",
  "hemant",
  "ravi",
  "madhur",
  "asad",
  "faisal",
  "usman",
  "google uk english male",
];

function isFemale(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();
  return FEMALE_HINTS.some((hint) => name.includes(hint));
}

function isMale(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();
  return MALE_HINTS.some((hint) => name.includes(hint));
}

/**
 * Picks a fluent male voice: Pakistani/Urdu (falling back to Hindi, which
 * pronounces Urdu words correctly) for Urdu, and British English for English.
 * Female voices are only used when the device has nothing else.
 */
function pickVoice(lang: VoiceLang): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const order =
    lang === "ur"
      ? ["ur-pk", "ur", "hi-in", "hi", "en-in", "en"]
      : ["en-gb", "en-uk", "en-au", "en-ie", "en"];

  const byLang = (prefix: string) =>
    voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(prefix));

  // 1) Same language and clearly male.
  for (const prefix of order) {
    const match = byLang(prefix).find((voice) => isMale(voice));
    if (match) return match;
  }
  // 2) Same language and not clearly female.
  for (const prefix of order) {
    const match = byLang(prefix).find((voice) => !isFemale(voice));
    if (match) return match;
  }
  // 3) Any voice of that language.
  for (const prefix of order) {
    const [first] = byLang(prefix);
    if (first) return first;
  }
  return null;
}

/**
 * Speaks the given text once. Any speech already playing is stopped first.
 * `onStart` fires when the device engine actually begins talking, and `onEnd`
 * when it finishes — the UI uses these for its "Searching…" state.
 */
export function speak(
  text: string,
  lang: VoiceLang,
  handlers?: { onStart?: () => void; onEnd?: () => void },
): void {
  if (!supportsVoice() || !text.trim()) {
    handlers?.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    handlers?.onEnd?.();
  };
  const say = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? (lang === "ur" ? "ur-PK" : "en-GB");
    // Slower and warmer for Urdu so every word lands clearly; crisp for English.
    utterance.rate = lang === "ur" ? 0.88 : 0.95;
    utterance.pitch = lang === "ur" ? 0.9 : 0.88;
    utterance.volume = 1;
    utterance.onstart = () => handlers?.onStart?.();
    utterance.onend = finish;
    utterance.onerror = finish;
    synth.speak(utterance);
  };
  if (synth.getVoices().length === 0) {
    // Voice list loads asynchronously on first use.
    let started = false;
    const once = () => {
      synth.removeEventListener("voiceschanged", once);
      if (started) return;
      started = true;
      say();
    };
    synth.addEventListener("voiceschanged", once);
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", once);
      if (started) return;
      started = true;
      say();
    }, 450);
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
