import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Mic, Send, Type, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { VoiceRecorder } from "@/components/media/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getReviewUploadUrl, submitSessionReview } from "@/lib/journey.functions";
import { uploadJourneyFile } from "./journey-upload";

type Mode = "text" | "pictures" | "voice";

const MODES: { id: Mode; label: string; icon: typeof Type }[] = [
  { id: "text", label: "Text", icon: Type },
  { id: "pictures", label: "Pictures", icon: ImagePlus },
  { id: "voice", label: "Voice note", icon: Mic },
];

function Thumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return (
    <div className="relative">
      {url ? <img src={url} alt="Attached picture" className="h-20 w-full rounded-xl object-cover" /> : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove picture"
        className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/** Session review: send text, pictures or a voice note — any one is enough. */
export function SessionReviewForm({
  sessionNumber,
  onSent,
  anyTime = false,
}: {
  sessionNumber: number;
  onSent: () => void;
  anyTime?: boolean;
}) {
  const slot = useServerFn(getReviewUploadUrl);
  const send = useServerFn(submitSessionReview);
  const [mode, setMode] = useState<Mode>("text");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [voice, setVoice] = useState<File | null>(null);

  const ready =
    mode === "text" ? body.trim().length > 0 : mode === "pictures" ? images.length > 0 : Boolean(voice);

  const submit = useMutation({
    mutationFn: async () => {
      const imagePaths =
        mode === "pictures"
          ? await Promise.all(images.map((file) => uploadJourneyFile(slot as never, file)))
          : [];
      const voicePath = mode === "voice" && voice ? await uploadJourneyFile(slot as never, voice) : null;
      await send({
        data: {
          sessionNumber,
          body: mode === "text" ? body.trim() : "",
          imagePaths,
          voicePath,
          anyTime,
        },
      } as never);
    },
    onSuccess: () => {
      toast.success("Review sent to your upline");
      setBody("");
      setImages([]);
      setVoice(null);
      onSent();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="glass-panel metal-edge mt-5 space-y-3 rounded-3xl p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) submit.mutate();
      }}
    >
      <div>
        <p className="font-display text-sm font-semibold">Session review</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Choose one way to send your review — text, pictures or a voice note.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-2xl border text-xs transition-colors ${
              mode === id
                ? "border-brand bg-brand/15 text-foreground"
                : "border-hairline text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          placeholder="What did you learn in this session? What will you apply first?"
          className="rounded-2xl"
        />
      ) : null}

      {mode === "pictures" ? (
        <div className="space-y-2">
          {images.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {images.map((file, index) => (
                <Thumb
                  key={`${file.name}-${index}`}
                  file={file}
                  onRemove={() => setImages((list) => list.filter((_, i) => i !== index))}
                />
              ))}
            </div>
          ) : null}
          <label className="glass-panel flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl text-xs text-muted-foreground">
            <ImagePlus className="h-4 w-4 text-brand-glow" />
            {images.length ? "Add more pictures" : "Select pictures"}
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                setImages((list) => [...list, ...files].slice(0, 10));
              }}
            />
          </label>
        </div>
      ) : null}

      {mode === "voice" ? <VoiceRecorder value={voice} onChange={setVoice} label="Voice note" /> : null}

      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="w-full rounded-2xl"
        disabled={submit.isPending || !ready}
      >
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send review to my upline
      </Button>
    </form>
  );
}
