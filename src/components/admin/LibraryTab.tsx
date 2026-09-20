import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { frameFromVideo } from "@/components/admin/ReelsTab";
import { VoiceRecorder } from "@/components/media/VoiceRecorder";
import { videoDurationSeconds } from "@/components/admin/upload";
import {
  adminCreateUploadUrl,
  adminDeleteContent,
  adminDeleteTrainingCategory,
  adminGetLibrary,
  adminSaveLecture,
  adminSaveResource,
  adminSaveTrainingCategory,
} from "@/lib/admin.functions";
import { RESOURCE_TYPE_LABEL } from "@/lib/brand";
import { startUpload } from "@/lib/upload-manager";

type Library = Awaited<ReturnType<typeof adminGetLibrary>>;
type Level = { id: string; name: string; rank_order: number };
type Category = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_published: boolean;
};

const fieldClass =
  "h-11 w-full rounded-2xl border border-border bg-input px-3 text-sm text-foreground";
const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;

type VideoValues = {
  id?: string;
  levelId: string;
  levelIds: string[];
  categoryId: string;
  title: string;
  description: string;
  sortOrder: number;
  aspectRatio: (typeof ASPECT_RATIOS)[number];
  videoUrl: string;
  videoFile: File | null;
  thumbnail: File | null;
};

type CategoryValues = {
  id?: string;
  name: string;
  description: string;
  sortOrder: number;
  isPublished: boolean;
};

export function LibraryTab() {
  const queryClient = useQueryClient();
  const loadLibrary = useServerFn(adminGetLibrary);
  const saveVideo = useServerFn(adminSaveLecture);
  const saveResource = useServerFn(adminSaveResource);
  const remove = useServerFn(adminDeleteContent);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);
  const saveCategory = useServerFn(adminSaveTrainingCategory);
  const removeCategory = useServerFn(adminDeleteTrainingCategory);

  const { data, isPending } = useQuery<Library>({
    queryKey: ["admin-library"],
    queryFn: () => loadLibrary(),
    staleTime: 30_000,
  });

  const [videoDialog, setVideoDialog] = useState<VideoValues | null>(null);
  const [categoryDialog, setCategoryDialog] = useState<CategoryValues | null>(null);
  const [resourceDialog, setResourceDialog] = useState(false);
  const [busy, setBusy] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-library"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  const del = useMutation({
    mutationFn: (input: { table: "lectures" | "resources"; id: string }) => remove({ data: input }),
    onSuccess: () => {
      toast.success("Deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const delCategory = useMutation({
    mutationFn: (id: string) => removeCategory({ data: { id } } as never),
    onSuccess: () => {
      toast.success("Section deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const storeCategory = useMutation({
    mutationFn: (values: CategoryValues) =>
      saveCategory({
        data: {
          ...(values.id ? { id: values.id } : {}),
          name: values.name.trim(),
          description: values.description.trim() || null,
          sortOrder: values.sortOrder,
          isPublished: values.isPublished,
        },
      } as never),
    onSuccess: () => {
      toast.success("Section saved");
      setCategoryDialog(null);
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

  const levels = data.levels as unknown as Level[];
  const categories = ((data as any).categories ?? []) as Category[];
  const access = (data as any).access as Record<string, string[]>;

  function blankVideo(): VideoValues {
    const first = levels[0];
    return {
      levelId: first?.id ?? "",
      levelIds: first ? levels.filter((l) => l.rank_order >= first.rank_order).map((l) => l.id) : [],
      categoryId: categories[0]?.id ?? "",
      title: "",
      description: "",
      sortOrder: 0,
      aspectRatio: "16:9",
      videoUrl: "",
      videoFile: null,
      thumbnail: null,
    };
  }

  async function submitVideo(values: VideoValues) {
    setBusy(true);
    try {
      let videoPath: string | null = null;
      let thumbnailPath: string | null = null;
      let durationSeconds: number | null = null;

      if (values.videoFile) {
        durationSeconds = await videoDurationSeconds(values.videoFile);
        const file = values.videoFile;
        videoPath = await startUpload({
          label: `Uploading video: ${values.title}`,
          file,
          createSlot: () =>
            createUploadUrl({
              data: { bucket: "training-videos", fileName: file.name },
            } as never) as Promise<{ path: string; signedUrl: string }>,
        });
        if (!values.thumbnail) {
          // No cover chosen? Grab a frame from the video itself.
          const frame = await frameFromVideo(file).catch(() => null);
          if (frame) {
            thumbnailPath = await startUpload({
              label: "Uploading cover",
              file: frame,
              createSlot: () =>
                createUploadUrl({
                  data: { bucket: "training-thumbnails", fileName: frame.name },
                } as never) as Promise<{ path: string; signedUrl: string }>,
            });
          }
        }
      }
      if (values.thumbnail) {
        const cover = values.thumbnail;
        thumbnailPath = await startUpload({
          label: "Uploading cover",
          file: cover,
          createSlot: () =>
            createUploadUrl({
              data: { bucket: "training-thumbnails", fileName: cover.name },
            } as never) as Promise<{ path: string; signedUrl: string }>,
        });
      }

      await saveVideo({
        data: {
          ...(values.id ? { id: values.id } : {}),
          levelId: values.levelId,
          levelIds: values.levelIds,
          categoryId: values.categoryId || null,
          title: values.title,
          description: values.description || null,
          sortOrder: values.sortOrder,
          durationSeconds,
          videoSource: values.videoUrl.trim() ? "external" : "upload",
          videoPath,
          videoUrl: values.videoUrl.trim() || null,
          thumbnailPath,
          aspectRatio: values.aspectRatio,
          isPublished: true,
        },
      } as never);
      toast.success(values.id ? "Video updated" : "Video published");
      setVideoDialog(null);
      refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const groups: { id: string | null; name: string; hint: string }[] = [
    ...categories.map((category) => ({
      id: category.id,
      name: category.name,
      hint: category.is_published ? "Visible to members" : "Hidden from members",
    })),
    { id: null, name: "Not in any section", hint: "Pick a section so members can find these" },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap gap-2">
        <Button variant="brand" size="xl" onClick={() => setVideoDialog(blankVideo())}>
          <Plus className="h-4 w-4" /> New training video
        </Button>
        <Button
          variant="secondary"
          size="xl"
          onClick={() =>
            setCategoryDialog({
              name: "",
              description: "",
              sortOrder: categories.length + 1,
              isPublished: true,
            })
          }
        >
          <Plus className="h-4 w-4" /> New training section
        </Button>
        <Button variant="secondary" size="xl" onClick={() => setResourceDialog(true)}>
          <Plus className="h-4 w-4" /> New resource
        </Button>
      </div>

      <section className="raised-panel metal-edge rounded-3xl p-4">
        <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-brand-glow">
          Training sections
        </h3>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Members see these as menu items inside Training (for example Podcast, Motivational).
        </p>
        {categories.length === 0 ? (
          <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
            No sections yet — create one first, then place videos inside it.
          </p>
        ) : (
          <ul className="space-y-2">
            {categories.map((category) => {
              const count = (data.lectures as any[]).filter(
                (l) => l.category_id === category.id,
              ).length;
              return (
                <li
                  key={category.id}
                  className="glass-panel flex items-center gap-3 rounded-2xl px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{category.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {count} video{count === 1 ? "" : "s"} ·{" "}
                      {category.is_published ? "Visible" : "Hidden"} · Order {category.sort_order}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setCategoryDialog({
                        id: category.id,
                        name: category.name,
                        description: category.description ?? "",
                        sortOrder: category.sort_order,
                        isPublished: category.is_published,
                      })
                    }
                    className="text-muted-foreground transition-colors hover:text-brand-glow"
                    aria-label="Edit section"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm(`Delete section “${category.name}”?`)) return;
                      delCategory.mutate(category.id);
                    }}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Delete section"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {groups.map((group) => {
        const videos = (data.lectures as any[]).filter((l) =>
          group.id === null ? !l.category_id : l.category_id === group.id,
        );
        if (group.id === null && videos.length === 0) return null;
        return (
          <section key={group.id ?? "none"}>
            <h3 className="mb-1 font-display text-sm font-semibold uppercase tracking-[0.16em] text-brand-glow">
              {group.name}
            </h3>
            <p className="mb-2 text-[11px] text-muted-foreground">{group.hint}</p>
            {videos.length === 0 ? (
              <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
                No training video in this section yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {videos.map((video: any) => {
                  const allowed = access[video.id] ?? [];
                  return (
                    <li key={video.id} className="glass-panel metal-edge rounded-2xl p-4">
                      <div className="flex items-start gap-3">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            loading="lazy"
                            className="h-14 w-24 shrink-0 rounded-xl border border-border object-cover"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{video.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {video.video_source === "external" ? "Link" : "Uploaded"} ·{" "}
                            {video.aspect_ratio ?? "16:9"} ·{" "}
                            {video.is_published ? "Published" : "Draft"}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Watchable by:{" "}
                            {allowed.length === 0
                              ? "nobody yet"
                              : levels
                                  .filter((l) => allowed.includes(l.id))
                                  .map((l) => l.name)
                                  .join(", ")}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() =>
                              setVideoDialog({
                                id: video.id,
                                levelId: video.level_id,
                                levelIds: allowed,
                                categoryId: video.category_id ?? "",
                                title: video.title,
                                description: video.description ?? "",
                                sortOrder: video.sort_order ?? 0,
                                aspectRatio: (video.aspect_ratio ?? "16:9") as (typeof ASPECT_RATIOS)[number],
                                videoUrl: video.video_url ?? "",
                                videoFile: null,
                                thumbnail: null,
                              })
                            }
                            className="text-muted-foreground transition-colors hover:text-brand-glow"
                            aria-label="Edit video"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (!window.confirm(`Delete “${video.title}” permanently?`)) return;
                              del.mutate({ table: "lectures", id: video.id });
                            }}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                            aria-label="Delete video"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <section>
        <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-brand-glow">
          Resources
        </h3>
        {data.resources.length === 0 ? (
          <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">No resources yet.</p>
        ) : (
          <ul className="space-y-2">
            {(data.resources as any[]).map((r) => (
              <li key={r.id} className="glass-panel flex items-center gap-3 rounded-2xl p-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {RESOURCE_TYPE_LABEL[r.resource_type] ?? r.resource_type}
                </span>
                <button
                  onClick={() => del.mutate({ table: "resources", id: r.id })}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Delete resource"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={videoDialog !== null} onOpenChange={(open) => !open && setVideoDialog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>{videoDialog?.id ? "Edit training video" : "New training video"}</DialogTitle>
          </DialogHeader>
          {videoDialog ? (
            <VideoForm
              key={videoDialog.id ?? "new"}
              initial={videoDialog}
              levels={levels}
              categories={categories}
              busy={busy}
              onSubmit={(values) => void submitVideo(values)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={categoryDialog !== null}
        onOpenChange={(open) => !open && setCategoryDialog(null)}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {categoryDialog?.id ? "Edit training section" : "New training section"}
            </DialogTitle>
          </DialogHeader>
          {categoryDialog ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!categoryDialog.name.trim()) {
                  toast.error("Give the section a name.");
                  return;
                }
                storeCategory.mutate(categoryDialog);
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label>Section name</Label>
                <Input
                  value={categoryDialog.name}
                  onChange={(e) => setCategoryDialog({ ...categoryDialog, name: e.target.value })}
                  placeholder="Podcast"
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Short description</Label>
                <Textarea
                  value={categoryDialog.description}
                  onChange={(e) =>
                    setCategoryDialog({ ...categoryDialog, description: e.target.value })
                  }
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Order in the menu</Label>
                <Input
                  value={String(categoryDialog.sortOrder)}
                  onChange={(e) =>
                    setCategoryDialog({
                      ...categoryDialog,
                      sortOrder: Number(e.target.value.replace(/\D/g, "")) || 0,
                    })
                  }
                  className="h-11 rounded-2xl"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={categoryDialog.isPublished}
                  onChange={(e) =>
                    setCategoryDialog({ ...categoryDialog, isPublished: e.target.checked })
                  }
                />
                Visible to members
              </label>
              <Button
                type="submit"
                variant="brand"
                size="xl"
                className="w-full"
                disabled={storeCategory.isPending}
              >
                {storeCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {categoryDialog.id ? "Save section" : "Create section"}
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={resourceDialog} onOpenChange={setResourceDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>New resource</DialogTitle>
          </DialogHeader>
          <ResourceForm
            videos={(data.lectures as any[]).map((l) => ({ id: l.id, title: l.title }))}
            busy={busy}
            onSubmit={async (values) => {
              setBusy(true);
              try {
                let storagePath: string | null = null;
                if (values.file) {
                  const file = values.file;
                  storagePath = await startUpload({
                    label: `Uploading ${file.name}`,
                    file,
                    createSlot: () =>
                      createUploadUrl({
                        data: { bucket: "training-resources", fileName: file.name },
                      } as never) as Promise<{ path: string; signedUrl: string }>,
                  });
                }
                await saveResource({
                  data: {
                    lectureId: values.lectureId || null,
                    resourceType: values.resourceType,
                    title: values.title,
                    description: values.description || null,
                    storagePath,
                    externalUrl: values.externalUrl || null,
                    body: values.body || null,
                    sortOrder: 0,
                    isPublished: true,
                  },
                } as never);
                toast.success("Resource saved");
                setResourceDialog(false);
                refresh();
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VideoForm({
  initial,
  levels,
  categories,
  busy,
  onSubmit,
}: {
  initial: VideoValues;
  levels: Level[];
  categories: Category[];
  busy: boolean;
  onSubmit: (values: VideoValues) => void;
}) {
  const [values, setValues] = useState<VideoValues>(initial);

  function toggleLevel(id: string) {
    setValues((prev) => ({
      ...prev,
      levelIds: prev.levelIds.includes(id)
        ? prev.levelIds.filter((x) => x !== id)
        : [...prev.levelIds, id],
    }));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!values.title.trim()) return;
        onSubmit({ ...values, title: values.title.trim() });
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label>Training section</Label>
        <select
          value={values.categoryId}
          onChange={(e) => setValues({ ...values, categoryId: e.target.value })}
          className={fieldClass}
        >
          <option value="">No section</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Members open this section in Training and only see its videos.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Training level</Label>
        <select
          value={values.levelId}
          onChange={(e) => setValues({ ...values, levelId: e.target.value })}
          className={fieldClass}
        >
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>Who can watch this video</Label>
        <div className="space-y-2 rounded-2xl border border-border p-3">
          {levels.map((level) => (
            <label key={level.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.levelIds.includes(level.id)}
                onChange={() => toggleLevel(level.id)}
                className="h-4 w-4 rounded border-border"
              />
              {level.name}
            </label>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Tick every level that should see this video.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Video ratio</Label>
        <select
          value={values.aspectRatio}
          onChange={(e) =>
            setValues({ ...values, aspectRatio: e.target.value as (typeof ASPECT_RATIOS)[number] })
          }
          className={fieldClass}
        >
          <option value="16:9">16:9 — landscape</option>
          <option value="9:16">9:16 — portrait / reel</option>
          <option value="1:1">1:1 — square</option>
          <option value="4:3">4:3 — classic</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
          className="h-11 rounded-2xl"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          className="rounded-2xl"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Order</Label>
        <Input
          value={String(values.sortOrder)}
          onChange={(e) => setValues({ ...values, sortOrder: Number(e.target.value) || 0 })}
          className="h-11 rounded-2xl"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Video link (YouTube, Vimeo, Drive)</Label>
        <Input
          value={values.videoUrl}
          onChange={(e) => setValues({ ...values, videoUrl: e.target.value })}
          placeholder="Leave empty if uploading a file"
          className="h-11 rounded-2xl"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Or upload a video file</Label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setValues({ ...values, videoFile: e.target.files?.[0] ?? null })}
          className="text-xs text-muted-foreground"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Cover picture</Label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setValues({ ...values, thumbnail: e.target.files?.[0] ?? null })}
          className="text-xs text-muted-foreground"
        />
      </div>
      <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {initial.id ? "Save changes" : "Publish video"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        The upload keeps running in the background even if you close this window.
      </p>
    </form>
  );
}

const RESOURCE_TYPES = [
  "pdf",
  "audio",
  "presentation",
  "book",
  "link",
  "note",
  "image",
] as const;

type ResourceType = (typeof RESOURCE_TYPES)[number];

function ResourceForm({
  videos,
  busy,
  onSubmit,
}: {
  videos: { id: string; title: string }[];
  busy: boolean;
  onSubmit: (values: {
    lectureId: string;
    resourceType: ResourceType;
    title: string;
    description: string;
    externalUrl: string;
    body: string;
    file: File | null;
    thumbnail: File | null;
  }) => void;
}) {
  const [lectureId, setLectureId] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("pdf");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSubmit({
          lectureId,
          resourceType,
          title: title.trim(),
          description,
          externalUrl,
          body,
          file,
          thumbnail,
        });
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label>Type</Label>
        <select
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value as ResourceType)}
          className={fieldClass}
        >
          {RESOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {RESOURCE_TYPE_LABEL[type] ?? type}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Attach to training video (optional)</Label>
        <select value={lectureId} onChange={(e) => setLectureId(e.target.value)} className={fieldClass}>
          <option value="">Standalone — not attached</option>
          {videos.map((video) => (
            <option key={video.id} value={video.id}>
              {video.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-2xl" />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-2xl"
        />
      </div>
      {resourceType === "link" ? (
        <div className="space-y-1.5">
          <Label>Link URL</Label>
          <Input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>
      ) : resourceType === "note" ? (
        <div className="space-y-1.5">
          <Label>Note text</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-32 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-3">
          {resourceType === "audio" ? (
            <VoiceRecorder value={file} onChange={setFile} label="Record a voice note" />
          ) : null}
          <div className="space-y-1.5">
            <Label>
              {resourceType === "audio"
                ? "Or upload an audio file"
                : resourceType === "image"
                  ? "Upload picture"
                  : "Upload file"}
            </Label>
            <input
              type="file"
              accept={resourceType === "image" ? "image/*" : undefined}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs text-muted-foreground"
            />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Cover picture (optional)</Label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
          className="text-xs text-muted-foreground"
        />
        <p className="text-[11px] text-muted-foreground">
          Shown on the resource card and in the preview when the link is shared.
        </p>
      </div>
      <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save resource
      </Button>
    </form>
  );
}
