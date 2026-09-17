import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  MessageCircle,
  PlayCircle,
  Unlock,
  Camera,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { DailyInspiration } from "@/components/member/DailyInspiration";
import { SessionExtraCard } from "@/components/media/SessionExtraCard";
import { SessionVideo } from "@/components/media/SessionVideo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import {
  getTraineeAvatarUploadUrl,
  getTraineeDashboard,
  playTraineeSession,
  saveTraineeAvatar,
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
          "Your Beginners Training dashboard: unlock each session with the code your trainer shares and follow your progress step by step.",
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

type FocusedSession = {
  id: string;
  title: string;
  description: string | null;
  aspectRatio: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  extras: {
    id: string;
    title: string;
    description: string | null;
    kind?: string | null;
    aspectRatio: string;
    url?: string | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
  }[];
};

function ProgressRing({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative h-[118px] w-[118px] shrink-0">
      <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
        <circle
          cx="55"
          cy="55"
          r={radius}
          className="fill-none stroke-hairline"
          strokeWidth="9"
        />
        <circle
          cx="55"
          cy="55"
          r={radius}
          className="fill-none stroke-brand transition-[stroke-dashoffset] duration-700 ease-out"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold tabular-nums">{percent}%</span>
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {done}/{total} done
        </span>
      </div>
    </div>
  );
}

function BeginnersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const load = useServerFn(getTraineeDashboard);
  const unlock = useServerFn(unlockTraineeSession);
  const play = useServerFn(playTraineeSession);
  const avatarSlot = useServerFn(getTraineeAvatarUploadUrl);
  const saveAvatarPath = useServerFn(saveTraineeAvatar);

  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState<FocusedSession | null>(null);

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

  const openSession = useMutation({
    mutationFn: (sessionId: string) => play({ data: { sessionId } } as never),
    onSuccess: (result: any) => {
      if (result.status !== "ok") {
        toast.error("Enter the session code to open this session first.");
        return;
      }
      setFocused({ ...result.session, extras: result.extras ?? [] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error: Error) => toast.error(error.message),
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
      openSession.mutate(result.sessionId);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const allowed = ["png", "jpg", "jpeg", "webp"];
      if (!allowed.includes(extension)) throw new Error("Use a PNG, JPG or WEBP picture.");
      const slot: any = await avatarSlot({ data: { extension } } as never);
      const response = await fetch(slot.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "image/jpeg" },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed. Please try again.");
      await saveAvatarPath({ data: { path: slot.path } } as never);
    },
    onSuccess: () => {
      toast.success("Profile picture updated");
      void queryClient.invalidateQueries({ queryKey: ["trainee-dashboard"] });
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
        <div className="raised-panel max-w-md rounded-3xl p-8 text-center">
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

  const trainee = data.trainee as any;
  const sessions = data.sessions;
  const unlockedCount = sessions.filter((session) => session.unlocked).length;

  return (
    <div className="infographic-grid relative min-h-screen pb-14">
      <div className="spotlight pointer-events-none fixed inset-0" aria-hidden />

      <header className="sticky top-0 z-30 border-b border-hairline/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <BrandLogo size="sm" withWordmark={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold">Beginners Training</p>
            <p className="truncate text-[11px] text-muted-foreground">{BRAND.tagline}</p>
          </div>
          <Link
            to="/chat"
            aria-label="Chat with your trainer"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-metal/30 bg-surface-2 text-muted-foreground transition-colors hover:text-brand"
          >
            <MessageCircle className="h-4 w-4" />
          </Link>
          <button
            onClick={() => void signOut()}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-metal/30 bg-surface-2 text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-4xl px-4 py-5">
        {/* ---------- profile + tracking ---------- */}
        <section className="raised-panel relative overflow-hidden rounded-[30px] p-6 animate-rise-in">
          <span className="connector-line absolute inset-x-0 top-0 h-1" aria-hidden />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <div className="metal-edge flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-primary/20 font-display text-2xl font-semibold text-brand-glow shadow-lift">
                  {trainee.avatarUrl ? (
                    <img
                      src={trainee.avatarUrl}
                      alt={`${trainee.fullName} profile picture`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    trainee.fullName.charAt(0).toUpperCase()
                  )}
                </div>
                <label
                  className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-cyan/30 bg-primary text-primary-foreground shadow-brand"
                  title="Change profile picture"
                >
                  {uploadAvatar.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  <span className="sr-only">Change profile picture</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadAvatar.isPending}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) uploadAvatar.mutate(file);
                    }}
                  />
                </label>
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-display text-xl font-semibold tracking-tight">
                  {trainee.fullName}
                </h1>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {trainee.traineeCode} · joined {formatDate(trainee.createdAt)}
                </p>
                {trainee.upline ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Trainer: {trainee.upline.fullName} ({trainee.upline.memberId})
                  </p>
                ) : null}
              </div>
            </div>
            <ProgressRing done={unlockedCount} total={sessions.length} />
          </div>

          {/* step track */}
          <div className="inset-panel mt-6 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Training track
            </p>
            <ol className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              {sessions.map((session, index) => (
                <li key={session.id} className="flex shrink-0 items-center gap-2">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors ${
                      session.unlocked
                        ? "border-cyan/40 bg-primary text-primary-foreground shadow-brand"
                        : "border-metal/30 bg-surface-2 text-muted-foreground"
                    }`}
                    title={session.title}
                  >
                    {session.unlocked ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </span>
                  {index < sessions.length - 1 ? (
                    <span className="h-[2px] w-6 rounded-full bg-hairline" aria-hidden />
                  ) : null}
                </li>
              ))}
              {sessions.length === 0 ? (
                <li className="text-xs text-muted-foreground">No sessions published yet.</li>
              ) : null}
            </ol>
          </div>
        </section>

        {/* ---------- focused session ---------- */}
        {focused ? (
          <section className="raised-panel relative mt-6 overflow-hidden rounded-[30px] p-4 animate-scale-in sm:p-6">
            <span className="connector-line absolute inset-x-0 top-0 h-1" aria-hidden />
            <div className="mb-4 flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="rounded-2xl"
                aria-label="Back to all sessions"
                onClick={() => setFocused(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Now studying
                </p>
                <h2 className="truncate font-display text-lg font-semibold tracking-tight">
                  {focused.title}
                </h2>
              </div>
            </div>

            <SessionVideo
              title={focused.title}
              videoUrl={focused.videoUrl}
              aspectRatio={focused.aspectRatio}
              poster={focused.thumbnailUrl}
            />

            {focused.description ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {focused.description}
              </p>
            ) : null}

            {focused.extras.length > 0 ? (
              <div className="mt-6 space-y-4">
                <h3 className="font-display text-base font-semibold tracking-tight">
                  More with this session
                </h3>
                {focused.extras.map((extra) => (
                  <div key={extra.id} className="animate-rise-in">
                    <SessionExtraCard extra={extra} />
                  </div>
                ))}
              </div>
            ) : null}

            <Button
              variant="outline"
              size="xl"
              className="mt-6 w-full rounded-2xl"
              onClick={() => setFocused(null)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to all sessions
            </Button>
          </section>
        ) : (
          <>
            {/* ---------- chat with upline ---------- */}
            <section className="raised-panel metal-edge mt-6 rounded-[28px] p-2 animate-rise-in">
              <Link
                to="/chat"
                className="flex items-center gap-4 rounded-[24px] p-4 transition-colors hover:bg-surface-2/60"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan/30 bg-primary/15 text-brand-glow shadow-brand">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base font-semibold tracking-tight">
                    {trainee.upline
                      ? `Chat with ${trainee.upline.fullName}`
                      : "Chat with your Upline"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Message, picture ya file — apne upline se seedha baat karein.
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            </section>

            <div className="mt-6">
              <DailyInspiration />
            </div>

            {/* ---------- unlock ---------- */}
            <section className="glass-panel metal-edge mt-6 rounded-[28px] p-6 animate-rise-in">
              <h2 className="font-display text-lg font-semibold tracking-tight">Open a session</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Your trainer shares a code for each session. Enter it here and that session opens on
                its own.
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
                  className="h-12 rounded-xl text-base tracking-widest"
                />
                <Button type="submit" variant="brand" size="xl" disabled={submitCode.isPending}>
                  {submitCode.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
                  Open
                </Button>
              </form>
            </section>

            {/* ---------- sessions ---------- */}
            <section className="mt-6">
              <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">
                All sessions
              </h2>
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
                      className="glass-panel metal-edge depth-hover overflow-hidden rounded-3xl animate-rise-in"
                    >
                      <div className="relative aspect-video bg-media">
                        {session.thumbnailUrl ? (
                          <img
                            src={session.thumbnailUrl}
                            alt={`${session.title} cover`}
                            loading="lazy"
                            className={`h-full w-full object-cover ${
                              session.unlocked ? "" : "blur-[3px] brightness-50"
                            }`}
                          />
                        ) : null}
                        <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-metal/30 bg-background/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] backdrop-blur">
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
                          {session.unlocked ? "Open session" : "Enter code to unlock"}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
