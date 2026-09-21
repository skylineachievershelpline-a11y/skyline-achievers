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
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { BackButton } from "@/components/member/BackButton";
import { StoryLogo } from "@/components/story/StoryLogo";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { getMemberSession, getNotifications } from "@/lib/member.functions";
import { getAccessToken } from "@/lib/session-token";
import { fastSignOut } from "@/lib/sign-out";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Redirects to sign in when there is no live session. */
export function useMemberGuard() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        void navigate({ to: "/" });
        return;
      }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) void navigate({ to: "/" });
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
  { to: "/resources", label: "Files & Resources", icon: FolderOpen },
  { to: "/search", label: "Search", icon: Search },
  { to: "/profile", label: "My Profile", icon: User },
] as const;

/** Areas that belong to working, not training. Locked for training-only accounts. */
const WORKING_ROUTES: string[] = ["/team", "/seats", "/chat", "/leave"];

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
  const data = useMemberAccess();
  return data?.member ? data.member.workingEnabled === false : false;
}

/** Personal Mentorship money + target state for the signed-in member. */
export function useMemberProgress() {
  return useMemberAccess()?.progress ?? null;
}

export function MemberShell({
  children,
  title,
  subtitle,
  executive = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  executive?: boolean;
}) {
  const navigate = useNavigate();
  const loadNotifications = useServerFn(getNotifications);
  const [menuOpen, setMenuOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const trainingOnly = useTrainingOnly();
  const progress = useMemberProgress();

  /** Which menu entry is locked right now, and why. */
  function lockReason(to: string): string | null {
    if (progress?.feeLocked && to !== "/dashboard" && to !== "/profile") {
      return "Locked. Complete your Personal Mentorship amount to open this.";
    }
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

  function signOut() {
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-metal/30 bg-surface text-foreground shadow-glass transition-colors hover:border-cyan/40 hover:bg-surface-2"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

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

      {/* Render outside animated page layers so the menu always stays visible. */}
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
                  "glass-panel-strong metal-edge absolute inset-y-0 left-0 flex w-[82vw] max-w-xs flex-col rounded-r-3xl p-5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
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

                <nav className="mt-6 flex-1 space-y-1.5 overflow-y-auto">
                  {NAV.map((item) =>
                    lockReason(item.to) ? (
                      <button
                        key={item.to}
                        type="button"
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
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-metal/20 hover:bg-surface-2 hover:text-foreground"
                        activeProps={{
                          className:
                            "flex items-center gap-3 rounded-xl border border-cyan/30 bg-primary/15 px-3 py-2.5 text-sm text-foreground shadow-glass",
                        }}
                      >
                        <item.icon className="h-4.5 w-4.5 text-brand-glow" />
                        {item.label}
                      </Link>
                    ),
                  )}
                </nav>

                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="logout-button mt-4 w-full font-display text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
                <p className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {BRAND.tagline}
                </p>
              </aside>
            </div>,
            document.body,
          )
        : null}

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
