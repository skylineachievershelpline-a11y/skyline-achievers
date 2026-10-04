import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Download,
  Heart,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ReelAuthor } from "@/components/media/ReelAuthor";
import { EmptyState } from "@/components/member/cards";
import {
  MemberShell,
  useMemberGuard,
} from "@/components/member/MemberShell";
import { UploadProgress, useUploadProgress } from "@/components/UploadProgress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BRAND } from "@/lib/brand";
import {
  addReelComment,
  createReel,
  deleteReel,
  getReelComments,
  getCreatorReels,
  getReelUploadUrl,
  getReels,
  markReelSeen,
  toggleReelLike,
  toggleReelSave,
} from "@/lib/reels.functions";
import { resumableUpload } from "@/lib/resumable-upload";
import { RankPin } from "@/components/member/RankPin";

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

type Reel = {
  id: string;
  title: string;
  caption: string | null;
  url: string | null;
  posterUrl: string | null;
  authorName: string;
  authorAvatarUrl?: string | null;
  authorRank?: string | null;
  verified: boolean;
  founder?: boolean;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
  isMine: boolean;
  authorId?: string;
};

function compactCount(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) {
    const count = value / 1_000;
    return `${count >= 10 || Number.isInteger(count) ? count.toFixed(0) : count.toFixed(1)}K`;
  }
  const count = value / 1_000_000;
  return `${count >= 10 || Number.isInteger(count) ? count.toFixed(0) : count.toFixed(1)}M`;
}

function reelFileName(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `skyline-achievers-${slug || "reel"}.mp4`;
}

function ReelsPage() {
  const ready = useMemberGuard();
  const queryClient = useQueryClient();
  const load = useServerFn(getReels);
  const remove = useServerFn(deleteReel);
  const seen = useServerFn(markReelSeen);
  const like = useServerFn(toggleReelLike);
  const save = useServerFn(toggleReelSave);
  const [composer, setComposer] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<Reel | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, Partial<Reel>>>({});
  const marked = useRef<Set<string>>(new Set());
  const reelFeedRef = useRef<HTMLDivElement | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["reels"],
    queryFn: () => load(),
    enabled: ready,
    staleTime: 0,
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Reel removed");
      void queryClient.invalidateQueries({ queryKey: ["reels"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reels = useMemo(
    () => ((data?.reels ?? []) as Reel[]).map((r) => ({ ...r, ...(local[r.id] ?? {}) })),
    [data, local],
  );

  function onActive(id: string) {
    setActiveId(id);
    if (marked.current.has(id)) return;
    marked.current.add(id);
    void seen({ data: { id } }).catch(() => undefined);
  }

  async function onLike(reel: Reel) {
    const next = !reel.liked;
    setLocal((state) => ({
      ...state,
      [reel.id]: { ...state[reel.id], liked: next, likes: reel.likes + (next ? 1 : -1) },
    }));
    try {
      await like({ data: { id: reel.id } });
    } catch {
      setLocal((state) => ({
        ...state,
        [reel.id]: { ...state[reel.id], liked: reel.liked, likes: reel.likes },
      }));
    }
  }

  async function onSave(reel: Reel) {
    const next = !reel.saved;
    setLocal((state) => ({ ...state, [reel.id]: { ...state[reel.id], saved: next } }));
    try {
      await save({ data: { id: reel.id } });
      toast.success(next ? "Saved to your collection" : "Removed from saved");
    } catch {
      setLocal((state) => ({ ...state, [reel.id]: { ...state[reel.id], saved: reel.saved } }));
    }
  }

  async function onDownload(reel: Reel) {
    if (!reel.url) return;
    const loading = toast.loading("Preparing reel for your gallery…");
    try {
      const response = await fetch(reel.url);
      if (!response.ok) throw new Error("download");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = reelFileName(reel.title);
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success("Reel saved to your gallery", { id: loading });
    } catch {
      toast.error("This reel could not be saved. Please try again.", { id: loading });
    }
  }

  function moveReel(direction: -1 | 1) {
    const currentIndex = Math.max(0, reels.findIndex((reel) => reel.id === activeId));
    const nextIndex = Math.min(reels.length - 1, Math.max(0, currentIndex + direction));
    const nextReel = reels[nextIndex];
    const feed = reelFeedRef.current;
    if (!nextReel || !feed) return;
    const target = feed.querySelector<HTMLElement>(`[data-reel-id="${nextReel.id}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const activeIndex = Math.max(0, reels.findIndex((reel) => reel.id === activeId));

  if (!ready || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <SkylineLoader variant="page" />
      </div>
    );
  }

  return (
    <MemberShell title="Reels" subtitle="Short clips from the Skyline team">
      {data?.canPost ? (
        <div className="mb-4 flex items-center justify-end">
          <Button variant="brand" className="rounded-2xl" onClick={() => setComposer(true)}>
            <Plus className="h-4 w-4" /> Upload reel
          </Button>
        </div>
      ) : null}

      {reels.length === 0 ? (
        <EmptyState
          title="No reels yet"
          hint="Short clips will appear here as soon as they are posted."
        />
      ) : (
        <div className="relative mx-auto max-w-md">
          <div
            ref={reelFeedRef}
            className="no-scrollbar h-[calc(100dvh-11rem)] min-h-[31rem] snap-y snap-mandatory scroll-smooth overflow-y-auto overscroll-contain rounded-3xl [-webkit-overflow-scrolling:touch]"
          >
            <div>
              {reels.map((reel) => (
                <ReelCard
                  key={reel.id}
                  reel={reel}
                  isActive={activeId === reel.id}
                  onActive={() => onActive(reel.id)}
                  onLike={() => void onLike(reel)}
                  onSave={() => void onSave(reel)}
                  onDownload={() => void onDownload(reel)}
                  onComments={() => setCommentsFor(reel)}
                  onDelete={reel.isMine ? () => del.mutate(reel.id) : undefined}
                  onAuthor={() => setProfileFor(reel.authorId ?? "official")}
                />
              ))}
            </div>
          </div>

          <div className="absolute left-[calc(100%+0.75rem)] top-1/2 hidden -translate-y-1/2 flex-col gap-2 md:flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full shadow-glass"
              onClick={() => moveReel(-1)}
              disabled={activeIndex <= 0}
              aria-label="Previous reel"
              title="Previous reel"
            >
              <ChevronUp className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="brand"
              size="icon"
              className="rounded-full shadow-brand"
              onClick={() => moveReel(1)}
              disabled={activeIndex >= reels.length - 1}
              aria-label="Next reel"
              title="Next reel"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>

          {activeIndex < reels.length - 1 ? (
            <Button
              type="button"
              variant="brand"
              size="icon"
              className="absolute bottom-4 right-3 z-20 rounded-full shadow-brand md:hidden"
              onClick={() => moveReel(1)}
              aria-label="Next reel"
              title="Next reel"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          ) : null}
        </div>
      )}

      <Dialog open={Boolean(commentsFor)} onOpenChange={(next) => !next && setCommentsFor(null)}>
        <DialogContent className="max-h-[85vh] overflow-hidden rounded-3xl p-0">
          <DialogHeader className="border-b border-hairline px-5 py-4">
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          {commentsFor ? <CommentsPanel reelId={commentsFor.id} /> : null}
        </DialogContent>
      </Dialog>

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

      <Dialog open={Boolean(profileFor)} onOpenChange={(next) => !next && setProfileFor(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Creator profile</DialogTitle>
          </DialogHeader>
          {profileFor ? (
            <CreatorProfile
              authorId={profileFor}
              onOpenReel={(id) => {
                setProfileFor(null);
                const target = reelFeedRef.current?.querySelector<HTMLElement>(`[data-reel-id="${id}"]`);
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </MemberShell>
  );
}

function ReelCard({
  reel,
  isActive,
  onActive,
  onLike,
  onSave,
  onDownload,
  onComments,
  onDelete,
  onAuthor,
}: {
  reel: Reel;
  isActive: boolean;
  onActive: () => void;
  onLike: () => void;
  onSave: () => void;
  onDownload: () => void;
  onComments: () => void;
  onDelete?: (() => void) | undefined;
  onAuthor: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // Only the centred clip plays; every other one is paused and silenced so two
  // reels can never be heard at once.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const centred = entry.intersectionRatio > 0.6;
        setVisible(centred);
        if (centred) onActive();
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(video);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (visible && isActive) {
      video.muted = false;
      void video.play().catch(() => {
        // Some phones refuse sound before the first tap — fall back to silent play.
        video.muted = true;
        void video.play().catch(() => undefined);
      });
    } else {
      video.pause();
      video.muted = true;
    }
  }, [visible, isActive]);

  return (
    <article
      data-reel-id={reel.id}
      className={`metal-edge relative mx-auto flex h-[calc(100dvh-11rem)] min-h-[31rem] w-full snap-start snap-always items-center justify-center overflow-hidden rounded-3xl border bg-media shadow-lift transition-all duration-500 ease-out will-change-transform ${
        visible ? "scale-100 opacity-100" : "scale-[0.98] opacity-80"
      }`}
    >
      {reel.url ? (
        <video
          ref={videoRef}
          src={reel.url}
          poster={reel.posterUrl ?? undefined}
          loop
          playsInline
          preload="metadata"
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onPlaying={() => setLoading(false)}
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.paused) void video.play().catch(() => undefined);
            else video.pause();
          }}
          className="h-full w-full bg-media object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
          Video unavailable
        </div>
      )}

      {reel.url && loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[2px]">
          <SkylineLoader />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center bg-gradient-to-b from-background/90 via-background/45 to-transparent px-16 pb-10 pt-3">
        <div className="flex max-w-full items-center gap-2 rounded-full border border-cyan/30 bg-background/75 px-3 py-1.5 shadow-brand backdrop-blur-md">
          <img src={BRAND.logoUrl} alt="" className="h-6 w-6 shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase text-foreground">{BRAND.name}</p>
            <p className="text-[8px] uppercase text-silver">Learn • Earn • Lead</p>
          </div>
        </div>
      </div>

      {/* action rail, TikTok style */}
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4">
        <ActionButton
           label={compactCount(reel.likes)}
          active={reel.liked}
          onClick={onLike}
          aria-label={reel.liked ? "Remove like" : "Like reel"}
        >
          <Heart className={`h-5 w-5 ${reel.liked ? "fill-current" : ""}`} />
        </ActionButton>
        <ActionButton label={compactCount(reel.comments)} onClick={onComments} aria-label="Comments">
          <MessageCircle className="h-5 w-5" />
        </ActionButton>
        <ActionButton label="Gallery" onClick={onDownload} aria-label="Save reel to gallery">
          <Download className="h-5 w-5" />
        </ActionButton>
        <ActionButton
          label={reel.saved ? "Saved" : "Save"}
          active={reel.saved}
          onClick={onSave}
          aria-label={reel.saved ? "Remove from saved" : "Save reel"}
        >
          <Bookmark className={`h-5 w-5 ${reel.saved ? "fill-current" : ""}`} />
        </ActionButton>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-4 pr-16 pt-14">
        <button
          type="button"
          onClick={onAuthor}
          aria-label={`Open ${reel.authorName} profile`}
          className="pointer-events-auto max-w-full rounded-full text-left transition-transform active:scale-95"
        >
          <ReelAuthor reel={reel} />
        </button>
        <h3 className="mt-2 font-display text-base font-semibold">{reel.title}</h3>
        {reel.caption ? (
          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{reel.caption}</p>
        ) : null}
      </div>

      {onDelete ? (
        <button
          onClick={onDelete}
          aria-label="Delete reel"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-background/70 text-muted-foreground backdrop-blur transition-all duration-300 hover:text-destructive active:scale-95"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </article>
  );
}

function ActionButton({
  children,
  label,
  active,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className={`flex flex-col items-center gap-1 transition-transform duration-300 active:scale-90 ${
        active ? "text-brand-glow" : "text-foreground"
      }`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-background/70 backdrop-blur">
        {children}
      </span>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}

function CommentsPanel({ reelId }: { reelId: string }) {
  const loadComments = useServerFn(getReelComments);
  const send = useServerFn(addReelComment);
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["reel-comments", reelId],
    queryFn: () => loadComments({ data: { id: reelId } }),
  });

  const post = useMutation({
    mutationFn: (value: string) => send({ data: { id: reelId, body: value } }),
    onSuccess: () => {
      setBody("");
      toast.success("Comment sent — it appears to others once approved.");
      void queryClient.invalidateQueries({ queryKey: ["reel-comments", reelId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const comments = data?.comments ?? [];

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {isPending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
          </div>
        ) : comments.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No comments yet. Be the first one.
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="glass-panel rounded-2xl p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-surface-2 text-[10px] font-semibold">
                  {comment.authorName.slice(0, 1).toUpperCase()}
                </span>
                <p className="truncate text-xs font-semibold">{comment.authorName}</p>
                {comment.pending ? (
                  <span className="ml-auto rounded-full border border-hairline px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                    Awaiting approval
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{comment.body}</p>
            </div>
          ))
        )}
      </div>
      <form
        className="flex items-center gap-2 border-t border-hairline px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!body.trim()) return;
          post.mutate(body.trim());
        }}
      >
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a comment…"
          className="h-11 rounded-2xl"
        />
        <Button type="submit" variant="brand" className="rounded-2xl" disabled={post.isPending}>
          {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

function ReelComposer({ onDone }: { onDone: () => void }) {
  const createUrl = useServerFn(getReelUploadUrl);
  const save = useServerFn(createReel);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const uploadProgress = useUploadProgress();

  useEffect(() => {
    setDuration(null);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) setDuration(probe.duration);
      URL.revokeObjectURL(url);
    };
    probe.onerror = () => URL.revokeObjectURL(url);
    probe.src = url;
  }, [file]);

  async function upload(kind: "video" | "cover", target: File) {
    const extension = (target.name.split(".").pop() ?? "mp4").toLowerCase();
    // Reuse the same upload slot for the same file so a retry continues where it stopped.
    const key = `skyline-reel-slot:${target.name}:${target.size}:${target.lastModified}`;
    let slot: { path: string; signedUrl: string; at: number } | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null");
      if (saved && Date.now() - saved.at < 90 * 60 * 1000) slot = saved;
    } catch {
      slot = null;
    }
    if (!slot) {
      const fresh = await createUrl({ data: { kind, extension } } as never);
      slot = { ...fresh, at: Date.now() };
      localStorage.setItem(key, JSON.stringify(slot));
    }
    await resumableUpload(
      kind === "video" ? "training-videos" : "training-thumbnails",
      slot.path,
      slot.signedUrl,
      target,
      uploadProgress.handler(kind === "video" ? "Uploading reel" : "Uploading cover"),
      setReconnecting,
    );
    localStorage.removeItem(key);
    return slot.path;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!title.trim() || !file) {
          toast.error("Choose a video file to upload.");
          return;
        }
        setBusy(true);
        uploadProgress.clear();
        try {
          const videoPath = file ? await upload("video", file) : null;
          await save({
            data: {
              title: title.trim(),
              caption: caption.trim() || null,
              videoPath,
              thumbnailPath: null,
            },
          } as never);
          toast.success("Reel sent for admin approval — it goes live once approved.");
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
      <label className="group flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-cyan/35 bg-surface-2 p-6 text-center transition-colors hover:border-cyan/70">
        <span className="grid h-20 w-20 place-items-center rounded-full border border-cyan/30 bg-primary/10 shadow-brand"><UploadCloud className="h-9 w-9 text-brand-glow" /></span>
        <span className="mt-4 font-display text-base font-semibold">Drop your video here</span>
        <span className="mt-2 text-xs text-muted-foreground">Vertical MP4 video gives the best result</span>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>
      {file ? <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface-2 p-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10"><Video className="text-brand-glow" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.name}</p><p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB{duration ? ` · ${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, "0")} min` : ""}</p></div><Button type="button" size="icon" variant="ghost" aria-label="Remove selected video" disabled={busy} onClick={() => setFile(null)}><X /></Button></div> : null}
      <UploadProgress state={uploadProgress.state} />
      {busy && reconnecting ? <p className="text-center text-xs text-cyan">Internet is weak — reconnecting. Your upload will continue from where it stopped.</p> : null}
      {busy ? <p className="text-center text-[11px] text-muted-foreground">Keep this page open until the upload finishes.</p> : null}
      <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" size="xl" onClick={onDone}>Cancel</Button><Button type="submit" variant="brand" size="xl" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Upload
      </Button></div>
    </form>
  );
}

function CreatorProfile({ authorId, onOpenReel }: { authorId: string; onOpenReel: (id: string) => void }) {
  const load = useServerFn(getCreatorReels);
  const { data, isPending } = useQuery({
    queryKey: ["creator-reels", authorId],
    queryFn: () => load({ data: { authorId } }),
  });
  if (isPending || !data) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <SkylineLoader />
      </div>
    );
  }
  const { profile, reels, totalLikes } = data;
  const official = authorId === "official";
  return (
    <div className="pb-4">
      <div className="flex flex-col items-center px-5 pt-8 text-center">
        <span className="rounded-full bg-gradient-to-br from-cyan to-primary p-[3px] shadow-brand">
          {official ? (
            <img src={BRAND.logoUrl} alt="" className="h-24 w-24 rounded-full bg-surface-2 object-contain p-2" />
          ) : profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-24 w-24 rounded-full bg-surface-2 object-cover" />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-2 font-display text-3xl font-semibold">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <div className="mt-3 flex items-center gap-1.5">
          <h2 className="font-display text-lg font-semibold">{profile.name}</h2>
          {profile.verified ? <BadgeCheck className="h-5 w-5 text-emerald-400" aria-label="Verified" /> : null}
        </div>
        {profile.memberId ? <p className="text-xs text-muted-foreground">ID {profile.memberId}</p> : null}
        {profile.rank ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-silver">
            <RankPin rank={profile.rank} className="h-7 w-7" />
            {profile.rank}
          </div>
        ) : official ? (
          <p className="mt-1 text-xs text-cyan">Official account</p>
        ) : null}
        <div className="mt-5 grid w-full grid-cols-2 gap-2">
          <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
            <p className="font-display text-xl font-semibold">{compactCount(reels.length)}</p>
            <p className="text-[11px] text-muted-foreground">Reels</p>
          </div>
          <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
            <p className="font-display text-xl font-semibold">{compactCount(totalLikes)}</p>
            <p className="text-[11px] text-muted-foreground">Likes</p>
          </div>
        </div>
      </div>
      <div className="mt-5 border-t border-hairline pt-1">
        {reels.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No reels posted yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {reels.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpenReel(r.id)}
                aria-label={`Play ${r.title}`}
                className="relative aspect-[9/16] overflow-hidden bg-media transition-opacity active:opacity-70"
              >
                {r.posterUrl ? (
                  <img src={r.posterUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-muted-foreground">
                    {r.title}
                  </span>
                )}
                <span className="absolute bottom-1 left-1 flex items-center gap-0.5 text-[10px] font-semibold text-foreground drop-shadow">
                  <Heart className="h-3 w-3 fill-current" />
                  {compactCount(r.likes)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
