import { SkylineLoader } from "@/components/brand/SkylineLoader";
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
    <section id="introduction" className="section-flow infographic-grid border-b border-hairline bg-surface px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="cinematic-card raised-panel grid items-center gap-10 rounded-3xl p-5 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14 lg:p-10">
          <div className="relative">
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
            <div className="relative mt-8 grid grid-cols-2 gap-4">
              <div className="connector-line absolute left-[25%] right-[25%] top-6 h-px" aria-hidden />
              <div className="inset-panel relative rounded-xl p-4">
                <Smartphone className="h-4 w-4 text-cyan" />
                <p className="mt-2 text-sm font-semibold">Learn on mobile</p>
              </div>
              <div className="inset-panel relative rounded-xl p-4">
                <Wifi className="h-4 w-4 text-cyan" />
                <p className="mt-2 text-sm font-semibold">Start online</p>
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl border border-metal/30 bg-background p-2 shadow-lift">
            <div className="pointer-events-none absolute -bottom-3 left-8 right-8 h-5 rounded-b-xl border-x border-b border-brand/25 bg-surface-2 shadow-glass" aria-hidden />
            {isPending ? (
              <div className="flex aspect-video items-center justify-center rounded-2xl border border-hairline bg-background">
                <SkylineLoader />
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