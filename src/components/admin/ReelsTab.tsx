import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { uploadToBucket } from "@/components/admin/upload";
import { UploadProgress, useUploadProgress } from "@/components/UploadProgress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  adminCreateUploadUrl,
  adminDeleteReel,
  adminDeleteReelComment,
  adminGetReelComments,
  adminGetReels,
  adminModerateReelComment,
  adminSaveReel,
  adminUpdateReel,
} from "@/lib/admin.functions";
import { formatDateTime } from "@/lib/format";

const fieldClass = "h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm";

export function ReelsTab() {
  return (
    <Tabs defaultValue="clips">
      <TabsList className="w-full rounded-xl">
        <TabsTrigger value="clips" className="rounded-xl">
          Reels
        </TabsTrigger>
        <TabsTrigger value="comments" className="rounded-xl">
          Comments
        </TabsTrigger>
      </TabsList>
      <TabsContent value="clips" className="mt-4">
        <ReelList />
      </TabsContent>
      <TabsContent value="comments" className="mt-4">
        <CommentModeration />
      </TabsContent>
    </Tabs>
  );
}

function ReelList() {
  const queryClient = useQueryClient();
  const loadReels = useServerFn(adminGetReels);
  const saveReel = useServerFn(adminSaveReel);
  const updateReel = useServerFn(adminUpdateReel);
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
  const [baseLikes, setBaseLikes] = useState("0");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

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

  const edit = useMutation({
    mutationFn: (input: { id: string; title: string; caption: string | null; baseLikes: number }) =>
      updateReel({ data: input } as never),
    onSuccess: () => {
      toast.success("Reel updated");
      setEditing(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    if (!videoFile) {
      toast.error("Choose a video file to upload.");
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
          thumbnailPath,
          baseLikes: Number(baseLikes) || 0,
        },
      } as never);
      toast.success("Reel posted");
      setOpen(false);
      setTitle("");
      setCaption("");
      setBaseLikes("0");
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
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {reel.title}
                  {reel.created_by_admin ? (
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : null}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {reel.created_by_admin ? "Skyline Achievers" : (reel.author?.full_name ?? "Member")}{" "}
                  · {formatDateTime(reel.created_at)} · {reel.total_likes} likes (
                  {reel.base_likes ?? 0} set + {reel.real_likes} real)
                  {reel.pending_comments > 0 ? ` · ${reel.pending_comments} pending` : ""}
                </p>
              </div>
              <Button
                variant="outline"
                className="h-9 rounded-xl px-3 text-xs"
                onClick={() => setEditing(reel)}
              >
                Edit
              </Button>
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

      <Dialog open={Boolean(editing)} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit reel</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                edit.mutate({
                  id: editing.id,
                  title: String(editing.title ?? "").trim(),
                  caption: editing.caption || null,
                  baseLikes: Number(editing.base_likes) || 0,
                });
              }}
            >
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={editing.title ?? ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Caption</Label>
                <Textarea
                  value={editing.caption ?? ""}
                  onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Starting likes</Label>
                <Input
                  type="number"
                  min={0}
                  value={editing.base_likes ?? 0}
                  onChange={(e) => setEditing({ ...editing, base_likes: e.target.value })}
                  className="h-11 rounded-2xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Members&apos; own likes are added on top of this number.
                </p>
              </div>
              <Button
                type="submit"
                variant="brand"
                size="xl"
                className="w-full"
                disabled={edit.isPending}
              >
                {edit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

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
              <Label>Starting likes</Label>
              <Input
                type="number"
                min={0}
                value={baseLikes}
                onChange={(e) => setBaseLikes(e.target.value)}
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Upload a vertical video</Label>
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

/** Nothing a member writes is public until it is approved here. */
function CommentModeration() {
  const queryClient = useQueryClient();
  const load = useServerFn(adminGetReelComments);
  const moderate = useServerFn(adminModerateReelComment);
  const removeComment = useServerFn(adminDeleteReelComment);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isPending } = useQuery({
    queryKey: ["admin-reel-comments"],
    queryFn: () => load(),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-reel-comments"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-reels"] });
  }

  const act = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "rejected"; body?: string }) =>
      moderate({ data: input } as never),
    onSuccess: () => {
      toast.success("Comment updated");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeComment({ data: { id } }),
    onSuccess: () => {
      toast.success("Comment deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending || !data) {
    return (
      <div className="flex justify-center py-12">
        <SkylineLoader />
      </div>
    );
  }

  const comments = ((data.comments ?? []) as any[]).filter((c) => c.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected"] as const).map((value) => (
          <Button
            key={value}
            variant={filter === value ? "brand" : "outline"}
            className="h-9 min-w-fit rounded-xl px-3 text-xs capitalize"
            onClick={() => setFilter(value)}
          >
            {value}
          </Button>
        ))}
      </div>

      {comments.length === 0 ? (
        <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
          Nothing {filter} right now.
        </p>
      ) : (
        <ul className="space-y-2">
          {comments.map((comment) => (
            <li key={comment.id} className="glass-panel space-y-2 rounded-2xl p-3">
              <p className="text-[11px] text-muted-foreground">
                {comment.author_name} · {comment.reel?.title ?? "Reel"} ·{" "}
                {formatDateTime(comment.created_at)}
              </p>
              <Textarea
                value={drafts[comment.id] ?? comment.body}
                onChange={(e) => setDrafts({ ...drafts, [comment.id]: e.target.value })}
                className="rounded-2xl text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="brand"
                  className="h-9 min-w-fit rounded-xl px-3 text-xs"
                  onClick={() =>
                    act.mutate({
                      id: comment.id,
                      status: "approved",
                      body: (drafts[comment.id] ?? comment.body) || undefined,
                    })
                  }
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  variant="outline"
                  className="h-9 min-w-fit rounded-xl px-3 text-xs"
                  onClick={() => act.mutate({ id: comment.id, status: "rejected" })}
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
                <Button
                  variant="outline"
                  className="h-9 min-w-fit rounded-xl px-3 text-xs text-destructive"
                  onClick={() => del.mutate(comment.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
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
