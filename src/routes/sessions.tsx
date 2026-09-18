import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, Copy, ExternalLink, Loader2, PlayCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/member/cards";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/lib/format";
import { getBeginnerSessionLinks } from "@/lib/team.functions";

export const Route = createFileRoute("/sessions")({
  head: () => ({
    meta: [
      { title: "Beginners Session Links — Skyline Achievers" },
      {
        name: "description",
        content:
          "Generate a direct watch link for any Skyline Achievers beginners training session and send it to your trainee — no login needed.",
      },
      { property: "og:title", content: "Beginners Session Links — Skyline Achievers" },
      {
        property: "og:description",
        content:
          "Share beginners training sessions with a one-tap link that opens the video straight on the website.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SessionLinksPage,
});

type SessionRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
};

function SessionLinksPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getBeginnerSessionLinks);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["beginner-session-links"],
    queryFn: () => load(),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  });

  const sessions = (data?.sessions ?? []) as SessionRow[];
  const term = query.trim().toLowerCase();
  const list = term
    ? sessions.filter(
        (s) => s.title.toLowerCase().includes(term) || s.code.toLowerCase().includes(term),
      )
    : sessions;

  function linkFor(session: SessionRow) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/session/${session.code}`;
  }

  async function copyLink(session: SessionRow) {
    const url = linkFor(session);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(session.id);
      window.setTimeout(() => setCopied(null), 2000);
      toast.success("Link copied — send it to your trainee.");
    } catch {
      toast.error("Could not copy. Long-press the link to copy it.");
    }
  }

  async function shareLink(session: SessionRow) {
    const url = linkFor(session);
    const text = `Skyline Achievers — Beginners Training\n${session.title}\nWatch here: ${url}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: session.title, text, url });
        return;
      } catch {
        // user cancelled the share sheet
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <MemberShell title="Beginners Sessions" subtitle="Generate a watch link for anyone">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5">
        <section className="glass-panel metal-edge rounded-3xl p-5" data-reveal>
          <SectionTitle title="Share a session without a login" />
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Pick a session, copy its link and send it. Whoever opens the link watches that session
            straight on the website — no ID, no password.
          </p>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sessions"
            className="mt-4 h-11 rounded-2xl"
          />
        </section>

        {isPending ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="No sessions to share yet"
            hint="Published beginners training sessions will appear here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {list.map((session, index) => (
              <article
                key={session.id}
                data-reveal
                style={{ ["--motion-order" as string]: index }}
                className="glass-panel metal-edge depth-hover overflow-hidden rounded-3xl"
              >
                <div className="relative aspect-video bg-media">
                  {session.thumbnailUrl ? (
                    <img
                      src={session.thumbnailUrl}
                      alt={`${session.title} cover`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <PlayCircle className="h-9 w-9 text-brand" />
                    </div>
                  )}
                  <span className="absolute right-3 top-3 rounded-full border border-metal/30 bg-background/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] backdrop-blur">
                    {session.code}
                  </span>
                </div>

                <div className="p-5">
                  <h3 className="line-clamp-2 font-display text-base font-semibold">
                    {session.title}
                  </h3>
                  {session.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {session.description}
                    </p>
                  ) : null}
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDuration(session.durationSeconds)}
                  </p>

                  <p className="mt-3 truncate rounded-2xl border border-metal/25 bg-surface-2 px-3 py-2 text-[11px] text-muted-foreground">
                    {linkFor(session)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="brand"
                      className="flex-1 rounded-2xl"
                      onClick={() => void copyLink(session)}
                    >
                      {copied === session.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied === session.id ? "Copied" : "Copy link"}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => void shareLink(session)}
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => window.open(linkFor(session), "_blank", "noopener")}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </MemberShell>
  );
}
