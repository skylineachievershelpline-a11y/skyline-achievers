import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";

import { NotificationMedia } from "@/components/member/NotificationMedia";
import { getNotifications } from "@/lib/member.functions";

const SEEN_KEY = "skyline-seen-announcement";
/** How long the banner stays on the dashboard before it slides away. */
const VISIBLE_MS = 14_000;

/**
 * Shows the newest admin announcement on top of the dashboard for a short
 * while. Closing it here only hides the banner — the announcement stays in the
 * notifications page until the member deletes it there.
 */
export function AnnouncementBanner() {
  const load = useServerFn(getNotifications);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => load(),
    retry: false,
  });
  const [closedId, setClosedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const latest = (data?.items ?? [])[0] as
    | {
        id: string;
        title: string;
        body: string | null;
        media_type?: string | null;
        media_url?: string | null;
      }
    | undefined;

  useEffect(() => {
    if (!latest) return;
    setHidden(false);
    if (typeof window !== "undefined" && sessionStorage.getItem(SEEN_KEY) === latest.id) {
      setClosedId(latest.id);
      return;
    }
    const timer = window.setTimeout(() => {
      setHidden(true);
      if (typeof window !== "undefined") sessionStorage.setItem(SEEN_KEY, latest.id);
    }, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [latest?.id]);

  if (!latest || hidden || closedId === latest.id) return null;

  return (
    <div className="glass-panel-strong metal-edge mb-4 flex items-start gap-3 rounded-2xl p-4 animate-rise-in">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan/30 bg-primary/15 text-brand-glow">
        <Megaphone className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan">Announcement</p>
        <p className="mt-0.5 truncate font-display text-sm font-semibold">{latest.title}</p>
        {latest.body ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {latest.body}
          </p>
        ) : null}
        {latest.media_type === "audio" ? (
          <NotificationMedia mediaType={latest.media_type} mediaUrl={latest.media_url} />
        ) : null}
        <Link to="/notifications" className="mt-2 inline-block text-xs font-semibold text-brand-glow">
          Open notifications →
        </Link>
      </div>
      <button
        type="button"
        aria-label="Hide announcement"
        onClick={() => {
          setClosedId(latest.id);
          if (typeof window !== "undefined") sessionStorage.setItem(SEEN_KEY, latest.id);
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
