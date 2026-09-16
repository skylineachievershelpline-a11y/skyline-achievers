import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { SessionVideo } from "@/components/media/SessionVideo";
import { Button } from "@/components/ui/button";
import { openBeginnerSession } from "@/lib/sessions.functions";

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
  const extras = data?.status === "ok" ? (data.extras ?? []) : [];

  return (
    <main className="infographic-grid relative min-h-screen px-4 pb-16 pt-6 sm:px-8">
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
          <div className="raised-panel rounded-3xl p-8 text-center animate-rise-in">
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
            <div className="raised-panel overflow-hidden rounded-3xl p-3 sm:p-4">
              <SessionVideo
                title={session.title}
                videoUrl={session.videoUrl}
                aspectRatio={session.aspectRatio}
                poster={session.thumbnailUrl}
              />
            </div>

            <section className="glass-panel metal-edge rounded-3xl p-6">
              <span className="connector-line absolute inset-x-0 top-0 h-1" aria-hidden />
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

            {extras.length > 0 ? (
              <section className="space-y-4">
                <h3 className="font-display text-base font-semibold tracking-tight">
                  More with this session
                </h3>
                {extras.map((extra) => (
                  <article key={extra.id} className="raised-panel rounded-3xl p-3 sm:p-4">
                    <SessionVideo
                      title={extra.title}
                      videoUrl={extra.videoUrl}
                      aspectRatio={extra.aspectRatio}
                      poster={extra.thumbnailUrl}
                    />
                    <div className="px-2 pb-1 pt-3">
                      <p className="text-sm font-semibold">{extra.title}</p>
                      {extra.description ? (
                        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                          {extra.description}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
