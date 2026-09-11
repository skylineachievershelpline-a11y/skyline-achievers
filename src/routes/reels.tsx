import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/member/cards";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { UploadProgress, useUploadProgress } from "@/components/UploadProgress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createReel, deleteReel, getReelUploadUrl, getReels } from "@/lib/reels.functions";
import { putWithProgress } from "@/lib/upload-progress";

export const Route = createFileRoute("/reels")({
  head: () => ({
    meta: [
      { title: "Reels — Skyline Achievers" },
      {
        name: "description",
        content:
          "Short vertical motivation and training clips from the Skyline Achievers team, swipe style.",
      },
      { property: "og:title", content: "Reels — Skyline Achievers" },
      { property: "og:description", content: "Swipe through short Skyline Achievers clips." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReelsPage,
});

function ReelsPage() {
  const ready = useMemberGuard();
  const queryClient = useQueryClient();
  const load = useServerFn(getReels);
  const remove = useServerFn(deleteReel);
  const [muted, setMuted] = useState(true);
  const [composer, setComposer] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["reels"],
    queryFn: () => load(),
    enabled: ready,
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Reel removed");
      void queryClient.invalidateQueries({ queryKey: ["reels"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!ready || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  const reels = data?.reels ?? [];

  return (
    <MemberShell title="Reels" subtitle="Short clips from the Skyline team">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setMuted((m) => !m)}
          className="flex items-center gap-2 rounded-full border border-hairline bg-glass px-3 py-1.5 text-xs"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          {muted ? "Sound off" : "Sound on"}
        </button>
        {data?.isManager ? (
          <Button variant="brand" className="rounded-2xl" onClick={() => setComposer(true)}>
            <Plus className="h-4 w-4" /> New reel
          </Button>
        ) : null}
      </div>

      {reels.length === 0 ? (
        <EmptyState title="No reels yet" hint="Short clips will appear here as soon as they are posted." />
      ) : (
        <div className="no-scrollbar mx-auto h-[calc(100vh-15rem)] max-w-md snap-y snap-mandatory overflow-y-auto rounded-3xl">
          <div className="space-y-4">
            {reels.map((reel: any) => (
              <ReelCard
                key={reel.id}
                reel={reel}
                muted={muted}
                onDelete={reel.isMine ? () => del.mutate(reel.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      <Dialog open={composer} onOpenChange={setComposer}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Post a reel</DialogTitle>
          </DialogHeader>
          <ReelComposer
            onDone={() => {
              setComposer(false);
              void queryClient.invalidateQueries({ queryKey: ["reels"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </MemberShell>
  );
}

function ReelCard({
  reel,
  muted,
  onDelete,
}: {
  reel: { title: string; caption: string | null; url: string | null; posterUrl: string | null; authorName: string };
  muted: boolean;
  onDelete?: (() => void) | undefined;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Autoplay whichever reel is centred in the viewport, like a native feed.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.intersectionRatio > 0.6) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <article className="relative snap-start overflow-hidden rounded-3xl border border-hairline bg-black shadow-[var(--shadow-lift)] animate-rise-in">
      {reel.url ? (
        <video
          ref={videoRef}
          src={reel.url}
          poster={reel.posterUrl ?? undefined}
          loop
          muted={muted}
          playsInline
          controlsList="nodownload"
          className="aspect-[9/16] w-full bg-black object-cover"
        />
      ) : (
        <div className="flex aspect-[9/16] w-full items-center justify-center text-sm text-muted-foreground">
          Video unavailable
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-4 pt-12">
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-glow">{reel.authorName}</p>
        <h3 className="mt-1 font-display text-base font-semibold">{reel.title}</h3>
        {reel.caption ? (
          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{reel.caption}</p>
        ) : null}
      </div>
      {onDelete ? (
        <button
          onClick={onDelete}
          aria-label="Delete reel"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-background/70 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </article>
  );
}

function ReelComposer({ onDone }: { onDone: () => void }) {
  const createUrl = useServerFn(getReelUploadUrl);
  const save = useServerFn(createReel);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const uploadProgress = useUploadProgress();

  async function upload(kind: "video" | "cover", target: File) {
    const extension = (target.name.split(".").pop() ?? "mp4").toLowerCase();
    const slot = await createUrl({ data: { kind, extension } } as never);
    await putWithProgress(
      slot.signedUrl,
      target,
      uploadProgress.handler(kind === "video" ? "Uploading reel" : "Uploading cover"),
    );
    return slot.path;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!title.trim() || (!file && !videoUrl.trim())) return;
        setBusy(true);
        uploadProgress.clear();
        try {
          const videoPath = file ? await upload("video", file) : null;
          await save({
            data: {
              title: title.trim(),
              caption: caption.trim() || null,
              videoPath,
              videoUrl: videoPath ? null : videoUrl.trim(),
              thumbnailPath: null,
            },
          } as never);
          toast.success("Reel posted");
          onDone();
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setBusy(false);
          uploadProgress.clear();
        }
      }}
    >
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-2xl" />
      </div>
      <div className="space-y-1.5">
        <Label>Caption</Label>
        <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="rounded-2xl" />
      </div>
      <div className="space-y-1.5">
        <Label>Upload vertical video</Label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-xs text-muted-foreground"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Or paste a video link</Label>
        <Input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://..."
          className="h-11 rounded-2xl"
        />
      </div>
      <UploadProgress state={uploadProgress.state} />
      <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Post reel
      </Button>
    </form>
  );
}
