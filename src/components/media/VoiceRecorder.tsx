import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * WhatsApp-style voice note recorder. Records straight in the browser, shows a
 * live timer and a playback preview, and hands the finished clip back as a file
 * so the existing upload flow can store it.
 */
export function VoiceRecorder({
  value,
  onChange,
  label = "Voice note",
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  label?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const file = new File([blob], `voice-note-${Date.now()}.${extensionFor(type)}`, { type });
        onChange(file);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone is blocked. Allow microphone access and try again.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="glass-panel rounded-2xl p-3">
      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>

      {value && previewUrl ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="h-10 rounded-full px-3" onClick={togglePlay}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full w-2/3 brand-gradient" />
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              Recording ready · {formatSeconds(seconds)}
            </p>
          </div>
          <audio ref={audioRef} src={previewUrl} onEnded={() => setPlaying(false)} className="hidden" />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setSeconds(0);
            }}
            aria-label="Delete recording"
            className="text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : recording ? (
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 animate-pulse rounded-full bg-destructive" />
          <span className="font-mono text-sm">{formatSeconds(seconds)}</span>
          <Button type="button" variant="outline" className="ml-auto h-10 rounded-full" onClick={stop}>
            <Square className="h-4 w-4" /> Stop
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="h-10 w-full rounded-full" onClick={() => void start()}>
          <Mic className="h-4 w-4" /> Record voice note
        </Button>
      )}
    </div>
  );
}
