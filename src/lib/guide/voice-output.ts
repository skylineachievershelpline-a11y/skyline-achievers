/**
 * VoiceOutputService + VoiceProviderAdapter for the Website Teacher.
 * The "skyline" provider plays audio from an authorized, configured voice
 * profile (server side). The "device" provider is the generic fallback.
 */
import { readVoiceLang, speak as deviceSpeak, stopVoice, supportsVoice } from "@/lib/voice-guide";

export type SpeakHandlers = { onStart?: () => void; onEnd?: () => void };

export interface VoiceProviderAdapter {
  id: "skyline" | "device";
  speak(text: string, h: SpeakHandlers): Promise<boolean>;
  stop(): void;
}

type RemoteSpeak = (text: string) => Promise<{ available: boolean; audio?: string; mime?: string }>;

export function deviceProvider(): VoiceProviderAdapter {
  return {
    id: "device",
    async speak(text, h) {
      if (!supportsVoice()) return false;
      const lang = /[\u0600-\u06FF]/.test(text) ? "ur" : readVoiceLang();
      deviceSpeak(text, lang, h);
      return true;
    },
    stop: stopVoice,
  };
}

export function skylineProvider(remote: RemoteSpeak): VoiceProviderAdapter {
  let audio: HTMLAudioElement | null = null;
  let unavailable = false;
  return {
    id: "skyline",
    async speak(text, h) {
      if (unavailable) return false;
      try {
        const res = await remote(text);
        if (!res.available || !res.audio) { unavailable = true; return false; }
        audio = new Audio(`data:${res.mime ?? "audio/mpeg"};base64,${res.audio}`);
        audio.onplay = () => h.onStart?.();
        audio.onended = () => h.onEnd?.();
        audio.onerror = () => h.onEnd?.();
        await audio.play();
        return true;
      } catch { return false; }
    },
    stop() { if (audio) { audio.pause(); audio.onended = null; audio = null; } },
  };
}

/** Tries the configured Skyline voice first, then the device voice. */
export class VoiceOutputService {
  private chain: VoiceProviderAdapter[];
  private token = 0;
  constructor(chain: VoiceProviderAdapter[]) { this.chain = chain; }

  /** Resolves false when no voice could play (caller stays in text mode). */
  async speak(text: string, h: SpeakHandlers): Promise<boolean> {
    this.stop();
    const my = ++this.token;
    const clean = text.replace(/[*_#>`]/g, "");
    for (const p of this.chain) {
      if (my !== this.token) return false;
      if (await p.speak(clean, { onStart: () => h.onStart?.(), onEnd: () => { if (my === this.token) h.onEnd?.(); } })) return true;
    }
    h.onEnd?.();
    return false;
  }

  stop() { this.token++; this.chain.forEach((p) => p.stop()); }
}
