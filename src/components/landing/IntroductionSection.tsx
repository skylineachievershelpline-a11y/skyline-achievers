import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Play, Smartphone, Wifi } from "lucide-react";

import { SessionVideo } from "@/components/media/SessionVideo";
import { getLandingIntroduction } from "@/lib/landing.functions";

export function IntroductionSection() {
  const loadIntroduction = useServerFn(getLandingIntroduction);
  const { data, isPending } = useQuery({
    queryKey: ["landing-introduction"],
    queryFn: () => loadIntroduction(),
    retry: false,
  });

  const introduction = data?.introduction;

  return (
    <section id="introduction" className="border-b border-hairline bg-surface px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-glow">
              Start here
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              {introduction?.title ?? "Meet Skyline Achievers"}
            </h2>
            <p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">
              {introduction?.description ??
                "Watch this introduction to understand what Skyline Achievers is, how our learning journey works, and the first step you can take using only your phone and internet."}
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="border-l-2 border-brand pl-4">
                <Smartphone className="h-4 w-4 text-brand-glow" />
                <p className="mt-2 text-sm font-semibold">Learn on mobile</p>
              </div>
              <div className="border-l-2 border-brand pl-4">
                <Wifi className="h-4 w-4 text-brand-glow" />
                <p className="mt-2 text-sm font-semibold">Start online</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-3 rounded-2xl border border-brand/20" aria-hidden />
            {isPending ? (
              <div className="flex aspect-video items-center justify-center rounded-2xl border border-hairline bg-background">
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
              </div>
            ) : introduction?.videoUrl ? (
              <SessionVideo
                title={introduction.title}
                videoUrl={introduction.videoUrl}
                aspectRatio={introduction.aspectRatio}
                poster={introduction.thumbnailUrl}
              />
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-hairline bg-background px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-brand/30 bg-brand/10 text-brand-glow">
                  <Play className="ml-0.5 h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-semibold">Introduction video coming soon</p>
                <p className="mt-1 text-xs text-muted-foreground">Our story will be available here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}