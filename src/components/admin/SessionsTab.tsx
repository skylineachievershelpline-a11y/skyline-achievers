import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { frameFromVideo } from "@/components/admin/ReelsTab";
import { uploadToBucket } from "@/components/admin/upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminCreateUploadUrl,
  adminDeleteSession,
  adminGetSessions,
  adminSaveSession,
} from "@/lib/admin.functions";

const fieldClass = "h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm";
const RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;

type SessionRow = {
  id: string;
  session_code: string;
  title: string;
  description: string | null;
  aspect_ratio: string | null;
  sort_order: number | null;
  is_published: boolean;
  video_url: string | null;
};

export function SessionsTab() {
  const queryClient = useQueryClient();
  const loadSessions = useServerFn(adminGetSessions);
  const saveSession = useServerFn(adminSaveSession);
  const removeSession = useServerFn(adminDeleteSession);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);

  const { data, isPending } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: () => loadSessions(),
  });

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<SessionRow | null>(null);
  const [sessionCode, setSessionCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [ratio, setRatio] = useState<string>("16:9");
  const [sortOrder, setSortOrder] = useState("0");
  const [published, setPublished] = useState(true);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
  }

  function reset() {
    setEditing(null);
    setSessionCode("");
    setTitle("");
    setDescription("");
    setVideoUrl("");
    setVideoFile(null);
    setCover(null);
    setRatio("16:9");
    setSortOrder("0");
    setPublished(true);
  }

  function startEdit(row: SessionRow) {
    setEditing(row);
    setSessionCode(row.session_code);
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
    mutationFn: (id: string) => removeSession({ data: { id } }),
    onSuccess: () => {
      toast.success("Session deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionCode.trim() || !title.trim()) {
      toast.error("Session code and title are required.");
      return;
    }
    if (!editing && !videoFile && !videoUrl.trim()) {
      toast.error("Upload a video file or paste a video link.");
      return;
    }
    setBusy(true);
    try {
      let videoPath: string | null = null;
      let thumbnailPath: string | null = null;
      if (videoFile) {
        videoPath = await uploadToBucket(createUploadUrl, "training-videos", videoFile);
      }
      const coverFile = cover ?? (videoFile ? await frameFromVideo(videoFile) : null);
      if (coverFile) {
        thumbnailPath = await uploadToBucket(createUploadUrl, "training-thumbnails", coverFile);
      }
      await saveSession({
        data: {
          id: editing?.id,
          sessionCode: sessionCode.trim().toUpperCase(),
          title: title.trim(),
          description: description.trim() || null,
          videoPath,
          videoUrl: videoFile ? null : videoUrl.trim() || null,
          thumbnailPath,
          aspectRatio: ratio,
          sortOrder: Number(sortOrder) || 0,
          isPublished: published,
        },
      } as never);
      toast.success(editing ? "Session updated" : "Session created");
      setOpen(false);
      reset();
      refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isPending || !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  const sessions = (data.sessions ?? []) as SessionRow[];

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
        <Plus className="h-4 w-4" /> New beginners session
      </Button>

      {sessions.length === 0 ? (
        <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
          No beginners training sessions yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((row) => (
            <li key={row.id} className="glass-panel flex items-center gap-3 rounded-2xl p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  Code {row.session_code} · {row.aspect_ratio ?? "16:9"} ·{" "}
                  {row.is_published ? "Published" : "Hidden"}
                </p>
              </div>
              <button
                onClick={() => startEdit(row)}
                className="text-muted-foreground transition-colors hover:text-brand"
                aria-label="Edit session"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => del.mutate(row.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Delete session"
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
            <DialogTitle>{editing ? "Edit session" : "New beginners session"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Session code</Label>
              <Input
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                placeholder="SKA-BEGIN-01"
                className="h-11 rounded-2xl tracking-[0.12em]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
              <Label>Or upload a video file</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Video ratio</Label>
                <select
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  className={fieldClass}
                >
                  {RATIOS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Sort order</Label>
                <Input
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value.replace(/\D/g, ""))}
                  className="h-11 rounded-2xl"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Published (code opens the session)
            </label>
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
