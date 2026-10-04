import { SecureYouTubePlayer, youtubeId } from "@/components/media/SecureYouTubePlayer";
import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";

import { EmptyState } from "@/components/member/cards";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { ResourceList } from "@/components/member/ResourceList";
import { Button } from "@/components/ui/button";
import { getLectureDetail, saveWatchPosition } from "@/lib/member.functions";
import { formatDuration } from "@/lib/format";

export const Route = createFileRoute("/lecture/$lectureId")({
  head: () => ({
    meta: [
      { title: "Lecture — Skyline Achievers" },
      {
        name: "description",
        content: "Watch your Skyline Achievers training lecture and open its attached resources.",
      },
      { property: "og:title", content: "Lecture — Skyline Achievers" },
      { property: "og:description", content: "Long-form training lecture for Skyline members." },
    ],
  }),
  component: LecturePage,
});

function LecturePage() {
  const { lectureId } = Route.useParams();
  const ready = useMemberGuard();
  const load = useServerFn(getLectureDetail);
  const savePosition = useServerFn(saveWatchPosition);
  const { data, isPending } = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: () => load({ data: { lectureId } }),
    enabled: ready,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resumed = useRef(false);
  const lastSaved = useRef(0);

  // Leaving the video on screen (or the tab) stops playback instead of letting
  // audio keep running in the background.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio < 0.3 && !video.paused) video.pause();
      },
      { threshold: [0, 0.3, 0.8] },
    );
    observer.observe(video);
    const onHidden = () => {
      if (document.visibilityState === "hidden" && !video.paused) video.pause();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [data]);

  // Resume from the stored position once the media is ready.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data || resumed.current) return;
    if (data.position > 0) {
      const apply = () => {
        video.currentTime = data.position;
        resumed.current = true;
      };
      if (video.readyState >= 1) apply();
      else video.addEventListener("loadedmetadata", apply, { once: true });
    } else {
      resumed.current = true;
    }
  }, [data]);

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    const seconds = Math.floor(video.currentTime);
    if (seconds - lastSaved.current < 10) return;
    lastSaved.current = seconds;
    void savePosition({ data: { lectureId, seconds } });
  }

  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video && video.currentTime > 15) {
        void savePosition({ data: { lectureId, seconds: Math.floor(video.currentTime) } });
      }
    };
  }, [lectureId, savePosition]);

  if (!ready || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <SkylineLoader variant="page" />
      </div>
    );
  }

  if (!data?.lecture) {
    return (
      <MemberShell title="Lecture unavailable">
        <EmptyState title="This lecture is not available" hint="Your rank does not unlock this content." />
      </MemberShell>
    );
  }

  const lecture = data.lecture as any;
  const isExternalEmbed =
    data.playback?.kind === "external" &&
    /youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com/.test(data.playback.url ?? "");

  // The admin picks the ratio when publishing; the player honours it so
  // portrait clips are not letterboxed inside a 16:9 frame.
  const ratio: string = lecture.aspect_ratio ?? "16:9";
  const RATIO_CLASS: Record<string, string> = {
    "16:9": "aspect-video",
    "9:16": "aspect-[9/16] mx-auto max-h-[78vh] w-auto",
    "1:1": "aspect-square mx-auto max-h-[78vh]",
    "4:3": "aspect-[4/3]",
  };
  const frameClass = RATIO_CLASS[ratio] ?? "aspect-video";

  return (
    <MemberShell title={lecture.title} subtitle={lecture.levels?.name ?? undefined}>
      <Button asChild variant="outline" className="mb-4 rounded-2xl">
        <Link to="/training">
          <ArrowLeft className="h-4 w-4" />
          Back to Training
        </Link>
      </Button>

      <div className="metal-edge overflow-hidden rounded-3xl border bg-media shadow-lift animate-rise-in">
        {data.playback?.url ? (
          isExternalEmbed ? (
            <div className={`w-full ${frameClass}`}>
              {youtubeId(data.playback.url) ? (
                <SecureYouTubePlayer url={data.playback.url} title={lecture.title} />
              ) : (
                <iframe
                  src={toEmbedUrl(data.playback.url)}
                  title={lecture.title}
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              )}
            </div>
          ) : (
            <video
              ref={videoRef}
              src={data.playback.url}
              controls
              playsInline
              controlsList="nodownload"
              onTimeUpdate={onTimeUpdate}
              className={`w-full bg-media ${frameClass}`}
            />
          )
        ) : (
          <div className={`flex w-full items-center justify-center text-sm text-muted-foreground ${frameClass}`}>
            Video is not attached to this lecture yet.
          </div>
        )}
      </div>

      <section className="mt-5">
        <h1 className="font-display text-xl font-semibold tracking-tight">{lecture.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDuration(lecture.duration_seconds)}
          {lecture.levels?.name ? ` · ${lecture.levels.name}` : ""}
        </p>
        {lecture.description ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {lecture.description}
          </p>
        ) : null}
      </section>

      {data.resources.length > 0 ? (
        <section className="mt-7">
          <SectionTitle>Video resources</SectionTitle>
          <ResourceList resources={data.resources as any} />
        </section>
      ) : null}

    </MemberShell>
  );
}

function toEmbedUrl(url: string): string {
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  return url;
}
