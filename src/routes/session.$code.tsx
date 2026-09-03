import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { openBeginnerSession } from "@/lib/sessions.functions";

const RATIO_CLASS: Record<string, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16] mx-auto max-h-[78vh] w-auto",
  "1:1": "aspect-square mx-auto max-h-[78vh]",
  "4:3": "aspect-[4/3]",
};

export const Route = createFileRoute("/session/$code")({
  head: () => ({
    meta: [
      { title: "Beginners Training Session — Skyline Achievers" },
      {
        name: "description",
        content:
          "Open your Skyline Achievers beginners training session with the code issued by your trainer.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Beginners Training Session — Skyline Achievers" },
      {
        property: "og:description",
        content: "Code-based beginners training session for new Skyline Achievers trainees.",
      },
    ],
  }),
  component: SessionPage,
});

function SessionPage() {
  const { code } = Route.useParams();
  const open = useServerFn(openBeginnerSession);

  const { data, isPending, isError } = useQuery({
    queryKey: ["beginner-session", code],
    queryFn: () => open({ data: { code } }),
    retry: false,
  });

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  const session = data?.status === "ok" ? data.session : null;

  return (
    <main className="relative min-h-screen px-4 pb-16 pt-6 sm:px-8">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center gap-3 animate-rise-in">
          <Link to="/" aria-label="Back to landing page">
            <Button variant="outline" size="icon" className="rounded-2xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <BrandLogo size="sm" withWordmark={false} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Beginners Training
            </p>
            <h1 className="font-display text-lg font-semibold tracking-tight">
              {session ? session.title : "Session"}
            </h1>
          </div>
        </header>

        {!session || isError ? (
          <div className="glass-panel-strong rounded-3xl p-8 text-center animate-rise-in">
            <p className="font-display text-lg font-semibold">This session code is not valid</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Codes only open their own training session. Please check the code your trainer gave
              you and try again.
            </p>
            <Link to="/" className="mt-6 inline-block">
              <Button variant="brand" size="xl">
                Back to sign in
              </Button>
            </Link>
          </div>
        ) : (
          <div className="animate-rise-in space-y-5">
            <div className="glass-panel-strong overflow-hidden rounded-3xl p-3 sm:p-4">
              <div
                className={`overflow-hidden rounded-2xl bg-black ${
                  RATIO_CLASS[session.aspectRatio] ?? "aspect-video"
                }`}
              >
                {session.videoUrl ? (
                  <video
                    src={session.videoUrl}
                    poster={session.thumbnailUrl ?? undefined}
                    controls
                    playsInline
                    controlsList="nodownload"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Video unavailable
                  </div>
                )}
              </div>
            </div>

            <section className="glass-panel rounded-3xl p-6">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Session code · {session.code}
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">
                {session.title}
              </h2>
              {session.description ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {session.description}
                </p>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
