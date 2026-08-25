import { useServerFn } from "@tanstack/react-start";
import { BookOpen, FileText, Headphones, Link2, NotebookPen, Presentation } from "lucide-react";
import { useState } from "react";

import { getResourceLink } from "@/lib/member.functions";
import { RESOURCE_TYPE_LABEL } from "@/lib/brand";

const ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  audio: Headphones,
  presentation: Presentation,
  book: BookOpen,
  link: Link2,
  note: NotebookPen,
};

export type MemberResource = {
  id: string;
  title: string;
  description?: string | null;
  resource_type: string;
  body?: string | null;
  lectures?: { id: string; title: string } | null;
  series?: { id: string; title: string } | null;
};

export function ResourceList({ resources }: { resources: MemberResource[] }) {
  const resolve = useServerFn(getResourceLink);
  const [busy, setBusy] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);

  async function open(resource: MemberResource) {
    if (resource.resource_type === "note" && resource.body) {
      setOpenNote((prev) => (prev === resource.id ? null : resource.id));
      return;
    }
    setBusy(resource.id);
    const { url } = await resolve({ data: { resourceId: resource.id } });
    setBusy(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <ul className="space-y-2">
      {resources.map((resource) => {
        const Icon = ICONS[resource.resource_type] ?? FileText;
        return (
          <li key={resource.id} className="glass-panel rounded-2xl">
            <button
              onClick={() => void open(resource)}
              className="flex w-full items-center gap-3 p-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-glass text-brand-glow">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{resource.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {RESOURCE_TYPE_LABEL[resource.resource_type] ?? resource.resource_type}
                  {resource.lectures?.title ? ` · ${resource.lectures.title}` : ""}
                  {!resource.lectures && resource.series?.title ? ` · ${resource.series.title}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {busy === resource.id ? "Opening…" : resource.resource_type === "note" ? "Read" : "Open"}
              </span>
            </button>
            {openNote === resource.id && resource.body ? (
              <p className="whitespace-pre-wrap border-t border-hairline px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                {resource.body}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
