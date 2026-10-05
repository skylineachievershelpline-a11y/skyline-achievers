import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { SectionTiles, type SectionTile } from "@/components/media/SectionTiles";
import { SessionExtraCard, type SessionExtraItem } from "@/components/media/SessionExtraCard";
import { Button } from "@/components/ui/button";

export type SessionSectionItem = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
};

const OTHER = "__other__";

/**
 * Extra material with a session. When `locked`, it stays hidden until the
 * session review is approved; `approved` shows a motivational banner.
 */
export function SessionGate({
  extras,
  sections = [],
  locked = false,
  approved = false,
  children,
}: {
  extras: SessionExtraItem[];
  sections?: SessionSectionItem[];
  locked?: boolean;
  approved?: boolean;
  children: ReactNode;
}) {
  const [watched, setWatched] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const tiles = useMemo<SectionTile[]>(() => {
    const list: SectionTile[] = sections
      .map((section) => ({
        id: section.id,
        name: section.name,
        thumbnailUrl: section.thumbnailUrl,
        count: extras.filter((extra) => extra.sectionId === section.id).length,
      }))
      .filter((tile) => tile.count > 0);
    const loose = extras.filter(
      (extra) => !extra.sectionId || !sections.some((s) => s.id === extra.sectionId),
    );
    if (loose.length > 0 && list.length > 0) {
      list.push({
        id: OTHER,
        name: "More material",
        thumbnailUrl: loose[0]?.thumbnailUrl ?? null,
        count: loose.length,
      });
    }
    return list;
  }, [extras, sections]);

  if (extras.length === 0) return <>{children}</>;

  if (locked) {
    return (
      <>
        {children}
        <div className="inset-panel mt-6 flex items-center gap-3 rounded-2xl p-4 text-xs text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0 text-brand-glow" />
          Bonus videos, pictures, PDFs and links for this session unlock as soon as your review is
          approved.
        </div>
      </>
    );
  }

  if (!watched) {
    return (
      <>
        {children}
        {approved ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-300">
            <p className="font-semibold">Review approved — your bonus material is ready!</p>
            <p className="mt-1 text-xs opacity-90">
              Watch these extra videos and files to clear your doubts while your next session
              prepares.
            </p>
          </div>
        ) : null}
        <Button
          size="xl"
          className="logout-button mt-6 w-full font-display text-sm"
          onClick={() => setWatched(true)}
        >
          <CheckCircle2 className="h-4 w-4" />
          {approved ? "Open bonus material" : "I have watched full webinar"}
        </Button>
      </>
    );
  }

  const useTiles = tiles.length > 0;
  const activeTile = useTiles ? tiles.find((tile) => tile.id === openSection) : undefined;
  const shown =
    !useTiles || !activeTile
      ? extras
      : activeTile.id === OTHER
        ? extras.filter(
            (extra) => !extra.sectionId || !sections.some((s) => s.id === extra.sectionId),
          )
        : extras.filter((extra) => extra.sectionId === activeTile.id);

  if (useTiles && !activeTile) {
    return (
      <div className="animate-rise-in space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold tracking-tight">
            Choose what you want to see
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="rounded-2xl"
            onClick={() => setWatched(false)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <SectionTiles sections={tiles} onOpen={setOpenSection} />
      </div>
    );
  }

  return (
    <div className="animate-rise-in space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold tracking-tight">
          {activeTile ? activeTile.name : "More with this session"}
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="rounded-2xl"
          onClick={() => (activeTile ? setOpenSection(null) : setWatched(false))}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {shown.map((extra) => (
        <div key={extra.id} className="animate-rise-in">
          <SessionExtraCard extra={extra} />
        </div>
      ))}

      <Button
        variant="outline"
        size="xl"
        className="w-full rounded-2xl"
        onClick={() => (activeTile ? setOpenSection(null) : setWatched(false))}
      >
        <ArrowLeft className="h-4 w-4" />
        {activeTile ? "Back to categories" : "Back to the session"}
      </Button>
    </div>
  );
}
