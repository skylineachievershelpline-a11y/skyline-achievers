import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, Lock, LogOut, PlayCircle, Unlock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { DailyInspiration } from "@/components/member/DailyInspiration";
import { SessionVideo } from "@/components/media/SessionVideo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import {
  getTraineeDashboard,
  playTraineeSession,
  unlockTraineeSession,
} from "@/lib/trainee.functions";

export const Route = createFileRoute("/beginners")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Beginners Training — Skyline Achievers" },
      {
        name: "description",
        content:
          "Your Beginners Training dashboard: unlock each session with the code your trainer shares and learn step by step.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Beginners Training — Skyline Achievers" },
      {
        property: "og:description",
        content: "Unlock training sessions with your session code and follow your learning journey.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BeginnersPage,
});

function BeginnersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const load = useServerFn(getTraineeDashboard);
  const unlock = useServerFn(unlockTraineeSession);
  const play = useServerFn(playTraineeSession);

  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [playing, setPlaying] = useState<
    { title: string; aspectRatio: string; videoUrl: string | null } | null
  >(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) void navigate({ to: "/" });
      else setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) void navigate({ to: "/" });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const { data, isPending } = useQuery({
    queryKey: ["trainee-dashboard"],
    queryFn: () => load(),
    enabled: ready,
    retry: false,
  });

  const submitCode = useMutation({
    mutationFn: () => unlock({ data: { code } } as never),
    onSuccess: (result: any) => {
      if (result.status === "invalid") {
        toast.error("This session code is not valid.");
        return;
      }
      if (result.status === "blocked") {
        toast.error("Your account is not active. Please contact your trainer.");
        return;
      }
      setCode("");
      toast.success("Session unlocked");
      void queryClient.invalidateQueries({ queryKey: ["trainee-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openSession = useMutation({
    mutationFn: (sessionId: string) => play({ data: { sessionId } } as never),
    onSuccess: (result: any) => {
      if (result.status !== "ok") {
        toast.error("Enter the session code to unlock this session first.");
        return;
      }
      setPlaying(result.session);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/" });
  }

  if (!ready || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  if (!data?.trainee || data.blocked) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-panel-strong max-w-md rounded-3xl p-8 text-center">
          <BrandLogo size="sm" />
          <p className="mt-4 font-display text-lg font-semibold">Access paused</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your training access is currently not active. Please contact the person who registered
            you.
          </p>
          <Button variant="outline" size="xl" className="mt-6" onClick={() => void signOut()}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </main>
    );
  }

  const trainee = data.trainee;
  const sessions = data.sessions;
  const unlockedCount = sessions.filter((session) => session.unlocked).length;

  return (
    <div className="relative min-h-screen pb-14">
      <div className="spotlight pointer-events-none fixed inset-0" aria-hidden />

      <header className="sticky top-0 z-30 border-b border-hairline/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <BrandLogo size="sm" withWordmark={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold">Beginners Training</p>
            <p className="truncate text-[11px] text-muted-foreground">{BRAND.tagline}</p>
          </div>
          <button
            onClick={() => void signOut()}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-glass text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-4xl px-4 py-5">
        {/* ---------- profile ---------- */}
        <section className="glass-panel-strong rounded-[28px] p-6 animate-rise-in">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/20 font-display text-xl font-semibold text-brand-glow">
              {trainee.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-semibold tracking-tight">
                {trainee.fullName}
              </h1>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {trainee.traineeCode} · joined {formatDate(trainee.createdAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-hairline bg-glass px-4 py-2 text-center">
              <p className="font-display text-lg font-semibold tabular-nums">
                {unlockedCount}/{sessions.length}
              </p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Unlocked
              </p>
            </div>
          </div>
          {trainee.upline ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Your trainer: {trainee.upline.fullName} ({trainee.upline.memberId})
            </p>
          ) : null}
        </section>

        <div className="mt-6">
          <DailyInspiration />
        </div>

        {/* ---------- unlock ---------- */}
        <section className="glass-panel mt-6 rounded-[28px] p-6 animate-rise-in">
          <h2 className="font-display text-lg font-semibold tracking-tight">Unlock a session</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your trainer shares a code for each session. Enter it here to open that session.
          </p>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              submitCode.mutate();
            }}
          >
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="SKL-0001"
              autoCapitalize="characters"
              className="h-12 rounded-xl bg-background/35 text-base tracking-widest"
            />
            <Button type="submit" variant="brand" size="xl" disabled={submitCode.isPending}>
              {submitCode.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
              Unlock
            </Button>
          </form>
        </section>

        {/* ---------- sessions ---------- */}
        <section className="mt-6">
          <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">All sessions</h2>
          {sessions.length === 0 ? (
            <div className="glass-panel rounded-3xl px-5 py-10 text-center">
              <p className="font-display text-sm font-semibold">No sessions published yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Please check back soon.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {sessions.map((session) => (
                <article
                  key={session.id}
                  className="glass-panel overflow-hidden rounded-3xl animate-rise-in"
                >
                  <div className="relative aspect-video bg-glass-strong">
                    {session.thumbnailUrl ? (
                      <img
                        src={session.thumbnailUrl}
                        alt={`${session.title} cover`}
                        loading="lazy"
                        className={`h-full w-full object-cover ${session.unlocked ? "" : "blur-[3px] brightness-50"}`}
                      />
                    ) : null}
                    <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-hairline bg-background/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] backdrop-blur">
                      {session.unlocked ? (
                        <>
                          <Unlock className="h-3 w-3 text-brand-glow" /> Unlocked
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3" /> Locked
                        </>
                      )}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-base font-semibold">{session.title}</h3>
                    {session.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {session.description}
                      </p>
                    ) : null}
                    <Button
                      variant={session.unlocked ? "brand" : "outline"}
                      className="mt-4 w-full rounded-2xl"
                      disabled={!session.unlocked || openSession.isPending}
                      onClick={() => openSession.mutate(session.id)}
                    >
                      {session.unlocked ? <PlayCircle /> : <Lock className="h-4 w-4" />}
                      {session.unlocked ? "Watch session" : "Enter code to unlock"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ---------- player ---------- */}
      {playing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur">
          <div className="w-full max-w-3xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate font-display text-base font-semibold">{playing.title}</p>
              <button
                onClick={() => setPlaying(null)}
                aria-label="Close player"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-glass text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SessionVideo
              title={playing.title}
              videoUrl={playing.videoUrl}
              aspectRatio={playing.aspectRatio}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
