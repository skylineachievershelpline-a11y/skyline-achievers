import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { frameFromVideo } from "@/components/admin/ReelsTab";
import { uploadToBucket, videoDurationSeconds } from "@/components/admin/upload";
import { UploadProgress, useUploadProgress } from "@/components/UploadProgress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminCreateUploadUrl } from "@/lib/admin.functions";
import {
  adminDeleteLiveTraining,
  adminGetLiveTrainings,
  adminSaveLiveTraining,
} from "@/lib/live.functions";

const fieldClass = "h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm";
const RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;

type TrainingRow = {
  id: string;
  title: string;
  description: string | null;
  aspect_ratio: string | null;
  sort_order: number | null;
  is_published: boolean;
  video_url: string | null;
};

export function LiveTrainingTab() {
  const queryClient = useQueryClient();
  const loadTrainings = useServerFn(adminGetLiveTrainings);
  const saveTraining = useServerFn(adminSaveLiveTraining);
  const removeTraining = useServerFn(adminDeleteLiveTraining);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const uploadProgress = useUploadProgress();

  const { data, isPending } = useQuery({
    queryKey: ["admin-live-trainings"],
    queryFn: () => loadTrainings(),
  });

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<TrainingRow | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [ratio, setRatio] = useState<string>("16:9");
  const [sortOrder, setSortOrder] = useState("0");
  const [published, setPublished] = useState(true);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-live-trainings"] });
  }

  function reset() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setVideoUrl("");
    setVideoFile(null);
    setCover(null);
    setRatio("16:9");
    setSortOrder("0");
    setPublished(true);
  }

  function startEdit(row: TrainingRow) {
    setEditing(row);
    setTitle(row.title);
    setDescription(row.description ?? "");
    setVideoUrl(row.video_url ?? "");
    setVideoFile(null);
    setCover(null);
    setRatio(row.aspect_ratio ?? "16:9");
    setSortOrder(String(row.sort_order ?? 0));
    setPublished(row.is_published);
    setOpen(true);
  }

  const del = useMutation({
    mutationFn: (id: string) => removeTraining({ data: { id } }),
    onSuccess: () => {
      toast.success("Live session deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!editing && !videoFile && !videoUrl.trim()) {
      toast.error("Upload a video file or paste a video link.");
      return;
    }
    setBusy(true);
    uploadProgress.clear();
    try {
      let videoPath: string | null = null;
      let thumbnailPath: string | null = null;
      // The premiere link expires exactly when the video ends, so the browser
      // reads the file's length before upload.
      const durationSeconds = videoFile ? await videoDurationSeconds(videoFile) : null;
      if (videoFile) {
        videoPath = await uploadToBucket(
          createUploadUrl,
          "training-videos",
          videoFile,
          uploadProgress.handler("Uploading session video"),
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
      await saveTraining({
        data: {
          id: editing?.id,
          title: title.trim(),
          description: description.trim() || null,
          videoPath,
          videoUrl: videoFile ? null : videoUrl.trim() || null,
          thumbnailPath,
          aspectRatio: ratio,
          sortOrder: Number(sortOrder) || 0,
          durationSeconds,
          isPublished: published,
        },
      } as never);
      toast.success(editing ? "Live session updated" : "Live session created");
      setOpen(false);
      reset();
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
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  const trainings = (data.trainings ?? []) as TrainingRow[];

  return (
    <div className="space-y-4">
      <Button
        variant="brand"
        size="xl"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" /> New live training session
      </Button>

      {trainings.length === 0 ? (
        <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
          No live training sessions uploaded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {trainings.map((row) => (
            <li key={row.id} className="glass-panel flex items-center gap-3 rounded-2xl p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {row.aspect_ratio ?? "16:9"} · {row.is_published ? "Published" : "Hidden"}
                </p>
              </div>
              <button
                onClick={() => startEdit(row)}
                className="text-muted-foreground transition-colors hover:text-brand"
                aria-label="Edit live session"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => del.mutate(row.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Delete live session"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(false);
            reset();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit live session" : "New live training session"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Video file</Label>
              <input
                type="file"
                accept="video/*"
                className="text-xs"
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Or video link</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cover image (optional)</Label>
              <input
                type="file"
                accept="image/*"
                className="text-xs"
                onChange={(e) => setCover(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Video ratio</Label>
                <select
                  className={fieldClass}
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                >
                  {RATIOS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Order</Label>
                <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Published
            </label>
            <UploadProgress state={uploadProgress.state} />
            <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Create session"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
