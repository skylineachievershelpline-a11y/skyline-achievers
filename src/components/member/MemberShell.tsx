import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  ClipboardCheck,
  Clapperboard,
  Home,
  Layers,
  Menu,
  Radio,
  LogOut,
  Search,
  FolderOpen,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { getNotifications } from "@/lib/member.functions";
import { cn } from "@/lib/utils";

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
  { to: "/levels", label: "Training Levels", icon: Layers },
  { to: "/reels", label: "Reels", icon: Clapperboard },
  { to: "/live-training", label: "Live Training", icon: Radio },
  { to: "/team", label: "My Team & Seats", icon: Users },
  { to: "/resources", label: "Files & Resources", icon: FolderOpen },
  { to: "/final-test", label: "Final Test", icon: ClipboardCheck },
  { to: "/search", label: "Search", icon: Search },
  { to: "/profile", label: "My Profile", icon: User },
] as const;

export function MemberShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const navigate = useNavigate();
  const loadNotifications = useServerFn(getNotifications);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

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
    <div className="relative min-h-screen pb-10">
      <div className="spotlight pointer-events-none fixed inset-0" aria-hidden />

      <header className="sticky top-0 z-30 border-b border-hairline/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-glass text-foreground transition-colors hover:bg-glass-strong"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <Link to="/dashboard" className="shrink-0">
            <BrandLogo size="sm" withWordmark={false} />
          </Link>
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
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-glass text-muted-foreground transition-colors hover:text-foreground"
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
            "glass-panel-strong absolute inset-y-0 left-0 flex w-[82vw] max-w-xs flex-col rounded-r-[28px] p-5 transition-transform duration-300",
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
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground"
                activeProps={{
                  className:
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm bg-glass-strong text-foreground",
                }}
              >
                <item.icon className="h-4.5 w-4.5 text-brand-glow" />
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            onClick={() => void signOut()}
            className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-hairline bg-glass px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {BRAND.tagline}
          </p>
        </aside>
      </div>

      <main className="relative mx-auto max-w-6xl px-4 py-5">{children}</main>
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
