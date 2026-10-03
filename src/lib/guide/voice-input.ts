/**
 * VoiceInputService: records the user's voice and stops by itself after a
 * short silence, so speaking feels natural. Transcription happens server side.
 */
export type VoiceInputError = "denied" | "unsupported" | "empty" | "failed";

export function voiceInputSupported() {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

function pickMime() {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}

export class VoiceInputService {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private raf = 0;

  get listening() { return this.recorder?.state === "recording"; }

  /** Starts listening; resolves with the recorded audio when the user stops. */
  async listen(opts: { maxMs?: number; silenceMs?: number } = {}): Promise<{ blob: Blob; mime: string }> {
    if (!voiceInputSupported()) throw "unsupported" as VoiceInputError;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      throw ((e as DOMException)?.name === "NotAllowedError" || (e as DOMException)?.name === "SecurityError" ? "denied" : "failed") as VoiceInputError;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.recorder = rec;
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<{ blob: Blob; mime: string }>((resolve, reject) => {
      rec.onstop = () => {
        this.cleanup();
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size < 2000) reject("empty" as VoiceInputError);
        else resolve({ blob, mime: type });
      };
    });
    rec.start(250);
    this.watchSilence(opts.silenceMs ?? 1600);
    window.setTimeout(() => this.stop(), opts.maxMs ?? 30000);
    return done;
  }

  /** Simple volume watcher: stops after the user goes quiet. */
  private watchSilence(silenceMs: number) {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 1024;
      this.ctx.createMediaStreamSource(this.stream as MediaStream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let heard = false;
      let quietSince = performance.now();
      const started = performance.now();
      const tick = () => {
        if (!this.listening) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += (v - 128) * (v - 128);
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        if (rms > 6) { heard = true; quietSince = now; }
        if ((heard && now - quietSince > silenceMs) || (!heard && now - started > 8000)) { this.stop(); return; }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    } catch { /* no analyser: user taps stop or max time ends it */ }
  }

  stop() { if (this.recorder?.state === "recording") this.recorder.stop(); }

  private cleanup() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.stream = null; this.ctx = null;
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
