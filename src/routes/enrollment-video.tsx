import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { SessionVideo } from "@/components/media/SessionVideo";
import { Button } from "@/components/ui/button";
import { getLandingIntroduction } from "@/lib/landing.functions";

export const Route = createFileRoute("/enrollment-video")({
  loader: () => getLandingIntroduction(),
  head: ({ loaderData }) => {
    const video = loaderData?.introduction;
    const title = video?.title
      ? `${video.title} — Skyline Achievers`
      : "Enrollment Video — Skyline Achievers";
    const description =
      video?.description ?? "Watch the Skyline Achievers enrollment and working overview video.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(video?.thumbnailUrl
          ? [
              { property: "og:image", content: video.thumbnailUrl },
              { name: "twitter:image", content: video.thumbnailUrl },
            ]
          : []),
      ],
    };
  },
  component: EnrollmentVideoPage,
});

function EnrollmentVideoPage() {
  const { introduction } = Route.useLoaderData();

  return (
    <main className="infographic-grid relative min-h-screen px-4 pb-16 pt-6 sm:px-8">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center gap-3 animate-rise-in">
          <Link to="/" aria-label="Back to landing page">
            <Button variant="outline" size="icon" className="rounded-2xl">
              <ArrowLeft />
            </Button>
          </Link>
          <BrandLogo size="sm" withWordmark={false} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Enrollment Video
            </p>
            <h1 className="font-display text-lg font-semibold">
              {introduction?.title ?? "Skyline Achievers"}
            </h1>
          </div>
        </header>

        {introduction?.videoUrl ? (
          <div className="animate-rise-in space-y-5">
            <div className="raised-panel overflow-hidden rounded-3xl p-3 sm:p-4">
              <SessionVideo
                title={introduction.title}
                videoUrl={introduction.videoUrl}
                aspectRatio={introduction.aspectRatio}
                poster={introduction.thumbnailUrl}
              />
            </div>
            <section className="glass-panel metal-edge rounded-3xl p-6">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Working Overview
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold">{introduction.title}</h2>
              {introduction.description ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {introduction.description}
                </p>
              ) : null}
            </section>
          </div>
        ) : (
          <section className="raised-panel rounded-3xl p-8 text-center">
            <h1 className="font-display text-lg font-semibold">Enrollment video is unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please check again later.</p>
          </section>
        )}
      </div>
    </main>
  );
}