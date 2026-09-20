import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  Clapperboard,
  GraduationCap,
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

import { BrandLogo } from "@/components/brand/BrandLogo";
import { StoryLogo } from "@/components/story/StoryLogo";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { getMemberSession, getNotifications } from "@/lib/member.functions";
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
  { to: "/sessions", label: "Beginners Sessions", icon: Link2 },
  { to: "/reels", label: "Reels", icon: Clapperboard },
  { to: "/chat", label: "Messages", icon: MessageCircle },
  { to: "/seats", label: "Seat Reservation", icon: UserPlus },
  { to: "/team", label: "Team Tree", icon: Users },
  { to: "/resources", label: "Files & Resources", icon: FolderOpen },
  { to: "/search", label: "Search", icon: Search },
  { to: "/profile", label: "My Profile", icon: User },
] as const;

/** Areas that belong to working, not training. Locked for training-only accounts. */
const WORKING_ROUTES: string[] = ["/reels", "/team", "/seats", "/chat"];

/**
 * true when the admin gave this account training access only, so every
 * working area (earnings, team, reels, messages) must stay locked.
 */
export function useTrainingOnly() {
  const loadSession = useServerFn(getMemberSession);
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(Boolean(data.session));
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
  return data?.member ? data.member.workingEnabled === false : false;
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const trainingOnly = useTrainingOnly();

  // Close the side menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Only ask the server once a browser session actually exists, otherwise the
  // protected server function rejects with "No authorization header".
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
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

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/" });
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

      {/* ---------- side menu ---------- */}
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
              trainingOnly && WORKING_ROUTES.includes(item.to) ? (
                <button
                  key={item.to}
                  type="button"
                  onClick={() =>
                    toast.info("This part is locked. Your account is set to training only.")
                  }
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
      </div>

      <main className="page-enter relative mx-auto max-w-6xl px-4 py-5">{children}</main>
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
