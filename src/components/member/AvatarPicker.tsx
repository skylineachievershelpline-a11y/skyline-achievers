import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Check, Loader2, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUploadProgress } from "@/components/UploadProgress";
import { getAvatarUploadUrl, saveAvatar } from "@/lib/member.functions";
import { putWithProgress } from "@/lib/upload-progress";

const BOX = 264; // crop window size on screen
const OUT = 640; // saved picture size

/**
 * Profile picture picker: pick from the gallery, drag and zoom to crop the
 * square, then save. Used on the member dashboard.
 */
export function AvatarPicker({
  name,
  url,
  label = "Profile picture",
  hint = "Tap the camera to choose a photo",
  onSaved,
}: {
  name: string;
  url: string | null;
  label?: string;
  hint?: string;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const createUrl = useServerFn(getAvatarUploadUrl);
  const store = useServerFn(saveAvatar);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadProgress = useUploadProgress();

  const [source, setSource] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const baseScale = image ? Math.max(BOX / image.naturalWidth, BOX / image.naturalHeight) : 1;
  const scale = baseScale * zoom;

  const clamp = useCallback(
    (next: { x: number; y: number }, activeScale: number) => {
      if (!image) return next;
      const w = image.naturalWidth * activeScale;
      const h = image.naturalHeight * activeScale;
      return {
        x: Math.min(0, Math.max(BOX - w, next.x)),
        y: Math.min(0, Math.max(BOX - h, next.y)),
      };
    },
    [image],
  );

  useEffect(() => {
    if (!image) return;
    const s = Math.max(BOX / image.naturalWidth, BOX / image.naturalHeight);
    setZoom(1);
    setOffset({
      x: (BOX - image.naturalWidth * s) / 2,
      y: (BOX - image.naturalHeight * s) / 2,
    });
  }, [image]);

  useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);

  function pick(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a picture");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSource(objectUrl);
      setImage(img);
    };
    img.onerror = () => toast.error("This picture could not be opened");
    img.src = objectUrl;
  }

  function reset() {
    setImage(null);
    setSource(null);
    setZoom(1);
  }

  async function save() {
    if (!image) return;
    setBusy(true);
    uploadProgress.clear();
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare the picture.");
      const ratio = OUT / BOX;
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.drawImage(
        image,
        offset.x * ratio,
        offset.y * ratio,
        image.naturalWidth * scale * ratio,
        image.naturalHeight * scale * ratio,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("Could not prepare the picture.");
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const slot = await createUrl({ data: { extension: "jpg" } } as never);
      await putWithProgress(slot.signedUrl, file, uploadProgress.handler("Uploading photo"));
      await store({ data: { path: slot.path } } as never);
      setPreview(canvas.toDataURL("image/jpeg", 0.9));
      toast.success("Profile picture updated");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["member-session"] });
      onSaved?.();
      reset();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      uploadProgress.clear();
    }
  }

  const shown = preview ?? url;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-metal/40 bg-muted shadow-lift">
          {shown ? (
            <img src={shown} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold text-muted-foreground">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="brand"
          size="icon"
          className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full shadow-brand"
          aria-label="Change profile picture"
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
        </Button>
        {uploadProgress.state ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/75 text-sm font-semibold tabular-nums">
            {uploadProgress.state.percent}%
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 text-xs font-semibold text-primary underline-offset-4 hover:underline"
      >
        {label}
      </button>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) pick(file);
          event.target.value = "";
        }}
      />

      <Dialog open={Boolean(image)} onOpenChange={(open) => { if (!open && !busy) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crop your picture</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative overflow-hidden rounded-full border border-cyan/40 bg-media touch-none"
              style={{ width: BOX, height: BOX }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
              }}
              onPointerMove={(event) => {
                if (!drag.current) return;
                setOffset(
                  clamp(
                    {
                      x: drag.current.ox + (event.clientX - drag.current.x),
                      y: drag.current.oy + (event.clientY - drag.current.y),
                    },
                    scale,
                  ),
                );
              }}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
            >
              {source && image ? (
                <img
                  src={source}
                  alt="Crop preview"
                  draggable={false}
                  className="pointer-events-none absolute select-none"
                  style={{
                    left: offset.x,
                    top: offset.y,
                    width: image.naturalWidth * scale,
                    height: image.naturalHeight * scale,
                  }}
                />
              ) : null}
            </div>

            <div className="w-full">
              <label htmlFor="avatar-zoom" className="text-xs font-semibold text-muted-foreground">
                Zoom
              </label>
              <input
                id="avatar-zoom"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                className="mt-2 w-full accent-primary"
                onChange={(event) => {
                  const nextZoom = Number(event.target.value);
                  const nextScale = baseScale * nextZoom;
                  const cx = BOX / 2;
                  const factor = nextScale / scale;
                  setZoom(nextZoom);
                  setOffset(
                    clamp(
                      {
                        x: cx - (cx - offset.x) * factor,
                        y: cx - (cx - offset.y) * factor,
                      },
                      nextScale,
                    ),
                  );
                }}
              />
            </div>

            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-2xl"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <RotateCcw className="h-4 w-4" />
                Change photo
              </Button>
              <Button
                type="button"
                variant="brand"
                className="flex-1 rounded-2xl"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Set picture
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-2xl"
                disabled={busy}
                aria-label="Cancel"
                onClick={reset}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
