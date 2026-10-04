import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  Bot,
  Clapperboard,
  GraduationCap,
  Crown,
  FileText,
  Home,
  Link2,
  Menu,
  Lock,
  MessageCircle,
  LogOut,
  Search,
  FolderOpen,
  Shield,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { BackButton } from "@/components/member/BackButton";
import { VoiceGuideButton } from "@/components/voice/VoiceGuide";
import { StoryLogo } from "@/components/story/StoryLogo";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { getMemberSession, getNotifications } from "@/lib/member.functions";
import { getAccessToken } from "@/lib/session-token";
import { fastSignOut } from "@/lib/sign-out";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AccountSettings } from "@/components/member/AccountSettings";
import { forgetAccount, rememberCurrentAccount } from "@/lib/device-accounts";
import { hasStoredSession } from "@/lib/offline-cache";
import { Briefcase, Settings } from "lucide-react";
import { TrainingLockScreen, useTrainingLock } from "@/components/training/TrainingGate";
import { isTeacherFrame } from "@/lib/live-call/screen";
import { OfficialGroupMenuButton } from "@/components/whatsapp/OfficialGroupDialog";
import { useFounderTraining } from "@/lib/trainer-demo";

/** Redirects to sign in when there is no live session. */
export function useMemberGuard() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    // Open saved accounts immediately while the live sign-in check continues.
    if (hasStoredSession()) setReady(true);
    void getAccessToken().then((token) => {
      if (!active) return;
      if (!token) {
        void navigate({ to: "/" });
        return;
      }
      setReady(true);
    });

    // Only a real sign-out sends a person back. Early "no session yet" events
    // fired while the stored session is still loading used to bounce the app
    // back to the landing page and straight in again.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && !session) void navigate({ to: "/" });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return ready;
}

const NAV = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/training", label: "Training", icon: GraduationCap },
  { to: "/sessions", label: "Beginners Sessions", icon: Link2, featured: true },
  { to: "/team", label: "Team Tree", icon: Users, featured: true },
  { to: "/seats", label: "Seat Reservation", icon: UserPlus, featured: true },
  { to: "/reels", label: "Reels", icon: Clapperboard },
  { to: "/courses", label: "Premium Courses", icon: Crown },
  { to: "/resources", label: "Files & Resources", icon: FolderOpen },
  { to: "/search", label: "Search", icon: Search },
  { to: "/profile", label: "My Profile", icon: User },
  { to: "/leave", label: "Leave Application", icon: FileText },
  { to: "/chat", label: "Messages", icon: MessageCircle },
  { to: "/ai", label: "Skyline Achievers AI", icon: Bot },
] as const;

/** Areas that belong to working, not training. Locked for training-only accounts. */
const WORKING_ROUTES: string[] = ["/team", "/seats", "/chat", "/leave", "/assistants"];

/**
 * true when the admin gave this account training access only, so every
 * working area (earnings, team, reels, messages) must stay locked.
 */
function useMemberAccess() {
  const loadSession = useServerFn(getMemberSession);
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    let active = true;
    void getAccessToken().then((token) => {
      if (active) setHasSession(Boolean(token));
    });
    return () => {
      active = false;
    };
  }, []);
  const { data } = useQuery({
    queryKey: ["member-access"],
    queryFn: () => loadSession(),
    enabled: hasSession,
    retry: false,
  });
  return data ?? null;
}

export function useTrainingOnly() {
  // Rank decides this now: a Personal Mentorship account trains only, and the
  // working areas open with the Assistant Supervisor upgrade. There is no
  // separate admin switch any more.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const data = useMemberAccess();
  const rank = (data?.member as any)?.level?.rank_order ?? 0;
  return hydrated && Boolean(data?.member) && Number(rank) < 2;
}


/** Personal Mentorship money + target state for the signed-in member. */
export function useMemberProgress() {
  return useMemberAccess()?.progress ?? null;
}

/** Menu entries the admin switched off for this account. */
function useHiddenMenu(): string[] {
  const data = useMemberAccess() as { hiddenMenu?: string[] } | null;
  return data?.hiddenMenu ?? [];
}

export function MemberShell({
  children,
  title,
  subtitle,
  executive = false,
  voiceUr,
  voiceEn,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  executive?: boolean;
  /** Screen guidance read aloud by the header voice button. */
  voiceUr?: string;
  voiceEn?: string;
}) {
  const navigate = useNavigate();
  const loadNotifications = useServerFn(getNotifications);
  const [menuOpen, setMenuOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const trainingOnly = useTrainingOnly();
  const progress = useMemberProgress();
  const hiddenMenu = useHiddenMenu();
  const trainingLockedRaw = useTrainingLock();
  const [inTeacherFrame, setInTeacherFrame] = useState(false);
  useEffect(() => setInTeacherFrame(isTeacherFrame()), []);
  // The AI Teacher's own screen may show the real dashboard during class.
  const trainingLocked = trainingLockedRaw && !inTeacherFrame;
  const visibleNav = NAV.filter(
    (item) => item.to === "/dashboard" || !hiddenMenu.includes(item.to),
  );

  /** Which menu entry is locked right now, and why. */
  function lockReason(to: string): string | null {
    // Server rendering cannot see the browser session or its cached access
    // rules. Keep the first browser render identical, then apply locks.
    if (!portalReady) return null;
    if (to !== "/dashboard" && hiddenMenu.some((key) => to === key || to.startsWith(`${key}/`))) {
      return "This section is not available for your account.";
    }
    // Personal Mentorship payment is never a global lock: the dashboard and all
    // other sections stay usable. Only an explicit admin training lock applies.
    if (progress?.trainingLocked && (to === "/training" || to === "/sessions")) {
      return "Training is locked right now. Your admin can unlock it.";
    }
    if (trainingOnly && WORKING_ROUTES.includes(to)) {
      return "This part is locked. Your account is set to training only.";
    }
    return null;
  }

  // Close the side menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Only ask the server once a browser session actually exists, otherwise the
  // protected server function rejects with "No authorization header".
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    let active = true;
    void getAccessToken().then((token) => {
      if (active) setHasSession(Boolean(token));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session?.access_token));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => loadNotifications(),
    enabled: hasSession,
    retry: false,
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const memberAccess = useMemberAccess();
  const isFounder = memberAccess?.member?.memberId === "760000010005" && memberAccess.reason === "ok";
  const founderTraining = useFounderTraining();
  useEffect(() => {
    const m = memberAccess?.member as any;
    if (!m) return;
    void rememberCurrentAccount({
      name: m.fullName,
      code: m.accountId ?? undefined,
      kind: "member",
    });
  }, [memberAccess]);

  async function signOut() {
    const { data: s } = await supabase.auth.getSession();
    if (s.session) forgetAccount(s.session.user.id);
    fastSignOut((path) => void navigate({ to: path, replace: true }));
  }

  return (
    <div className={cn("motion-scope cinematic-shell infographic-grid relative min-h-screen bg-background pb-10 text-foreground", executive && "member-workspace")}> 
      <div className="cinematic-ambient pointer-events-none fixed inset-0" aria-hidden />

      <header className="cinematic-nav sticky top-0 z-30 border-b border-metal/20 bg-background/90 shadow-glass backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            data-ai-guide="menu-button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-metal/30 bg-surface text-foreground shadow-glass transition-colors hover:border-cyan/40 hover:bg-surface-2"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          {pathname !== "/dashboard" ? <BackButton fallback="/dashboard" /> : null}

          <StoryLogo size={34} />

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold">
              {isFounder ? "A.Q Malik · Founder & CEO" : title ?? BRAND.name}
            </p>
            {subtitle ? (
              <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>

          <VoiceGuideButton
            ur={
              voiceUr ??
              `Ye ${title ?? BRAND.name} ka screen hai. Menu kholne ke liye upar teen lines wala button dabayein. Har kaam ki tafseel screen par likhi hai, aur madad ke liye Skyline Achievers AI se pooch sakte hain.`
            }
            en={
              voiceEn ??
              `This is the ${title ?? BRAND.name} screen. Use the menu button at the top to move between sections, and ask Skyline Achievers AI if you need help.`
            }
          />

          <Link
            to="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-metal/30 bg-surface text-muted-foreground shadow-glass transition-colors hover:border-cyan/40 hover:text-foreground"
            aria-label="Announcements"
            data-ai-guide="notifications-button"
          >
            <Bell className="h-4 w-4" />
            {data && data.unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
                {data.unread > 9 ? "9+" : data.unread}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      {/* Render outside animated page layers so the menu always stays visible. */}
      {portalReady && typeof document !== "undefined"
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-[200] transition-opacity duration-300",
                menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              onPointerDown={(event) => {
                if (!(event.target as HTMLElement).closest("aside")) setMenuOpen(false);
              }}
              onTouchStart={(event) => {
                (event.currentTarget as any)._sx = event.touches[0]?.clientX ?? 0;
              }}
              onTouchEnd={(event) => {
                const sx = (event.currentTarget as any)._sx ?? 0;
                if (sx - (event.changedTouches[0]?.clientX ?? sx) > 60) setMenuOpen(false);
              }}
            >
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              />
              <aside
                className={cn(
                   "glass-panel-strong metal-edge absolute inset-y-0 left-0 flex max-h-[100dvh] w-[82vw] max-w-xs flex-col overflow-hidden rounded-r-3xl p-5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  menuOpen ? "translate-x-0" : "-translate-x-full",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <BrandLogo size="sm" />
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Close menu"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-glass text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="mt-6 min-h-0 flex-1 space-y-1.5 overflow-y-scroll overscroll-contain pr-2 [scrollbar-color:var(--color-primary)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]">
                  {isFounder ? (
                    <div className="mb-3 space-y-1.5 border-b border-hairline pb-3">
                      <p className="px-3 text-[10px] font-semibold uppercase text-cyan">Founder Training</p>
                      <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl border border-cyan/40 bg-primary/20 px-3 py-2.5 text-sm font-semibold"><Home className="h-4.5 w-4.5 text-cyan" />FBO Dashboard</Link>
                      <Link to="/founder" search={{ view: "seat" }} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl border border-metal/30 bg-surface px-3 py-2.5 text-sm font-semibold"><UserPlus className="h-4.5 w-4.5 text-brand-glow" />Training Seat Reservation</Link>
                      {founderTraining.state.seatReserved ? <Link to="/founder" search={{ view: "beginner" }} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl border border-metal/30 bg-surface px-3 py-2.5 text-sm font-semibold"><GraduationCap className="h-4.5 w-4.5 text-brand-glow" />Beginners Training Dashboard</Link> : null}
                      {founderTraining.state.reviewSubmitted || founderTraining.state.approved > 0 ? <Link to="/founder" search={{ view: "review" }} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl border border-metal/30 bg-surface px-3 py-2.5 text-sm font-semibold"><FileText className="h-4.5 w-4.5 text-brand-glow" />Training Reviews</Link> : null}
                      {founderTraining.state.interviewScore != null && founderTraining.state.interviewScore >= 60 ? <Link to="/founder" search={{ view: "mentorship" }} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl border border-metal/30 bg-surface px-3 py-2.5 text-sm font-semibold"><Briefcase className="h-4.5 w-4.5 text-brand-glow" />Personal Mentorship Dashboard</Link> : null}
                      <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl border border-cyan/40 bg-primary/20 px-3 py-2.5 text-sm font-semibold"><Shield className="h-4.5 w-4.5 text-cyan" />Admin Panel</Link>
                    </div>
                  ) : null}
                  {visibleNav.map((item) =>
                    lockReason(item.to) ? (
                      <button
                        key={item.to}
                        type="button"
                        data-ai-guide={`nav:${item.to}`}
                        data-ai-guide-locked="true"
                        onClick={() => toast.info(lockReason(item.to) as string)}
                        className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm text-muted-foreground/60"
                      >
                        <Lock className="h-4.5 w-4.5 text-muted-foreground/60" />
                        {item.label}
                        <span className="ml-auto text-[10px] uppercase tracking-[0.14em]">Locked</span>
                      </button>
                    ) : (
                      <Link
                        key={item.to}
                        to={item.to}
                        data-ai-guide={`nav:${item.to}`}
                        onClick={() => setMenuOpen(false)}
                        className={
                          "featured" in item
                            ? "flex items-center gap-3 rounded-xl border border-cyan/40 bg-gradient-to-r from-primary/20 to-transparent px-3 py-2.5 text-sm font-semibold text-foreground shadow-glass transition-colors hover:bg-primary/25"
                            : "flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-metal/20 hover:bg-surface-2 hover:text-foreground"
                        }
                        activeProps={{
                          className:
                            "flex items-center gap-3 rounded-xl border border-cyan/60 bg-primary/25 px-3 py-2.5 text-sm text-foreground shadow-glass",
                        }}
                      >
                        <item.icon className="h-4.5 w-4.5 text-brand-glow" />
                        {item.label}
                        {"featured" in item ? <span className="ml-auto h-2 w-2 rounded-full bg-cyan shadow-brand" aria-hidden /> : null}
                      </Link>
                    ),
                  )}
                  <OfficialGroupMenuButton placement={trainingOnly ? "mentorship" : "member"} />
                </nav>

                <div className="shrink-0 border-t border-hairline pt-3">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="flex w-full items-center gap-3 rounded-xl border border-metal/30 bg-surface px-3 py-2.5 text-sm font-semibold shadow-glass hover:border-cyan/40"
                  >
                    <Settings className="h-4.5 w-4.5 text-brand-glow" />
                    Settings
                  </button>
                  <p className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {BRAND.tagline}
                  </p>
                </div>
                {settingsOpen ? (
                  <AccountSettings
                    currentName={(memberAccess?.member as any)?.fullName ?? title ?? "Account"}
                    currentCode={(memberAccess?.member as any)?.accountId ?? ""}
                    onClose={() => setSettingsOpen(false)}
                    onSignOut={signOut}
                  />
                ) : null}
              </aside>
            </div>,
            document.body,
          )
        : null}

      <main data-ai-guide="page-content" className="page-enter relative mx-auto max-w-6xl px-4 py-5">
        {trainingLocked && pathname !== "/training-room" ? (
          <TrainingLockScreen />
        ) : lockReason(pathname) && pathname !== "/notifications" ? (
          <div className="raised-panel metal-edge mx-auto mt-10 max-w-md rounded-3xl p-8 text-center">
            <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
            <h1 className="mt-4 font-display text-lg font-semibold">This section is locked</h1>
            <p className="mt-2 text-sm text-muted-foreground">{lockReason(pathname)}</p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("mb-3 font-display text-lg font-semibold tracking-tight", className)}>
      {children}
    </h2>
  );
}

/** Shown instead of a working area when the account is training only. */
export function TrainingOnlyLock({ area }: { area: string }) {
  return (
    <div className="raised-panel metal-edge mx-auto mt-10 max-w-md rounded-3xl p-8 text-center">
      <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
      <h1 className="mt-4 font-display text-lg font-semibold">{area} is locked</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your account is set to training only. Your admin will unlock the working side when you are
        ready.
      </p>
    </div>
  );
}
