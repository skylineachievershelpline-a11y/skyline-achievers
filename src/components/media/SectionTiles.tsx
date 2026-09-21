import { FolderOpen } from "lucide-react";

export type SectionTile = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  count: number;
};

/**
 * Category picker: each tile shows the category cover as its background with
 * the category name and item count on top, profile-header style.
 */
export function SectionTiles({
  sections,
  onOpen,
}: {
  sections: SectionTile[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onOpen(section.id)}
          className="metal-edge group relative h-32 overflow-hidden rounded-3xl bg-media text-left shadow-lift transition-transform duration-300 active:scale-[0.98]"
        >
          {section.thumbnailUrl ? (
            <img
              src={section.thumbnailUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : null}
          <span className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/50 to-background/10" />
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan/40 bg-background/70 text-brand-glow backdrop-blur">
              <FolderOpen className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-semibold">
                {section.name}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {section.count} {section.count === 1 ? "item" : "items"}
              </span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
