import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  GraduationCap,
  Home,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  PlayCircle,
  Search,
  ShieldCheck,
  Unlock,
  Camera,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { StoryLogo } from "@/components/story/StoryLogo";
import { SessionGate } from "@/components/media/SessionGate";
import { ReelVideo } from "@/components/media/ReelVideo";
import { SessionVideo } from "@/components/media/SessionVideo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { BRAND, memberIdToAuthEmail } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import { RELATED_THRESHOLD, relevance, tokenize } from "@/lib/search-match";
import { cn } from "@/lib/utils";
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

type BeginnerView = "home" | "training" | "reels" | "search" | "password";

const BEGINNER_NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "training", label: "Training", icon: GraduationCap },
  { id: "reels", label: "Reels", icon: Clapperboard },
  { id: "search", label: "Search", icon: Search },
  { id: "password", label: "Change password", icon: ShieldCheck },
] as const;

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
  const [view, setView] = useState<BeginnerView>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reelsMuted, setReelsMuted] = useState(true);

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
        <SkylineLoader variant="page" />
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
          <button type="button" className="logout-button mt-6 w-full" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </main>
    );
  }

  const trainee = data.trainee as any;
  const sessions = data.sessions;
  const reels = data.reels ?? [];
  const unlockedCount = sessions.filter((session) => session.unlocked).length;
  const progress = sessions.length > 0 ? Math.round((unlockedCount / sessions.length) * 100) : 0;
  const searchTokens = tokenize(searchQuery);
  const searchResults = searchTokens.length < 1
    ? []
    : [
        ...sessions.map((item) => ({
          kind: "session" as const,
          item,
          score: relevance(searchTokens, {
            fields: [
              { text: item.title, weight: 1 },
              { text: item.description, weight: 0.8 },
            ],
          }),
        })),
        ...reels.map((item: any) => ({
          kind: "reel" as const,
          item,
          score: relevance(searchTokens, {
            fields: [
              { text: item.title, weight: 1 },
              { text: item.caption, weight: 0.8 },
            ],
          }),
        })),
      ]
        .filter((result) => result.score >= RELATED_THRESHOLD)
        .sort((a, b) => b.score - a.score);

  function selectView(next: BeginnerView) {
    setFocused(null);
    setView(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="infographic-grid relative min-h-screen pb-14">
      <div className="spotlight pointer-events-none fixed inset-0" aria-hidden />

      <header className="sticky top-0 z-30 border-b border-hairline/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="shrink-0 rounded-xl"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <StoryLogo size={34} />
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
            type="button"
            onClick={() => void signOut()}
            className="logout-button shrink-0 px-3 py-2 text-xs"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-40 transition-opacity duration-300",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        />
        <aside
          className={cn(
            "glass-panel-strong metal-edge absolute inset-y-0 left-0 flex w-[84vw] max-w-xs flex-col rounded-r-3xl p-5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            menuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <BrandLogo size="sm" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-5 rounded-2xl border border-cyan/20 bg-primary/10 p-3">
            <p className="truncate font-display text-sm font-semibold">{trainee.fullName}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Beginners Training
            </p>
          </div>
          <nav className="mt-5 flex-1 space-y-1.5 overflow-y-auto">
            {BEGINNER_NAV.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                onClick={() => selectView(item.id)}
                className={cn(
                  "h-11 w-full justify-start rounded-xl px-3 text-muted-foreground",
                  view === item.id && "border border-cyan/30 bg-primary/15 text-foreground shadow-glass",
                )}
              >
                <item.icon className="h-4 w-4 text-brand-glow" />
                {item.label}
              </Button>
            ))}
            <Button asChild variant="ghost" className="h-11 w-full justify-start rounded-xl px-3 text-muted-foreground">
              <Link to="/chat">
                <MessageCircle className="h-4 w-4 text-brand-glow" />
                Chat with Upline
              </Link>
            </Button>
          </nav>
          <button type="button" onClick={() => void signOut()} className="logout-button mt-4 w-full">
            <LogOut className="h-4 w-4" /> Logout
          </button>
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {BRAND.tagline}
          </p>
        </aside>
      </div>

      <main className="relative mx-auto max-w-4xl px-4 py-5">
        {/* ---------- profile + tracking ---------- */}
        {view === "home" ? (
          <>
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

        <section className="mt-5 grid grid-cols-2 gap-3 animate-rise-in sm:grid-cols-3">
          <div className="glass-panel metal-edge rounded-2xl p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-brand-glow">
              <Unlock className="h-4 w-4" />
            </span>
            <p className="mt-4 font-display text-2xl font-semibold tabular-nums">{unlockedCount}</p>
            <p className="text-[11px] text-muted-foreground">Sessions unlocked</p>
          </div>
          <div className="glass-panel metal-edge rounded-2xl p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-brand-glow">
              <Lock className="h-4 w-4" />
            </span>
            <p className="mt-4 font-display text-2xl font-semibold tabular-nums">
              {Math.max(sessions.length - unlockedCount, 0)}
            </p>
            <p className="text-[11px] text-muted-foreground">Sessions remaining</p>
          </div>
          <div className="glass-panel metal-edge col-span-2 rounded-2xl p-4 sm:col-span-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-brand-glow">
              <GraduationCap className="h-4 w-4" />
            </span>
            <p className="mt-4 font-display text-2xl font-semibold tabular-nums">{progress}%</p>
            <p className="text-[11px] text-muted-foreground">Training progress</p>
          </div>
        </section>

        <section className="raised-panel metal-edge mt-5 overflow-hidden rounded-[28px] p-5 animate-rise-in">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Journey map</p>
              <h2 className="mt-1 font-display text-lg font-semibold">Your learning momentum</h2>
            </div>
            <span className="font-display text-2xl font-semibold text-brand-glow">{progress}%</span>
          </div>
          <div className="mt-5 flex h-28 items-end gap-2" aria-label={`${progress}% training progress`}>
            {[18, 30, 42, 56, 68, 82, 100].map((height, index) => {
              const active = progress >= Math.round(((index + 1) / 7) * 100);
              return (
                <span
                  key={height}
                  className={cn(
                    "flex-1 rounded-t-xl border border-metal/20 transition-all duration-700",
                    active ? "bg-primary shadow-brand" : "bg-surface-2",
                  )}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        </section>
          </>
        ) : null}

        {/* ---------- focused session ---------- */}
        {view === "training" && focused ? (
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

            <SessionGate key={focused.id} extras={focused.extras}>
              <SessionVideo
                title={focused.title}
                videoUrl={focused.videoUrl}
                aspectRatio={focused.aspectRatio}
                poster={focused.thumbnailUrl}
                frameClassName="rounded-3xl border border-hairline"
              />

              {focused.description ? (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {focused.description}
                </p>
              ) : null}
            </SessionGate>

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
        ) : view === "training" ? (
          <>
            {/* ---------- unlock ---------- */}
            <section className="glass-panel metal-edge rounded-[28px] p-6 animate-rise-in">
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
        ) : null}

        {view === "reels" ? (
          <section className="animate-rise-in">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Skyline feed</p>
                <h1 className="font-display text-2xl font-semibold">Reels</h1>
              </div>
            </div>
            {reels.length === 0 ? (
              <div className="glass-panel rounded-3xl px-5 py-10 text-center text-sm text-muted-foreground">
                No reels published yet.
              </div>
            ) : (
              <div className="no-scrollbar mx-auto h-[calc(100dvh-11rem)] max-w-md snap-y snap-mandatory space-y-4 scroll-smooth overflow-y-auto overscroll-contain rounded-3xl [-webkit-overflow-scrolling:touch]">
                {reels.map((reel: any) => (
                  <article key={reel.id} className="metal-edge relative snap-start snap-always overflow-hidden rounded-3xl bg-media shadow-lift transition-all duration-500 ease-out">
                    {reel.url ? (
                      <ReelVideo src={reel.url} poster={reel.posterUrl ?? undefined} muted={reelsMuted} />
                    ) : (
                      <div className="flex aspect-[9/16] items-center justify-center text-sm text-muted-foreground">Video unavailable</div>
                    )}
                    <button
                      type="button"
                      onClick={() => setReelsMuted((value) => !value)}
                      aria-label={reelsMuted ? "Turn sound on" : "Turn sound off"}
                      className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-hairline bg-background/70 px-3 py-1.5 text-[11px] text-foreground backdrop-blur transition-all duration-300 hover:bg-background/90 active:scale-95"
                    >
                      {reelsMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                      {reelsMuted ? "Sound off" : "Sound on"}
                    </button>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-4 pt-14">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-brand-glow">Skyline Achievers</p>
                      <h2 className="mt-1 font-display text-base font-semibold">{reel.title}</h2>
                      {reel.caption ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{reel.caption}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}

          </section>
        ) : null}

        {view === "search" ? (
          <section className="animate-rise-in">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Smart discovery</p>
            <h1 className="font-display text-2xl font-semibold">Search training</h1>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search sessions or related topics" className="h-12 rounded-2xl pl-11" />
            </div>
            <div className="mt-5 space-y-3">
              {searchQuery.trim() && searchResults.length === 0 ? (
                <div className="glass-panel rounded-3xl px-5 py-10 text-center text-sm text-muted-foreground">No related training found.</div>
              ) : null}
              {searchResults.map((result) => (
                <button
                  key={`${result.kind}-${result.item.id}`}
                  type="button"
                  disabled={result.kind === "session" && !result.item.unlocked}
                  onClick={() => {
                    if (result.kind === "session") {
                      setView("training");
                      openSession.mutate(result.item.id);
                    } else {
                      setView("reels");
                    }
                  }}
                  className="glass-panel metal-edge flex w-full items-center gap-3 rounded-2xl p-3 text-left disabled:opacity-55"
                >
                  <span className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-media">
                    {result.item.thumbnailUrl || result.item.posterUrl ? <img src={result.item.thumbnailUrl ?? result.item.posterUrl ?? undefined} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{result.item.title}</span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{result.kind === "session" ? (result.item.unlocked ? "Session · unlocked" : "Session · locked") : "Reel"}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {view === "password" ? <TraineePasswordCard traineeCode={trainee.traineeCode} /> : null}
      </main>
    </div>
  );
}

/** Lets the trainee replace the starting code (00000000) with their own password. */
function TraineePasswordCard({ traineeCode }: { traineeCode: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: memberIdToAuthEmail(traineeCode),
        password: current,
      });
      if (signInError) {
        toast.error("Your current password is incorrect.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        toast.error(error.message);
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password updated. Use it the next time you sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="raised-panel metal-edge mt-6 rounded-[28px] p-6 animate-rise-in">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
        <ShieldCheck className="h-4 w-4 text-brand-glow" /> Change password
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Your account starts with the code 00000000. Choose your own password — at least 8 characters.
      </p>
      <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          className="h-12 rounded-xl"
          required
        />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          className="h-12 rounded-xl"
          required
        />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className="h-12 rounded-xl"
          required
        />
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          Update password
        </Button>
      </form>
    </section>
  );
}
