import { ImagePlus, X } from "lucide-react";

import {
  PromptInputButton,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";

export function AiPicturePreview() {
  const attachments = usePromptInputAttachments();
  const picture = attachments.files[0];
  if (!picture) return null;

  return (
    <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-hairline bg-media shadow-glass">
      <img src={picture.url} alt={picture.filename ?? "Selected picture"} className="h-full w-full object-cover" />
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute right-1 top-1 h-6 w-6 rounded-full"
        aria-label="Remove picture"
        onClick={() => attachments.remove(picture.id)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function AiPictureButton({ disabled = false }: { disabled?: boolean }) {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      type="button"
      tooltip="Add picture"
      aria-label="Add picture"
      disabled={disabled || attachments.files.length > 0}
      onClick={() => attachments.openFileDialog()}
    >
      <ImagePlus className="h-4 w-4" />
    </PromptInputButton>
  );
}

export function AiMessagePicture({ url, filename }: { url: string; filename: string | undefined }) {
  return (
    <img
      src={url}
      alt={filename ?? "Shared picture"}
      className="max-h-72 w-auto max-w-full rounded-lg border border-hairline object-contain shadow-lift"
    />
  );
}