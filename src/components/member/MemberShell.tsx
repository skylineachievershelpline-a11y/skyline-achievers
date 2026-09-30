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
  Lock,
  MessageCircle,
  Search,
  FolderOpen,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { forgetAccount, rememberCurrentAccount } from "@/lib/device-accounts";
import { hasStoredSession } from "@/lib/offline-cache";
import { Briefcase, Settings } from "lucide-react";


/** Redirects to sign in when there is no live session. */
export function useMemberGuard() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    // An account already saved on this phone opens its screens immediately —
    // the sign-in check keeps running behind the screen, like a chat app.
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
  { to: "/courses", label: "Premium Courses", icon: Crown },
  { to: "/sessions", label: "Beginners Sessions", icon: Link2 },
  { to: "/reels", label: "Reels", icon: Clapperboard },
  { to: "/chat", label: "Messages", icon: MessageCircle },
  { to: "/ai", label: "Skyline Achievers AI", icon: Bot },
  { to: "/seats", label: "Seat Reservation", icon: UserPlus },
  { to: "/leave", label: "Leave Application", icon: FileText },
  { to: "/team", label: "Team Tree", icon: Users },
  { to: "/assistants", label: "Skyline Growth Executive", icon: Briefcase },
  { to: "/resources", label: "Files & Resources", icon: FolderOpen },
  { to: "/search", label: "Search", icon: Search },
  { to: "/profile", label: "My Profile", icon: User },
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
  const [portalReady, setPortalReady] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const trainingOnly = useTrainingOnly();
  const progress = useMemberProgress();
  const hiddenMenu = useHiddenMenu();
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
    <div className={cn("motion-scope cinematic-shell infographic-grid relative min-h-screen bg-background pb-28 text-foreground", executive && "member-workspace")}> 
      <div className="cinematic-ambient pointer-events-none fixed inset-0" aria-hidden />

      <header className="cinematic-nav sticky top-0 z-30 border-b border-metal/20 bg-background/90 shadow-glass backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {pathname !== "/dashboard" ? <BackButton fallback="/dashboard" /> : null}

          <StoryLogo size={34} />

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold">
              {title ?? BRAND.name}
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

          <ThemeSwitch />

          <Link
            to="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-metal/30 bg-surface text-muted-foreground shadow-glass transition-colors hover:border-cyan/40 hover:text-foreground"
            aria-label="Announcements"
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

      {portalReady && settingsOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[220] bg-background/70 backdrop-blur-sm">
              <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-hidden border-l border-hairline bg-background shadow-lift">
                <AccountSettings
                  currentName={(memberAccess?.member as any)?.fullName ?? title ?? "Account"}
                  currentCode={(memberAccess?.member as any)?.accountId ?? ""}
                  onClose={() => setSettingsOpen(false)}
                  onSignOut={signOut}
                />
              </div>
            </div>,
            document.body,
          )
        : null}

      <nav
        aria-label="Main navigation"
        className="app-bottom-nav fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))]"
      >
        <div className="bottom-nav-scroll app-bottom-nav-track mx-auto flex max-w-6xl items-end overflow-x-auto px-2">
          {visibleNav.map((item) => {
            const locked = lockReason(item.to);
            const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(`${item.to}/`));
            const content = (
              <>
                <span className={cn("app-bottom-nav-icon", active && "is-active")}>
                  {locked ? <Lock className="h-4.5 w-4.5" /> : <item.icon className="h-4.5 w-4.5" />}
                </span>
                <span className={cn("app-bottom-nav-label", active && "is-active")}>{item.label}</span>
              </>
            );
            return locked ? (
              <button key={item.to} type="button" title={item.label} onClick={() => toast.info(locked)} className="app-bottom-nav-item">
                {content}
              </button>
            ) : (
              <Link key={item.to} to={item.to} title={item.label} aria-current={active ? "page" : undefined} className="app-bottom-nav-item">
                {content}
              </Link>
            );
          })}
          <button type="button" title="Settings" onClick={() => setSettingsOpen(true)} className="app-bottom-nav-item">
            <span className="app-bottom-nav-icon"><Settings className="h-4.5 w-4.5" /></span>
            <span className="app-bottom-nav-label">Settings</span>
          </button>
        </div>
      </nav>

      <main className="page-enter relative mx-auto max-w-6xl px-4 py-5">
        {lockReason(pathname) && pathname !== "/notifications" ? (
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
