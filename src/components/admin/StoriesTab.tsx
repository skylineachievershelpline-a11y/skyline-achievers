import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminCreateUploadUrl } from "@/lib/admin.functions";
import { formatDateTime } from "@/lib/format";
import { adminDeleteStory, adminGetStories, adminSaveStory } from "@/lib/stories.functions";
import { startUpload } from "@/lib/upload-manager";
import { cn } from "@/lib/utils";

const fieldClass = "h-11 w-full rounded-2xl border border-border bg-input px-3 text-sm text-foreground";

const BACKGROUNDS = [
  "linear-gradient(160deg,#0b1220,#1d4ed8)",
  "linear-gradient(160deg,#06263b,#22d3ee)",
  "linear-gradient(160deg,#111827,#475569)",
  "linear-gradient(160deg,#0b1220,#7c3aed)",
] as const;

type Kind = "text" | "image" | "video";

/**
 * Story / status manager: post text, a picture or a video that shows on the
 * Skyline logo ring for a chosen number of hours.
 */
export function StoriesTab() {
  const queryClient = useQueryClient();
  const loadStories = useServerFn(adminGetStories);
  const save = useServerFn(adminSaveStory);
  const remove = useServerFn(adminDeleteStory);
  const createUploadUrl = useServerFn(adminCreateUploadUrl);

  const { data, isPending } = useQuery({
    queryKey: ["admin-stories"],
    queryFn: () => loadStories(),
  });

  const [kind, setKind] = useState<Kind>("text");
  const [textBody, setTextBody] = useState("");
  const [caption, setCaption] = useState("");
  const [background, setBackground] = useState<string>(BACKGROUNDS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-stories"] });
    void queryClient.invalidateQueries({ queryKey: ["active-stories"] });
  }

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } } as never),
    onSuccess: () => {
      toast.success("Story deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: (story: any) =>
      save({
        data: {
          id: story.id,
          kind: story.kind,
          caption: story.caption,
          textBody: story.text_body,
          background: story.background,
          hours: 24,
          isPublished: !story.is_published,
        },
      } as never),
    onSuccess: () => {
      toast.success("Story updated");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function post() {
    if (kind === "text" && !textBody.trim()) {
      toast.error("Write the story text first.");
      return;
    }
    if (kind !== "text" && !file) {
      toast.error("Choose a picture or video first.");
      return;
    }
    setBusy(true);
    try {
      let mediaPath: string | null = null;
      let mediaBucket: "training-videos" | "training-thumbnails" | null = null;
      if (file) {
        mediaBucket = kind === "video" ? "training-videos" : "training-thumbnails";
        const bucket = mediaBucket;
        mediaPath = await startUpload({
          label: `Uploading ${file.name}`,
          file,
          createSlot: () =>
            createUploadUrl({ data: { bucket, fileName: file.name } } as never) as Promise<{
              path: string;
              signedUrl: string;
            }>,
        });
      }
      await save({
        data: {
          kind,
          caption: caption.trim() || null,
          textBody: kind === "text" ? textBody.trim() : null,
          background: kind === "text" ? background : null,
          mediaBucket,
          mediaPath,
          hours,
          isPublished: true,
        },
      } as never);
      toast.success("Story posted");
      setTextBody("");
      setCaption("");
      setFile(null);
      refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stories = ((data as any)?.stories ?? []) as any[];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="glass-panel-strong space-y-4 rounded-3xl p-6">
        <div className="space-y-2">
          <Label>Story type</Label>
          <div className="flex gap-2">
            {(["text", "image", "video"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setKind(option);
                  setFile(null);
                }}
                className={cn(
                  "flex-1 rounded-full border border-hairline px-3 py-2 text-xs capitalize transition-colors",
                  kind === option
                    ? "brand-gradient text-brand-foreground"
                    : "bg-glass text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {kind === "text" ? (
          <>
            <div className="space-y-2">
              <Label>Story text</Label>
              <Textarea
                value={textBody}
                onChange={(event) => setTextBody(event.target.value)}
                className="min-h-28 rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Background</Label>
              <div className="flex gap-2">
                {BACKGROUNDS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setBackground(option)}
                    aria-label="Select background"
                    className={cn(
                      "h-10 w-10 rounded-full border-2",
                      background === option ? "border-cyan" : "border-transparent",
                    )}
                    style={{ background: option }}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label>{kind === "video" ? "Story video" : "Story picture"}</Label>
            <input
              type="file"
              accept={kind === "video" ? "video/*" : "image/*"}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="text-xs text-muted-foreground"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Caption (optional)</Label>
          <Input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        <div className="space-y-2">
          <Label>Disappears after (hours)</Label>
          <select
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
            className={fieldClass}
          >
            {[6, 12, 24, 48, 72, 168].map((option) => (
              <option key={option} value={option}>
                {option} hours
              </option>
            ))}
          </select>
        </div>

        <Button type="button" variant="brand" size="xl" disabled={busy} onClick={() => void post()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Post story
        </Button>
      </section>

      <section>
        <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-brand-glow">
          Stories
        </h3>
        {isPending ? (
          <div className="flex justify-center py-8">
            <SkylineLoader />
          </div>
        ) : stories.length === 0 ? (
          <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
            No stories posted yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {stories.map((story) => (
              <li key={story.id} className="glass-panel flex items-center gap-3 rounded-2xl p-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-hairline text-[10px] uppercase text-muted-foreground"
                  style={story.kind === "text" ? { background: story.background ?? undefined } : undefined}
                >
                  {story.kind === "image" && story.media_url ? (
                    <img src={story.media_url} alt="" className="h-full w-full object-cover" />
                  ) : story.kind === "video" ? (
                    "Video"
                  ) : (
                    "Text"
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {story.text_body || story.caption || `${story.kind} story`}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {story.live ? "Live" : "Ended"} · posted {formatDateTime(story.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => toggle.mutate(story)}
                  aria-label={story.is_published ? "Hide story" : "Publish story"}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {story.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => del.mutate(story.id)}
                  aria-label="Delete story"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
