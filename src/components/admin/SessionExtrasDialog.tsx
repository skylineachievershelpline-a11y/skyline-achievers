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
  inline = false,
}: {
  sessionId: string;
  sessionTitle: string;
  onClose: () => void;
  inline?: boolean;
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
  const [editingSection, setEditingSection] = useState<SectionRow | null>(null);
  const [newSectionId, setNewSectionId] = useState(() => crypto.randomUUID());

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
    setSectionId("");
  }

  function resetSectionForm() {
    setEditingSection(null);
    setSectionName("");
    setSectionCover(null);
    setNewSectionId(crypto.randomUUID());
  }

  function startEditSection(row: SectionRow) {
    setEditingSection(row);
    setSectionName(row.name);
    setSectionCover(null);
  }

  async function addSection(event: React.FormEvent) {
    event.preventDefault();
    if (!sectionName.trim()) {
      toast.error("Give this category a name.");
      return;
    }
    setSectionBusy(true);
    uploadProgress.clear();
    try {
      let thumbnailPath: string | null = null;
      if (sectionCover) {
        thumbnailPath = await uploadToBucket(
          createUploadUrl,
          "training-thumbnails" as never,
          sectionCover,
          uploadProgress.handler("Uploading category cover"),
        );
      }
      const sectionPayload = {
        id: editingSection?.id ?? newSectionId,
        scope: "session" as const,
        sessionId,
        name: sectionName.trim(),
        thumbnailPath,
        sortOrder: 0,
        isPublished: true,
      };
      try {
        await saveSection({ data: sectionPayload } as never);
      } catch {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        await saveSection({ data: sectionPayload } as never);
      }
      toast.success(editingSection ? "Category updated" : "Category created");
      resetSectionForm();
      refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSectionBusy(false);
      uploadProgress.clear();
    }
  }

  const delSection = useMutation({
    mutationFn: (id: string) => removeSection({ data: { id } }),
    onSuccess: () => {
      toast.success("Category deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function startEdit(row: ExtraRow) {
    setSectionId(row.section_id ?? "");
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
          sectionId: sectionId || null,
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
  const sections = ((data as any)?.sections ?? []) as SectionRow[];
  const sectionName_ = (id: string | null) =>
    sections.find((s) => s.id === id)?.name ?? "No category";

  return (
    <Shell inline={inline} onClose={onClose} title={`Extra material · ${sessionTitle}`}>

        <div className="inset-panel space-y-3 rounded-2xl p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Categories
          </p>
          {sections.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No categories yet. Create ones like Products, Benefits or Reviews, give each a cover
              picture, then file every item under its category.
            </p>
          ) : (
            <ul className="space-y-2">
              {sections.map((section) => (
                <li
                  key={section.id}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-1.5 rounded-xl border border-hairline bg-surface-2 px-2.5 py-2"
                >
                  <span className="min-w-0 break-all pr-1 text-xs font-medium leading-5 sm:break-words sm:text-sm">{section.name}</span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <span className="hidden text-[10px] text-muted-foreground min-[370px]:inline">
                      {extras.filter((e) => e.section_id === section.id).length} items
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditSection(section)}
                      className="h-8 w-8 text-muted-foreground hover:text-brand"
                      aria-label={`Edit ${section.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => delSection.mutate(section.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${section.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addSection} className="space-y-2">
            <Input
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder={editingSection ? "Category name" : "New category name"}
              className="h-11 w-full rounded-2xl"
            />
            <div className="space-y-1.5">
              <Label>
                {editingSection ? "Replace cover picture (optional)" : "Category cover picture"}
              </Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSectionCover(e.target.files?.[0] ?? null)}
                className={`${fieldClass} min-w-0 max-w-full overflow-hidden py-2.5 text-xs text-muted-foreground file:max-w-[9rem]`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary" size="xl" className="min-w-0" disabled={sectionBusy}>
                {sectionBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingSection ? "Save category" : "Add category"}
              </Button>
              {editingSection ? (
                <Button type="button" variant="outline" size="xl" onClick={resetSectionForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </div>


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
                    {KIND_LABEL[row.kind ?? "video"] ?? "Video"} · {sectionName_(row.section_id)} ·
                    order {row.sort_order ?? 0} ·{" "}
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
            <Label>Category</Label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className={fieldClass}
            >
              <option value="">No category</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>
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
                className={`${fieldClass} min-w-0 max-w-full overflow-hidden py-2.5 text-xs text-muted-foreground file:max-w-[9rem]`}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Cover image (optional)</Label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCover(e.target.files?.[0] ?? null)}
              className={`${fieldClass} min-w-0 max-w-full overflow-hidden py-2.5 text-xs text-muted-foreground file:max-w-[9rem]`}
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
    </Shell>
  );
}

function Shell({ inline, onClose, title, children }: { inline: boolean; onClose: () => void; title: string; children: import("react").ReactNode }) {
  if (inline) {
    return (
      <section className="glass-panel space-y-4 rounded-3xl p-4">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {children}
      </section>
    );
  }
  return (
    <Dialog open onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="!bottom-1.5 !left-1.5 !right-1.5 !top-1.5 !max-h-none !w-auto !max-w-none !translate-x-0 !translate-y-0 min-w-0 overflow-x-hidden overflow-y-auto rounded-2xl p-3 sm:!bottom-auto sm:!left-1/2 sm:!right-auto sm:!top-1/2 sm:!max-h-[90dvh] sm:!w-[calc(100vw-2rem)] sm:!max-w-lg sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:rounded-3xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="min-w-0 break-words pr-8 text-left text-base leading-snug">
            Extra material · {title.replace("Extra material · ", "")}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
