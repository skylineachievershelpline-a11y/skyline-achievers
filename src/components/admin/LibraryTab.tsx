import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { frameFromVideo } from "@/components/admin/ReelsTab";
import { uploadToBucket } from "@/components/admin/upload";
import {
  adminCreateUploadUrl,
  adminDeleteContent,
  adminGetLibrary,
  adminSaveLecture,
  adminSaveResource,
  adminSaveSeries,
} from "@/lib/admin.functions";
import { RESOURCE_TYPE_LABEL } from "@/lib/brand";

type Library = Awaited<ReturnType<typeof adminGetLibrary>>;

export function LibraryTab() {
  const queryClient = useQueryClient();
  const loadLibrary = useServerFn(adminGetLibrary);
  const saveSeries = useServerFn(adminSaveSeries);
  const saveLecture = useServerFn(adminSaveLecture);
  const saveResource = useServerFn(adminSaveResource);
  const remove = useServerFn(adminDeleteContent);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);

  const { data, isPending } = useQuery<Library>({
    queryKey: ["admin-library"],
    queryFn: () => loadLibrary(),
  });

  const [dialog, setDialog] = useState<"series" | "lecture" | "resource" | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    
    void queryClient.invalidateQueries({ queryKey: ["admin-library"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  const del = useMutation({
    mutationFn: (input: { table: "series" | "lectures" | "resources"; id: string }) =>
      remove({ data: input }),
    onSuccess: () => {
      toast.success("Deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending || !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap gap-2">
        <Button variant="brand" size="xl" onClick={() => setDialog("series")}>
          <Plus className="h-4 w-4" /> New series
        </Button>
        <Button variant="secondary" size="xl" onClick={() => setDialog("lecture")}>
          <Plus className="h-4 w-4" /> New lecture
        </Button>
        <Button variant="secondary" size="xl" onClick={() => setDialog("resource")}>
          <Plus className="h-4 w-4" /> New resource
        </Button>
      </div>

      {data.levels.map((level: any) => {
        const series = data.series.filter((s: any) => s.level_id === level.id);
        return (
          <section key={level.id}>
            <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-brand-glow">
              {level.name}
            </h3>
            {series.length === 0 ? (
              <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
                No series in this level yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {series.map((s: any) => {
                  const lectures = data.lectures.filter((l: any) => l.series_id === s.id);
                  return (
                    <li key={s.id} className="glass-panel rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{s.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {lectures.length} lecture{lectures.length === 1 ? "" : "s"} ·{" "}
                            {s.is_published ? "Published" : "Draft"}
                          </p>
                        </div>
                        <button
                          onClick={() => del.mutate({ table: "series", id: s.id })}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          aria-label="Delete series"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {lectures.length > 0 ? (
                        <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3">
                          {lectures.map((l: any) => (
                            <li key={l.id} className="flex items-center gap-2 text-xs">
                              <span className="min-w-0 flex-1 truncate">{l.title}</span>
                              <span className="text-muted-foreground">
                                {l.video_source === "external" ? "Link" : "Upload"}
                              </span>
                              <button
                                onClick={() => del.mutate({ table: "lectures", id: l.id })}
                                className="text-muted-foreground transition-colors hover:text-destructive"
                                aria-label="Delete lecture"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
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
            {data.resources.map((r: any) => (
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

      {/* ---------- dialogs ---------- */}
      <Dialog open={dialog === "series"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>New series</DialogTitle>
          </DialogHeader>
          <SeriesForm
            levels={data.levels as any}
            busy={busy}
            onSubmit={async (values) => {
              setBusy(true);
              try {
                let thumbnailPath: string | null = null;
                if (values.thumbnail) {
                  thumbnailPath = await uploadToBucket(
                    createUploadUrl,
                    "training-thumbnails",
                    values.thumbnail,
                  );
                }
                await saveSeries({
                  data: {
                    levelId: values.levelId,
                    title: values.title,
                    description: values.description || null,
                    thumbnailPath,
                    sortOrder: values.sortOrder,
                    isPublished: true,
                  },
                } as never);
                toast.success("Series created");
                setDialog(null);
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

      <Dialog open={dialog === "lecture"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>New lecture</DialogTitle>
          </DialogHeader>
          <LectureForm
            series={data.series as any}
            levels={data.levels as any}
            busy={busy}
            onSubmit={async (values) => {
              setBusy(true);
              try {
                let videoPath: string | null = null;
                let thumbnailPath: string | null = null;
                if (values.videoFile) {
                  videoPath = await uploadToBucket(createUploadUrl, "training-videos", values.videoFile);
                }
                // No cover picked? Grab a still frame straight from the video.
                const cover =
                  values.thumbnail ?? (values.videoFile ? await frameFromVideo(values.videoFile) : null);
                if (cover) {
                  thumbnailPath = await uploadToBucket(createUploadUrl, "training-thumbnails", cover);
                }
                await saveLecture({
                  data: {
                    seriesId: values.seriesId || null,
                    levelId: values.seriesId ? null : values.levelId,
                    title: values.title,
                    description: values.description || null,
                    sortOrder: values.sortOrder,
                    durationSeconds: values.durationMinutes ? values.durationMinutes * 60 : null,
                    videoSource: values.videoUrl ? "external" : "upload",
                    videoPath,
                    videoUrl: values.videoUrl || null,
                    thumbnailPath,
                    aspectRatio: values.aspectRatio,
                    isPublished: true,
                  },
                } as never);
                toast.success("Lecture published");
                setDialog(null);
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

      <Dialog open={dialog === "resource"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>New resource</DialogTitle>
          </DialogHeader>
          <ResourceForm
            series={data.series as any}
            lectures={data.lectures as any}
            busy={busy}
            onSubmit={async (values) => {
              setBusy(true);
              try {
                let storagePath: string | null = null;
                if (values.file) {
                  storagePath = await uploadToBucket(createUploadUrl, "training-resources", values.file);
                }
                await saveResource({
                  data: {
                    lectureId: values.lectureId || null,
                    seriesId: values.lectureId ? null : values.seriesId || null,
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
                toast.success("Resource added");
                setDialog(null);
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

const fieldClass = "h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm";

function SeriesForm({
  levels,
  busy,
  onSubmit,
}: {
  levels: { id: string; name: string }[];
  busy: boolean;
  onSubmit: (values: {
    levelId: string;
    title: string;
    description: string;
    sortOrder: number;
    thumbnail: File | null;
  }) => void;
}) {
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [thumbnail, setThumbnail] = useState<File | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !levelId) return;
        onSubmit({ levelId, title: title.trim(), description, sortOrder: Number(sortOrder) || 0, thumbnail });
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label>Level</Label>
        <select value={levelId} onChange={(e) => setLevelId(e.target.value)} className={fieldClass}>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
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
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Order</Label>
          <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="h-11 rounded-2xl" />
        </div>
        <div className="space-y-1.5">
          <Label>Cover image</Label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
            className="text-xs text-muted-foreground"
          />
        </div>
      </div>
      <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Create series
      </Button>
    </form>
  );
}

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;

function LectureForm({
  series,
  levels,
  busy,
  onSubmit,
}: {
  series: { id: string; title: string; level_id?: string }[];
  levels: { id: string; name: string }[];
  busy: boolean;
  onSubmit: (values: {
    seriesId: string;
    levelId: string;
    aspectRatio: (typeof ASPECT_RATIOS)[number];
    title: string;
    description: string;
    sortOrder: number;
    durationMinutes: number | null;
    videoUrl: string;
    videoFile: File | null;
    thumbnail: File | null;
  }) => void;
}) {
  // Series is optional: leave it empty and the lecture sits directly on the level.
  const [seriesId, setSeriesId] = useState("");
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>("16:9");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [duration, setDuration] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || (!seriesId && !levelId)) return;
        onSubmit({
          seriesId,
          levelId,
          aspectRatio,
          title: title.trim(),
          description,
          sortOrder: Number(sortOrder) || 0,
          durationMinutes: duration ? Number(duration) : null,
          videoUrl: videoUrl.trim(),
          videoFile,
          thumbnail,
        });
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label>Training level</Label>
        <select value={levelId} onChange={(e) => setLevelId(e.target.value)} className={fieldClass}>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Series (optional)</Label>
        <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className={fieldClass}>
          <option value="">No series — add straight to the level</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Video ratio</Label>
        <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value as (typeof ASPECT_RATIOS)[number])}
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
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-2xl" />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Order</Label>
          <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="h-11 rounded-2xl" />
        </div>
        <div className="space-y-1.5">
          <Label>Length (minutes)</Label>
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} className="h-11 rounded-2xl" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>External video link (YouTube, Vimeo, Drive)</Label>
        <Input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Leave empty if uploading a file"
          className="h-11 rounded-2xl"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Or upload video file</Label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
          className="text-xs text-muted-foreground"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Thumbnail</Label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
          className="text-xs text-muted-foreground"
        />
      </div>
      <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Publish lecture
      </Button>
    </form>
  );
}

function ResourceForm({
  series,
  lectures,
  busy,
  onSubmit,
}: {
  series: { id: string; title: string }[];
  lectures: { id: string; title: string }[];
  busy: boolean;
  onSubmit: (values: {
    seriesId: string;
    lectureId: string;
    resourceType: "pdf" | "audio" | "presentation" | "book" | "link" | "note";
    title: string;
    description: string;
    externalUrl: string;
    body: string;
    file: File | null;
  }) => void;
}) {
  const [seriesId, setSeriesId] = useState(series[0]?.id ?? "");
  const [lectureId, setLectureId] = useState("");
  const [resourceType, setResourceType] = useState<
    "pdf" | "audio" | "presentation" | "book" | "link" | "note"
  >("pdf");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSubmit({ seriesId, lectureId, resourceType, title: title.trim(), description, externalUrl, body, file });
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label>Type</Label>
        <select
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value as typeof resourceType)}
          className={fieldClass}
        >
          {(["pdf", "audio", "presentation", "book", "link", "note"] as const).map((type) => (
            <option key={type} value={type}>
              {RESOURCE_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Attach to series</Label>
        <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className={fieldClass}>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Or attach to a lecture</Label>
        <select value={lectureId} onChange={(e) => setLectureId(e.target.value)} className={fieldClass}>
          <option value="">Series level (no lecture)</option>
          {lectures.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
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
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-2xl" />
      </div>
      {resourceType === "link" ? (
        <div className="space-y-1.5">
          <Label>Link URL</Label>
          <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} className="h-11 rounded-2xl" />
        </div>
      ) : resourceType === "note" ? (
        <div className="space-y-1.5">
          <Label>Note text</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-32 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Upload file</Label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs text-muted-foreground"
          />
        </div>
      )}
      <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save resource
      </Button>
    </form>
  );
}
