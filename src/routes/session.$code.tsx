import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { ReviewShareNotice } from "@/components/journey/ReviewShareNotice";
import { SessionReviewForm } from "@/components/journey/SessionReviewForm";
import { SessionGate } from "@/components/media/SessionGate";
import { SessionVideo } from "@/components/media/SessionVideo";
import { Button } from "@/components/ui/button";
import { getTraineeJourney } from "@/lib/journey.functions";
import { type JourneySession } from "@/lib/journey";
import { getBeginnerSessionPreview, openBeginnerSession } from "@/lib/sessions.functions";


export const Route = createFileRoute("/session/$code")({
  loader: ({ params }) =>
    getBeginnerSessionPreview({ data: { code: params.code } }).catch(() => ({ session: null })),
  head: ({ loaderData }) => {
    const session = loaderData?.session;
    const title = session
      ? `${session.title} — Skyline Achievers`
      : "Beginners Training Session — Skyline Achievers";
    const description =
      session?.description ?? "Watch this Skyline Achievers Beginners Training session.";
    return {
      meta: [
      { title },
      {
        name: "description",
        content: description,
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(session?.thumbnailUrl
        ? [
            { property: "og:image", content: session.thumbnailUrl },
            { name: "twitter:image", content: session.thumbnailUrl },
          ]
        : []),
      ],
    };
  },
  component: SessionPage,
});

function SessionPage() {
  const { code } = Route.useParams();
  const open = useServerFn(openBeginnerSession);
  const loadJourney = useServerFn(getTraineeJourney);
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: ["beginner-session", code],
    queryFn: () => open({ data: { code } }),
    retry: false,
  });

  // Signed-in trainees can send their review from here with no time limit.
  const { data: journeyData } = useQuery({
    queryKey: ["trainee-journey"],
    queryFn: () => loadJourney(),
    retry: false,
  });

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <SkylineLoader variant="page" />
      </div>
    );
  }

  const session = data?.status === "ok" ? data.session : null;
  const extras = data?.status === "ok" ? (data.extras ?? []) : [];
  const journeySession = session
    ? ((journeyData?.sessions ?? []) as JourneySession[]).find(
        (item) => item.sessionId === session.id,
      ) ?? null
    : null;


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
            <SessionGate
              key={session.id}
              extras={extras}
              sections={data?.status === "ok" ? (data.sections ?? []) : []}
            >
              <SessionVideo
                title={session.title}
                videoUrl={session.videoUrl}
                aspectRatio={session.aspectRatio}
                poster={session.thumbnailUrl}
                frameClassName="rounded-3xl border border-hairline"
              />

              <section className="glass-panel metal-edge mt-5 rounded-3xl p-6">
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

              <ReviewShareNotice
                sessionTitle={session.title}
                sessionCode={session.code}
                className="mt-5"
              />

              {journeySession && journeySession.review === "pending" ? (
                <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-center text-sm font-semibold text-amber-300">
                  Review submitted — waiting for your upline
                </div>
              ) : journeySession && journeySession.review === "approved" ? (
                <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center text-sm font-semibold text-emerald-300">
                  Review approved
                </div>
              ) : journeySession ? (
                /* Code-joined session: no schedule window, submit any time. */
                <SessionReviewForm
                  sessionNumber={journeySession.sessionNumber}
                  anyTime
                  onSent={() => {
                    void queryClient.invalidateQueries({ queryKey: ["trainee-journey"] });
                  }}
                />
              ) : null}
            </SessionGate>

          </div>
        )}
      </div>
    </main>
  );
}
