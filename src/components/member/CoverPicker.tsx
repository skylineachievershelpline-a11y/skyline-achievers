import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useUploadProgress } from "@/components/UploadProgress";
import { getDashboardCoverUploadUrl, saveDashboardCover } from "@/lib/member.functions";
import { putWithProgress } from "@/lib/upload-progress";

export function CoverPicker({ url }: { url: string | null }) {
  const queryClient = useQueryClient();
  const createUrl = useServerFn(getDashboardCoverUploadUrl);
  const store = useServerFn(saveDashboardCover);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadProgress = useUploadProgress();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = preview ?? url;

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a picture");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Cover picture must be under 12 MB");
      return;
    }
    setBusy(true);
    uploadProgress.clear();
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const safeExtension = ["png", "jpg", "jpeg", "webp"].includes(extension) ? extension : "jpg";
      const slot = await createUrl({ data: { extension: safeExtension } } as never);
      await putWithProgress(slot.signedUrl, file, uploadProgress.handler("Uploading cover"));
      await store({ data: { path: slot.path } } as never);
      setPreview(URL.createObjectURL(file));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["member-session"] }),
        queryClient.invalidateQueries({ queryKey: ["member-access"] }),
      ]);
      toast.success("Dashboard cover updated");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      uploadProgress.clear();
    }
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {shown ? (
        <img src={shown} alt="Dashboard cover" className="h-full w-full object-cover" />
      ) : (
        <div className="brand-gradient h-full w-full opacity-90" />
      )}
      <div className="absolute inset-0 bg-background/25" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background/90 to-transparent" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute right-3 top-3 rounded-xl border-metal/40 bg-background/70 backdrop-blur-md"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : shown ? <Camera /> : <ImagePlus />}
        {uploadProgress.state ? `${uploadProgress.state.percent}%` : "Cover"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}