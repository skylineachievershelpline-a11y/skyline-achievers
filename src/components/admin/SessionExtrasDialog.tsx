import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { frameFromVideo } from "@/components/admin/ReelsTab";
import { uploadToBucket } from "@/components/admin/upload";
import { UploadProgress, useUploadProgress } from "@/components/UploadProgress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminCreateUploadUrl,
  adminDeleteSection,
  adminDeleteSessionExtra,
  adminGetSessionExtras,
  adminSaveSection,
  adminSaveSessionExtra,
} from "@/lib/admin.functions";

const fieldClass = "h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm";
const RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;

type Kind = "video" | "image" | "pdf" | "link";

const KINDS: { value: Kind; label: string; accept: string; bucket: string }[] = [
  { value: "video", label: "Video", accept: "video/*", bucket: "training-videos" },
  { value: "image", label: "Picture", accept: "image/*", bucket: "training-thumbnails" },
  {
    value: "pdf",
    label: "PDF / document",
    accept: ".pdf,application/pdf",
    bucket: "training-resources",
  },
  { value: "link", label: "Link only", accept: "", bucket: "" },
];

const KIND_LABEL: Record<string, string> = {
  video: "Video",
  image: "Picture",
  pdf: "PDF",
  link: "Link",
};

type SectionRow = {
  id: string;
  name: string;
  sort_order: number | null;
};

type ExtraRow = {
  id: string;
  title: string;
  description: string | null;
  section_id: string | null;
  kind: string | null;
  video_url: string | null;
  aspect_ratio: string | null;
  sort_order: number | null;
  is_published: boolean;
};

/** Extra material (video, picture, PDF or link) shown with one beginners session. */
export function SessionExtrasDialog({
  sessionId,
  sessionTitle,
  onClose,
}: {
  sessionId: string;
  sessionTitle: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const loadExtras = useServerFn(adminGetSessionExtras);
  const saveExtra = useServerFn(adminSaveSessionExtra);
  const removeExtra = useServerFn(adminDeleteSessionExtra);
  const saveSection = useServerFn(adminSaveSection);
  const removeSection = useServerFn(adminDeleteSection);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const uploadProgress = useUploadProgress();

  const { data, isPending } = useQuery({
    queryKey: ["admin-session-extras", sessionId],
    queryFn: () => loadExtras({ data: { sessionId } }),
  });

  const [editing, setEditing] = useState<ExtraRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<Kind>("video");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [ratio, setRatio] = useState<string>("16:9");
  const [sortOrder, setSortOrder] = useState("0");
  const [published, setPublished] = useState(true);
  const [sectionId, setSectionId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [sectionCover, setSectionCover] = useState<File | null>(null);
  const [sectionBusy, setSectionBusy] = useState(false);

  const kindConfig = KINDS.find((entry) => entry.value === kind) ?? KINDS[0]!;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-session-extras", sessionId] });
  }

  function reset() {
    setEditing(null);
    setKind("video");
    setTitle("");
    setDescription("");
    setLinkUrl("");
    setFile(null);
    setCover(null);
    setRatio("16:9");
    setSortOrder("0");
    setPublished(true);
  }

  function startEdit(row: ExtraRow) {
    setEditing(row);
    setKind((row.kind ?? "video") as Kind);
    setTitle(row.title);
    setDescription(row.description ?? "");
    setLinkUrl(row.video_url ?? "");
    setFile(null);
    setCover(null);
    setRatio(row.aspect_ratio ?? "16:9");
    setSortOrder(String(row.sort_order ?? 0));
    setPublished(row.is_published);
  }

  const del = useMutation({
    mutationFn: (id: string) => removeExtra({ data: { id } }),
    onSuccess: () => {
      toast.success("Extra item deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("Give this item a title.");
      return;
    }
    if (!editing && !file && !linkUrl.trim()) {
      toast.error(kind === "link" ? "Paste the link to open." : "Upload a file or paste a link.");
      return;
    }
    setBusy(true);
    uploadProgress.clear();
    try {
      let filePath: string | null = null;
      let thumbnailPath: string | null = null;
      if (kind !== "link" && file) {
        filePath = await uploadToBucket(
          createUploadUrl,
          kindConfig.bucket as never,
          file,
          uploadProgress.handler(`Uploading ${KIND_LABEL[kind]?.toLowerCase() ?? "file"}`),
        );
      }
      const coverFile = cover ?? (kind === "video" && file ? await frameFromVideo(file) : null);
      if (coverFile) {
        thumbnailPath = await uploadToBucket(
          createUploadUrl,
          "training-thumbnails",
          coverFile,
          uploadProgress.handler("Uploading cover image"),
        );
      }
      await saveExtra({
        data: {
          id: editing?.id,
          sessionId,
          title: title.trim(),
          description: description.trim() || null,
          kind,
          filePath,
          fileBucket: filePath ? kindConfig.bucket : null,
          linkUrl: filePath ? null : linkUrl.trim() || null,
          thumbnailPath,
          aspectRatio: ratio,
          sortOrder: Number(sortOrder) || 0,
          isPublished: published,
        },
      } as never);
      toast.success(editing ? "Item updated" : "Item added");
      reset();
      refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      uploadProgress.clear();
    }
  }

  const extras = ((data as any)?.extras ?? []) as ExtraRow[];

  return (
    <Dialog open onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[86vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Extra material · {sessionTitle}</DialogTitle>
        </DialogHeader>

        {isPending ? (
          <div className="flex justify-center py-8">
            <SkylineLoader />
          </div>
        ) : extras.length === 0 ? (
          <p className="inset-panel rounded-2xl p-3 text-xs text-muted-foreground">
            Nothing added yet. Videos, pictures, PDFs and links you add here open together with this
            session's code.
          </p>
        ) : (
          <ul className="space-y-2">
            {extras.map((row) => (
              <li key={row.id} className="glass-panel flex items-center gap-3 rounded-2xl p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {KIND_LABEL[row.kind ?? "video"] ?? "Video"} · order {row.sort_order ?? 0} ·{" "}
                    {row.is_published ? "Published" : "Hidden"}
                  </p>
                </div>
                <button
                  onClick={() => startEdit(row)}
                  className="text-muted-foreground transition-colors hover:text-brand"
                  aria-label="Edit item"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => del.mutate(row.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Delete item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="mt-2 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {editing ? "Edit item" : "Add video, picture, PDF or link"}
          </p>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setFile(null);
              }}
              className={fieldClass}
            >
              {KINDS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
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
            <Label>{kind === "link" ? "Link" : "Link (optional)"}</Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={kind === "link" ? "https://…" : "Leave empty if uploading a file"}
              className="h-11 rounded-2xl"
            />
          </div>
          {kind === "link" ? null : (
            <div className="space-y-1.5">
              <Label>Or upload a {KIND_LABEL[kind]?.toLowerCase()} file</Label>
              <input
                type="file"
                accept={kindConfig.accept}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className={`${fieldClass} py-2.5 text-xs text-muted-foreground`}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Cover image (optional)</Label>
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
              <Label>Order</Label>
              <Input
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
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
            Published
          </label>

          <UploadProgress state={uploadProgress.state} />

          <div className="flex gap-2">
            <Button type="submit" variant="brand" size="xl" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editing ? "Save changes" : "Add item"}
            </Button>
            {editing ? (
              <Button type="button" variant="outline" size="xl" onClick={reset}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
