import { changeMyPassword } from "@/lib/password.functions";
import { Settings as SettingsIcon } from "lucide-react";
import { AccountSettings } from "@/components/member/AccountSettings";
import { OfficialGroupMenuButton } from "@/components/whatsapp/OfficialGroupDialog";
import { PasskeyManager } from "@/components/security/PasskeyManager";
import { forgetAccount, rememberCurrentAccount } from "@/lib/device-accounts";
import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Bookmark,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Crown,
  Download,
  GraduationCap,
  Heart,
  Home,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  PlayCircle,
  Search,
  Send,
  ShieldCheck,
  Unlock,
  Camera,
  X,
} from "lucide-react";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { FlyingSkylineAiMascot } from "@/components/ai/SkylineAiMascot";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { StoryLogo } from "@/components/story/StoryLogo";
import { SessionGate } from "@/components/media/SessionGate";
import { ReelAuthor } from "@/components/media/ReelAuthor";
import { ReelVideo } from "@/components/media/ReelVideo";
import { SessionVideo } from "@/components/media/SessionVideo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  addReelComment,
  getReelComments,
  toggleReelLike,
  toggleReelSave,
} from "@/lib/reels.functions";
import { BRAND, memberIdToAuthEmail } from "@/lib/brand";
import { fastSignOut } from "@/lib/sign-out";
import { formatDate, formatDateTime12 } from "@/lib/format";
import { TraineeJourney } from "@/components/journey/TraineeJourney";
import { PushAlertsCard } from "@/components/member/PushAlertsCard";
import { PushWelcomeDialog } from "@/components/member/PushWelcomeDialog";
import { ReviewShareNotice } from "@/components/journey/ReviewShareNotice";
import { SessionReviewForm } from "@/components/journey/SessionReviewForm";
import { type JourneySession } from "@/lib/journey";

import { getTraineeJourney } from "@/lib/journey.functions";
import { RELATED_THRESHOLD, relevance, tokenize } from "@/lib/search-match";
import { cn } from "@/lib/utils";
import {
  getTraineeAvatarUploadUrl,
  getTraineeDashboard,
  getTraineeReels,
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
    sectionId?: string | null;
    kind?: string | null;
    aspectRatio: string;
    url?: string | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
  }[];
  sections: { id: string; name: string; thumbnailUrl: string | null }[];
};

type BeginnerView = "home" | "training" | "reels" | "search" | "profile";

type FeedReel = {
  id: string;
  title: string;
  caption: string | null;
  url: string | null;
  posterUrl: string | null;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
  verified?: boolean;
  founder?: boolean;
  authorName?: string;
  authorAvatarUrl?: string | null;
  authorRank?: string | null;
};

function compactCount(value: number): string {
  if (value < 1_000) return String(value);
  if (value < 1_000_000) {
    const count = value / 1_000;
    return `${count >= 10 || Number.isInteger(count) ? count.toFixed(0) : count.toFixed(1)}K`;
  }
  const count = value / 1_000_000;
  return `${count >= 10 || Number.isInteger(count) ? count.toFixed(0) : count.toFixed(1)}M`;
}

function reelDownloadName(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `skyline-achievers-${slug || "reel"}.mp4`;
}

async function downloadReelToGallery(reel: { url?: string | null; title: string }) {
  if (!reel.url) return;
  const loading = toast.loading("Preparing reel for your gallery…");
  try {
    const response = await fetch(reel.url);
    if (!response.ok) throw new Error("download");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reelDownloadName(reel.title);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    toast.success("Reel saved to your gallery", { id: loading });
  } catch {
    toast.error("This reel could not be saved. Please try again.", { id: loading });
  }
}

const BEGINNER_NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "training", label: "Training", icon: GraduationCap },
  { id: "reels", label: "Reels", icon: Clapperboard },
  { id: "search", label: "Search", icon: Search },
  { id: "profile", label: "Profile settings", icon: ShieldCheck },
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
  const loadReels = useServerFn(getTraineeReels);
  const likeReel = useServerFn(toggleReelLike);
  const saveReel = useServerFn(toggleReelSave);
  const unlock = useServerFn(unlockTraineeSession);
  const play = useServerFn(playTraineeSession);
  const avatarSlot = useServerFn(getTraineeAvatarUploadUrl);
  const saveAvatarPath = useServerFn(saveTraineeAvatar);
  const loadJourney = useServerFn(getTraineeJourney);

  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState<FocusedSession | null>(null);
  const [view, setView] = useState<BeginnerView>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [commentsFor, setCommentsFor] = useState<FeedReel | null>(null);
  const [reelLocal, setReelLocal] = useState<Record<string, Partial<FeedReel>>>({});

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) void navigate({ to: "/" });
      else setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && !session) void navigate({ to: "/" });
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

  const { data: reelFeed, isPending: reelsPending } = useQuery({
    queryKey: ["trainee-reels"],
    queryFn: () => loadReels(),
    enabled: ready && view === "reels",
    staleTime: 0,
  });

  const { data: journeyData } = useQuery({
    queryKey: ["trainee-journey"],
    queryFn: () => loadJourney(),
    enabled: ready,
    retry: false,
  });

  const openSession = useMutation({
    mutationFn: (sessionId: string) => play({ data: { sessionId } } as never),
    onSuccess: (result: any) => {
      if (result.status === "locked" && result.opensAt) {
        toast.error(`Ye session ${formatDateTime12(result.opensAt)} (PKT) par khulega.`);
        return;
      }
      if (result.status !== "ok") {
        toast.error("Enter the session code to open this session first.");
        return;
      }
      setFocused({
        ...result.session,
        extras: result.extras ?? [],
        sections: result.sections ?? [],
      });
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

  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const t = (data as any)?.trainee;
    if (t) void rememberCurrentAccount({ name: t.fullName, code: t.code ?? t.traineeCode, kind: "trainee" });
  }, [data]);

  async function signOut() {
    const { data: s } = await supabase.auth.getSession();
    if (s.session) forgetAccount(s.session.user.id);
    fastSignOut((path) => void navigate({ to: path, replace: true }));
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
  const focusedJourneySession = focused
    ? ((journeyData?.sessions ?? []) as JourneySession[]).find(
        (session) => session.sessionId === focused.id,
      ) ?? null
    : null;
  const reels: FeedReel[] = (view === "reels" ? (reelFeed?.reels ?? []) : (data.reels ?? [])).map(
    (reel: FeedReel) => ({ ...reel, ...(reelLocal[reel.id] ?? {}) }),
  );

  async function onReelLike(reel: FeedReel) {
    const next = !reel.liked;
    setReelLocal((state) => ({
      ...state,
      [reel.id]: { ...state[reel.id], liked: next, likes: Math.max(0, reel.likes + (next ? 1 : -1)) },
    }));
    try {
      await likeReel({ data: { id: reel.id } } as never);
    } catch {
      setReelLocal((state) => ({
        ...state,
        [reel.id]: { ...state[reel.id], liked: reel.liked, likes: reel.likes },
      }));
    }
  }

  async function onReelSave(reel: FeedReel) {
    const next = !reel.saved;
    setReelLocal((state) => ({ ...state, [reel.id]: { ...state[reel.id], saved: next } }));
    try {
      await saveReel({ data: { id: reel.id } } as never);
      toast.success(next ? "Saved to your collection" : "Removed from saved");
    } catch {
      setReelLocal((state) => ({ ...state, [reel.id]: { ...state[reel.id], saved: reel.saved } }));
    }
  }
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
          {focused || view !== "home" ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => (focused ? setFocused(null) : selectView("home"))}
              aria-label="Go back"
              className="shrink-0 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
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
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-metal/30 bg-surface-2 text-muted-foreground hover:text-brand"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        </div>
      </header>
      {settingsOpen ? (
        <div className="fixed inset-0 z-[210]">
          <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-hidden rounded-l-3xl border-l border-hairline">
            <AccountSettings
              currentName={trainee.fullName}
              currentCode={(trainee as any).code ?? (trainee as any).traineeCode ?? ""}
              onClose={() => setSettingsOpen(false)}
              onSignOut={() => void signOut()}
              allowAccountManagement={false}
            />
          </div>
        </div>
      ) : null}

      {portalReady && typeof document !== "undefined"
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-[200] transition-opacity duration-300",
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
              <Link to="/courses">
                <Crown className="h-4 w-4 text-brand-glow" />
                Premium Courses
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-11 w-full justify-start rounded-xl px-3 text-muted-foreground">
              <Link to="/chat">
                <MessageCircle className="h-4 w-4 text-brand-glow" />
                Chat with Upline
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-11 w-full justify-start rounded-xl px-3 text-muted-foreground">
              <Link to="/ai">
                <Bot className="h-4 w-4 text-brand-glow" />
                Skyline Achievers AI
              </Link>
            </Button>
            <OfficialGroupMenuButton placement="beginners" />
            <Button type="button" variant="ghost" className="h-11 w-full justify-start rounded-xl px-3 text-muted-foreground" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon className="h-4 w-4 text-brand-glow" />
              Settings
            </Button>
          </nav>
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {BRAND.tagline}
          </p>
              </aside>
            </div>,
            document.body,
          )
        : null}

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
          </div>

        </section>

        <div className="relative mx-auto mt-4 w-full py-4">
          <Button asChild variant="brand" size="xl" className="w-full justify-between rounded-2xl">
            <Link to="/ai">
              <span className="flex items-center gap-2"><Bot /> Skyline Achievers AI</span>
              <span className="text-xs opacity-80">Ask for help</span>
            </Link>
          </Button>
          <FlyingSkylineAiMascot />
        </div>

        <div className="mt-4">
          <PushWelcomeDialog />
          <PushAlertsCard />
        </div>

        <div className="mt-5">
          <TraineeJourney />
        </div>

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

            <SessionGate key={focused.id} extras={focused.extras} sections={focused.sections}>
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

            {focusedJourneySession &&
            focusedJourneySession.review !== "pending" &&
            focusedJourneySession.review !== "approved" ? (
              <>
                <ReviewShareNotice
                  sessionTitle={focused.title}
                  sessionCode={(focused as any).code ?? null}
                  className="mt-5"
                />
                {/* Session opened with a code: the review box has no time limit. */}
                <SessionReviewForm
                  sessionNumber={focusedJourneySession.sessionNumber}
                  onSent={() => {
                    void queryClient.invalidateQueries({ queryKey: ["trainee-journey"] });
                    setFocused(null);
                    setView("home");
                  }}
                />
                {focusedJourneySession.scheduledAt ? (
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    Scheduled time: {formatDateTime12(focusedJourneySession.scheduledAt)}
                  </p>
                ) : null}
              </>
            ) : focusedJourneySession?.review === "pending" ? (
              <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-center text-sm font-semibold text-amber-300">
                Review submitted — waiting for your upline
              </div>
            ) : focusedJourneySession?.review === "approved" ? (
              <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center text-sm font-semibold text-emerald-300">
                Review approved
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
              <h2 className="mb-1 font-display text-lg font-semibold tracking-tight">
                All sessions
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Your official Day / Session order, timings and reviews are on the Home tab — your
                training journey. Session codes here only open a single session your trainer shares.
              </p>
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
            {reelsPending ? (
              <div className="flex min-h-[31rem] items-center justify-center">
                <SkylineLoader variant="inline" />
              </div>
            ) : reels.length === 0 ? (
              <div className="glass-panel rounded-3xl px-5 py-10 text-center text-sm text-muted-foreground">
                No reels published yet.
              </div>
            ) : (
              <div className="no-scrollbar mx-auto h-[calc(100dvh-11rem)] min-h-[31rem] max-w-md snap-y snap-mandatory space-y-6 scroll-smooth overflow-y-auto overscroll-contain rounded-3xl py-3 [-webkit-overflow-scrolling:touch]">
                {reels.map((reel) => (
                  <article key={reel.id} className="metal-edge relative mx-auto flex h-[min(68dvh,36rem)] min-h-[30rem] w-full snap-center snap-always items-center justify-center overflow-hidden rounded-3xl bg-media shadow-lift transition-all duration-500 ease-out">
                    {reel.url ? (
                      <ReelVideo src={reel.url} poster={reel.posterUrl ?? undefined} className="h-full w-full bg-media object-contain" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Video unavailable</div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center bg-gradient-to-b from-background/90 via-background/45 to-transparent px-16 pb-10 pt-3">
                      <div className="flex max-w-full items-center gap-2 rounded-full border border-cyan/30 bg-background/75 px-3 py-1.5 shadow-brand backdrop-blur-md">
                        <img src={BRAND.logoUrl} alt="" className="h-6 w-6 shrink-0 object-contain" />
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-bold uppercase text-foreground">{BRAND.name}</p>
                          <p className="text-[8px] uppercase text-silver">Learn • Earn • Lead</p>
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4">
                      <button
                        type="button"
                        onClick={() => void onReelLike(reel)}
                        aria-label={reel.liked ? "Remove like" : "Like reel"}
                        className={`flex flex-col items-center gap-1 transition-transform duration-300 active:scale-90 ${reel.liked ? "text-brand-glow" : "text-foreground"}`}
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-background/70 backdrop-blur">
                          <Heart className={`h-5 w-5 ${reel.liked ? "fill-current" : ""}`} />
                        </span>
                        <span className="text-[10px] font-semibold">{compactCount(reel.likes)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCommentsFor(reel)}
                        aria-label="Comments"
                        className="flex flex-col items-center gap-1 text-foreground transition-transform duration-300 active:scale-90"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-background/70 backdrop-blur">
                          <MessageCircle className="h-5 w-5" />
                        </span>
                        <span className="text-[10px] font-semibold">{compactCount(reel.comments)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadReelToGallery(reel)}
                        aria-label="Save reel to gallery"
                        className="flex flex-col items-center gap-1 text-foreground transition-transform duration-300 active:scale-90"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-background/70 backdrop-blur">
                          <Download className="h-5 w-5" />
                        </span>
                        <span className="text-[10px] font-semibold">Gallery</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void onReelSave(reel)}
                        aria-label={reel.saved ? "Remove from saved" : "Save reel"}
                        className={`flex flex-col items-center gap-1 transition-transform duration-300 active:scale-90 ${reel.saved ? "text-brand-glow" : "text-foreground"}`}
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-background/70 backdrop-blur">
                          <Bookmark className={`h-5 w-5 ${reel.saved ? "fill-current" : ""}`} />
                        </span>
                        <span className="text-[10px] font-semibold">{reel.saved ? "Saved" : "Save"}</span>
                      </button>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-transparent p-4 pr-16 pt-14">
                      <ReelAuthor reel={reel} />
                      <h2 className="mt-1 font-display text-base font-semibold">{reel.title}</h2>
                      {reel.caption ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{reel.caption}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}

            <Dialog open={Boolean(commentsFor)} onOpenChange={(next) => !next && setCommentsFor(null)}>
              <DialogContent className="max-h-[85vh] overflow-hidden rounded-3xl p-0">
                <DialogHeader className="border-b border-hairline px-5 py-4">
                  <DialogTitle>Comments</DialogTitle>
                </DialogHeader>
                {commentsFor ? <TraineeReelComments reelId={commentsFor.id} /> : null}
              </DialogContent>
            </Dialog>

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

        {view === "profile" ? <section className="space-y-4"><div className="raised-panel rounded-[28px] p-6"><div className="flex items-center gap-4"><div className="relative h-16 w-16 shrink-0"><div className="h-16 w-16 overflow-hidden rounded-2xl border border-hairline bg-primary/15">{trainee.avatarUrl ? <img src={trainee.avatarUrl} alt="Profile" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-xl font-semibold">{trainee.fullName.charAt(0)}</span>}</div><label className="absolute -bottom-1.5 -right-1.5 grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-cyan/30 bg-primary text-primary-foreground shadow-brand" title="Change profile picture">{uploadAvatar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}<span className="sr-only">Change profile picture</span><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadAvatar.isPending} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) uploadAvatar.mutate(file); }} /></label></div><div><p className="font-display text-lg font-semibold">{trainee.fullName}</p><p className="text-xs text-muted-foreground">Name is managed by Skyline Achievers</p></div></div></div><TraineePasswordCard traineeCode={trainee.traineeCode} /><PasskeyManager /></section> : null}
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
      void traineeCode;
      const res = await changeMyPassword({ data: { current, next } }).catch(() => ({
        ok: false as const,
        message: "Something went wrong. Please try again.",
      }));
      if (!res.ok) {
        toast.error(res.message);
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

function TraineeReelComments({ reelId }: { reelId: string }) {
  const loadComments = useServerFn(getReelComments);
  const send = useServerFn(addReelComment);
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["reel-comments", reelId],
    queryFn: () => loadComments({ data: { id: reelId } } as never),
  });

  const post = useMutation({
    mutationFn: (value: string) => send({ data: { id: reelId, body: value } } as never),
    onSuccess: () => {
      setBody("");
      toast.success("Comment sent — it appears to others once approved.");
      void queryClient.invalidateQueries({ queryKey: ["reel-comments", reelId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const comments = data?.comments ?? [];

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {isPending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
          </div>
        ) : comments.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No comments yet. Be the first one.
          </p>
        ) : (
          comments.map((comment: any) => (
            <div key={comment.id} className="glass-panel rounded-2xl p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-surface-2 text-[10px] font-semibold">
                  {comment.authorName.slice(0, 1).toUpperCase()}
                </span>
                <p className="truncate text-xs font-semibold">{comment.authorName}</p>
                {comment.pending ? (
                  <span className="ml-auto rounded-full border border-hairline px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                    Awaiting approval
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{comment.body}</p>
            </div>
          ))
        )}
      </div>
      <form
        className="flex items-center gap-2 border-t border-hairline px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!body.trim()) return;
          post.mutate(body.trim());
        }}
      >
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a comment…"
          className="h-11 rounded-2xl"
        />
        <Button type="submit" variant="brand" className="rounded-2xl" disabled={post.isPending}>
          {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
