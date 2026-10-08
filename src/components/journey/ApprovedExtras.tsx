import { useQuery } from "@tanstack/react-query";
import { toEmbedUrl } from "@/components/media/SessionVideo";
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
  const [category, setCategory] = useState<string | null>(null);
  const all = (data?.extras ?? []) as any[];
  const sections = ((data as any)?.sections ?? []) as { id: string; name: string; thumbnailUrl: string | null }[];
  const known = new Set(sections.map((c) => c.id));
  const tiles = [
    ...sections.filter((c) => all.some((x) => x.sectionId === c.id)),
    ...(all.some((x) => !x.sectionId || !known.has(x.sectionId)) ? [{ id: "__other", name: "More", thumbnailUrl: null }] : []),
  ];
  const useTiles = sections.length > 0;
  const extras = !useTiles
    ? all
    : category === "__other"
      ? all.filter((x) => !x.sectionId || !known.has(x.sectionId))
      : all.filter((x) => x.sectionId === category);
  if (!all.length) return null;

  return (
    <section className="raised-panel space-y-3 rounded-[28px] border border-cyan/30 p-5 animate-rise-in">
      <div className="flex items-center gap-2 text-brand-glow">
        <Gift className="h-5 w-5" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Review approved · bonus material</p>
      </div>
      <h2 className="font-display text-base font-semibold">{title} — extra videos & guides</h2>
      {useTiles ? (
        <div className="grid grid-cols-3 gap-3">
          {tiles.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(category === c.id ? null : c.id)} className="flex flex-col items-center gap-1.5">
              <span className={`flex aspect-square w-full max-w-[96px] items-center justify-center overflow-hidden rounded-full border-2 bg-surface-2 shadow-glass transition-colors ${category === c.id ? "border-cyan" : "border-hairline"}`}>
                {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Gift className="h-7 w-7 text-cyan" />}
              </span>
              <span className="line-clamp-2 text-center text-[11px] font-semibold">{c.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      {useTiles && !category ? <p className="text-center text-[11px] text-muted-foreground">Tap a category to open it.</p> : null}
      <div className="grid gap-3">
        {(useTiles && !category ? [] : extras).map((x) => {
          const Icon = ICON[x.kind as keyof typeof ICON] ?? Link2;
          if (x.kind === "video" && playing === x.id && x.url) {
            return (
              <div key={x.id} className="-mx-4 overflow-hidden border-y border-hairline bg-media sm:mx-0 sm:rounded-2xl sm:border">
                {x.isExternal ? (
                  <iframe src={toEmbedUrl(x.url)} title={x.title} className="aspect-video w-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowFullScreen />
                ) : (
                  <video src={x.url} controls autoPlay playsInline className="aspect-video w-full object-contain" />
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
