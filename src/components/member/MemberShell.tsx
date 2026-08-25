import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Home, Layers, LogOut, Search, FolderOpen, User } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
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
  { to: "/levels", label: "Levels", icon: Layers },
  { to: "/resources", label: "Resources", icon: FolderOpen },
  { to: "/search", label: "Search", icon: Search },
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
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => loadNotifications(),
  });

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/" });
  }

  return (
    <div className="relative min-h-screen pb-24 md:pb-10">
      <div className="spotlight pointer-events-none fixed inset-0" aria-hidden />

      <header className="sticky top-0 z-30 border-b border-hairline/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="shrink-0">
            <BrandLogo size="sm" withWordmark={false} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold">{title ?? "Skyline Achievers"}</p>
            {subtitle ? (
              <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground"
                activeProps={{ className: "rounded-full px-3 py-1.5 text-sm bg-glass-strong text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

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

          <button
            onClick={() => void signOut()}
            aria-label="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-glass text-muted-foreground transition-colors hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-5">{children}</main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-hairline/60 bg-background/85 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pt-1.5">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] text-muted-foreground"
              activeProps={{
                className:
                  "flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] text-foreground bg-glass",
              }}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
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
