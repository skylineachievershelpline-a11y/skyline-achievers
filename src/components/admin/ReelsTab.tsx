import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { uploadToBucket } from "@/components/admin/upload";
import { UploadProgress, useUploadProgress } from "@/components/UploadProgress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminCreateUploadUrl,
  adminDeleteReel,
  adminGetReels,
  adminSaveReel,
} from "@/lib/admin.functions";
import { formatDateTime } from "@/lib/format";

const fieldClass = "h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm";

export function ReelsTab() {
  const queryClient = useQueryClient();
  const loadReels = useServerFn(adminGetReels);
  const saveReel = useServerFn(adminSaveReel);
  const removeReel = useServerFn(adminDeleteReel);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const uploadProgress = useUploadProgress();

  const { data, isPending } = useQuery({
    queryKey: ["admin-reels"],
    queryFn: () => loadReels(),
  });

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-reels"] });
  }

  const del = useMutation({
    mutationFn: (id: string) => removeReel({ data: { id } }),
    onSuccess: () => {
      toast.success("Reel deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    if (!videoFile && !videoUrl.trim()) {
      toast.error("Upload a video file or paste a video link.");
      return;
    }
    setBusy(true);
    uploadProgress.clear();
    try {
      let videoPath: string | null = null;
      let thumbnailPath: string | null = null;
      if (videoFile) {
        videoPath = await uploadToBucket(
          createUploadUrl,
          "training-videos",
          videoFile,
          uploadProgress.handler("Uploading reel"),
        );
      }
      const coverFile = cover ?? (videoFile ? await frameFromVideo(videoFile) : null);
      if (coverFile) {
        thumbnailPath = await uploadToBucket(
          createUploadUrl,
          "training-thumbnails",
          coverFile,
          uploadProgress.handler("Uploading cover image"),
        );
      }
      await saveReel({
        data: {
          title: title.trim(),
          caption: caption || null,
          videoPath,
          videoUrl: videoUrl.trim() || null,
          thumbnailPath,
        },
      } as never);
      toast.success("Reel posted");
      setOpen(false);
      setTitle("");
      setCaption("");
      setVideoUrl("");
      setVideoFile(null);
      setCover(null);
      refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      uploadProgress.clear();
    }
  }

  if (isPending || !data) {
    return (
      <div className="flex justify-center py-12">
        <SkylineLoader />
      </div>
    );
  }

  const reels = (data.reels ?? []) as any[];

  return (
    <div className="space-y-4">
      <Button variant="brand" size="xl" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New reel
      </Button>

      {reels.length === 0 ? (
        <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
          No reels posted yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {reels.map((reel) => (
            <li key={reel.id} className="glass-panel flex items-center gap-3 rounded-2xl p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{reel.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {reel.created_by_admin ? "Admin" : (reel.author?.full_name ?? "Manager")} ·{" "}
                  {formatDateTime(reel.created_at)}
                </p>
              </div>
              <button
                onClick={() => del.mutate(reel.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Delete reel"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>New reel</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Video link (optional)</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Leave empty if uploading a file"
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Or upload a vertical video</Label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                className={`${fieldClass} py-2.5 text-xs text-muted-foreground`}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cover image (optional — taken from the video if empty)</Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCover(e.target.files?.[0] ?? null)}
                className={`${fieldClass} py-2.5 text-xs text-muted-foreground`}
              />
            </div>
            <UploadProgress state={uploadProgress.state} />
            <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Post reel
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Grabs a still frame from a local video file so every clip has a cover. */
export async function frameFromVideo(file: File, atSecond = 1): Promise<File | null> {
  try {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("no metadata"));
    });
    video.currentTime = Math.min(atSecond, Math.max(0, (video.duration || 2) / 2));
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
    );
    URL.revokeObjectURL(url);
    if (!blob) return null;
    return new File([blob], "auto-cover.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}
