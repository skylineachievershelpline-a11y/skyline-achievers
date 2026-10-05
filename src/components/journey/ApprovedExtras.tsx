import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Gift, Image as ImageIcon, Link2, PlayCircle } from "lucide-react";
import { useState } from "react";

import { getApprovedSessionExtras } from "@/lib/trainee.functions";

const ICON = { video: PlayCircle, image: ImageIcon, pdf: FileText, link: Link2 } as const;

/** Shown under the next (locked) session: bonus material from the last approved session. */
export function ApprovedExtras({ sessionId, title }: { sessionId: string; title: string }) {
  const load = useServerFn(getApprovedSessionExtras);
  const { data } = useQuery({
    queryKey: ["approved-extras", sessionId],
    queryFn: () => load({ data: { sessionId } }),
  });
  const [playing, setPlaying] = useState<string | null>(null);
  const extras = (data?.extras ?? []) as any[];
  if (!extras.length) return null;

  return (
    <section className="raised-panel space-y-3 rounded-[28px] border border-cyan/30 p-5 animate-rise-in">
      <div className="flex items-center gap-2 text-brand-glow">
        <Gift className="h-5 w-5" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Review approved · bonus material</p>
      </div>
      <h2 className="font-display text-base font-semibold">{title} — extra videos & guides</h2>
      <div className="grid gap-3">
        {extras.map((x) => {
          const Icon = ICON[x.kind as keyof typeof ICON] ?? Link2;
          if (x.kind === "video" && playing === x.id && x.url) {
            return (
              <div key={x.id} className="overflow-hidden rounded-2xl border border-hairline">
                {x.isExternal ? (
                  <iframe src={x.url} title={x.title} className="aspect-video w-full" allow="autoplay; fullscreen" allowFullScreen />
                ) : (
                  <video src={x.url} controls autoPlay playsInline className="w-full" />
                )}
                <p className="p-3 text-sm font-semibold">{x.title}</p>
              </div>
            );
          }
          if (x.kind === "image" && x.url) {
            return (
              <a key={x.id} href={x.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-hairline">
                <img src={x.url} alt={x.title} loading="lazy" className="w-full object-cover" />
                <p className="p-3 text-sm font-semibold">{x.title}</p>
              </a>
            );
          }
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => (x.kind === "video" ? setPlaying(x.id) : x.url && window.open(x.url, "_blank", "noopener"))}
              className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface-2 p-3 text-left"
            >
              {x.thumbnailUrl ? (
                <img src={x.thumbnailUrl} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
              ) : (
                <Icon className="h-6 w-6 shrink-0 text-cyan" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{x.title}</span>
                {x.description ? <span className="line-clamp-2 text-[11px] text-muted-foreground">{x.description}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
