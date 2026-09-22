import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { VoiceRecorder } from "@/components/media/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getReviewUploadUrl, submitSessionReview } from "@/lib/journey.functions";
import { uploadJourneyFile } from "./journey-upload";

/** The trainee's session review: written words, a picture and a voice note. */
export function SessionReviewForm({
  sessionNumber,
  onSent,
}: {
  sessionNumber: number;
  onSent: () => void;
}) {
  const slot = useServerFn(getReviewUploadUrl);
  const send = useServerFn(submitSessionReview);
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [voice, setVoice] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const imagePath = image ? await uploadJourneyFile(slot as never, image) : null;
      const voicePath = voice ? await uploadJourneyFile(slot as never, voice) : null;
      await send({ data: { sessionNumber, body: body.trim(), imagePath, voicePath } } as never);
    },
    onSuccess: () => {
      toast.success("Review sent to your upline");
      setBody("");
      setImage(null);
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
        submit.mutate();
      }}
    >
      <div>
        <p className="font-display text-sm font-semibold">Session review</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Write what you learned in this session. You can also attach a picture of your notes and a
          voice note.
        </p>
      </div>

      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={5}
        placeholder="What did you learn in this session? What will you apply first?"
        className="rounded-2xl"
      />

      {image ? (
        <div className="glass-panel flex items-center gap-3 rounded-2xl p-2">
          <img
            src={URL.createObjectURL(image)}
            alt="Attached picture"
            className="h-14 w-14 rounded-xl object-cover"
          />
          <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{image.name}</p>
          <button
            type="button"
            onClick={() => setImage(null)}
            aria-label="Remove picture"
            className="text-muted-foreground transition-colors hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="glass-panel flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl text-xs text-muted-foreground">
          <ImagePlus className="h-4 w-4 text-brand-glow" />
          Attach a picture (optional)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) setImage(file);
            }}
          />
        </label>
      )}

      <VoiceRecorder value={voice} onChange={setVoice} label="Voice note (optional)" />

      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="w-full rounded-2xl"
        disabled={submit.isPending || body.trim().length < 10}
      >
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send review to my upline
      </Button>
    </form>
  );
}
