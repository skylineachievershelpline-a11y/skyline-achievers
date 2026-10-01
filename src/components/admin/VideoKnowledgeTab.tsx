import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  adminAutoIndexVideo,
  adminListVideoKnowledge,
  adminSaveVideoTranscript,
  adminSetVideoKnowledgeActive,
  adminTranscribeUploadedVideo,
} from "@/lib/video-knowledge.functions";

type VideoRow = Awaited<ReturnType<typeof adminListVideoKnowledge>>["videos"][number];

const STATUS_LABEL: Record<string, string> = {
  ready: "AI knows this video",
  pending: "Not learned yet",
  failed: "Needs attention",
};

const STATUS_STYLE: Record<string, string> = {
  ready: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  pending: "bg-white/10 text-white/60 border-white/15",
  failed: "bg-rose-500/15 text-rose-300 border-rose-400/30",
};

export function VideoKnowledgeTab() {
  const queryClient = useQueryClient();
  const listVideos = useServerFn(adminListVideoKnowledge);
  const autoIndex = useServerFn(adminAutoIndexVideo);
  const saveTranscript = useServerFn(adminSaveVideoTranscript);
  const transcribeUpload = useServerFn(adminTranscribeUploadedVideo);
  const setActive = useServerFn(adminSetVideoKnowledgeActive);

  const [pasteFor, setPasteFor] = useState<VideoRow | null>(null);
  const [transcript, setTranscript] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["admin-video-knowledge"],
    queryFn: () => listVideos({}),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-video-knowledge"] });

  const report = (result: { status: string; message?: string; chapters?: number }) => {
    if (result.status === "ready") {
      toast.success(
        result.chapters
          ? `Learned — ${result.chapters} chapters saved with timestamps.`
          : "Learned — the AI can now answer about this video.",
      );
    } else {
      toast.error(result.message ?? "Could not learn this video.");
    }
    refresh();
  };

  const auto = useMutation({
    mutationFn: (id: string) => autoIndex({ data: { id } }),
    onSuccess: report,
    onError: (error: Error) => toast.error(error.message),
  });

  const listen = useMutation({
    mutationFn: (id: string) => transcribeUpload({ data: { id } }),
    onSuccess: report,
    onError: (error: Error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: (input: { id: string; transcript: string }) => saveTranscript({ data: input }),
    onSuccess: (result) => {
      setPasteFor(null);
      setTranscript("");
      report(result);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) => setActive({ data: input }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending) return <SkylineLoader label="Loading videos" />;

  const videos = data?.videos ?? [];
  const ready = videos.filter((video) => video.status === "ready").length;
  const busy = auto.isPending || listen.isPending || save.isPending;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        <h2 className="text-lg font-semibold text-white">Skyline AI — video knowledge</h2>
        <p className="mt-1 text-sm text-white/60">
          Teach the AI what each video says. Once a video is learned, members can ask what was
          explained and the AI answers with the exact time in the video.
        </p>
        <p className="mt-3 text-sm text-white/50">
          {ready} of {videos.length} videos learned.
        </p>
      </div>

      <div className="space-y-3">
        {videos.map((video) => (
          <div
            key={video.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{video.title}</p>
                <p className="mt-0.5 text-xs text-white/50">
                  {video.videoLabel ?? video.sourceKind}
                  {video.youtubeId ? " · YouTube" : video.videoUrl ? " · Link" : " · Uploaded"}
                  {video.chapters > 0 ? ` · ${video.chapters} chapters` : ""}
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs ${
                  STATUS_STYLE[video.status] ?? STATUS_STYLE["pending"]
                }`}
              >
                {STATUS_LABEL[video.status] ?? video.status}
              </span>
            </div>

            {video.summary ? (
              <p className="mt-3 line-clamp-3 text-sm text-white/70">{video.summary}</p>
            ) : null}
            {video.status === "failed" && video.lastError ? (
              <p className="mt-3 text-sm text-rose-300">{video.lastError}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {video.youtubeId ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => auto.mutate(video.id)}
                >
                  {auto.isPending && auto.variables === video.id ? "Learning…" : "Learn automatically"}
                </Button>
              ) : null}
              {!video.videoUrl ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => listen.mutate(video.id)}
                >
                  {listen.isPending && listen.variables === video.id
                    ? "Listening…"
                    : "Listen to this video"}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setPasteFor(video);
                  setTranscript("");
                }}
              >
                Paste transcript
              </Button>
              {video.status === "ready" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: video.id, isActive: !video.isActive })}
                >
                  {video.isActive ? "Hide from AI" : "Show to AI"}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {videos.length === 0 ? (
          <p className="text-sm text-white/50">No videos found yet.</p>
        ) : null}
      </div>

      <Dialog open={pasteFor !== null} onOpenChange={(open) => !open && setPasteFor(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Paste the transcript</DialogTitle>
            <DialogDescription>
              On YouTube open the video, press the three dots and choose “Show transcript”, then
              copy everything and paste it here. Times are kept automatically. Plain text without
              times also works.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            rows={12}
            placeholder={"0:05 Assalam o alaikum...\n0:18 Aaj hum baat karenge..."}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPasteFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={transcript.trim().length < 40 || save.isPending}
              onClick={() =>
                pasteFor && save.mutate({ id: pasteFor.id, transcript: transcript.trim() })
              }
            >
              {save.isPending ? "Learning…" : "Teach the AI"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
