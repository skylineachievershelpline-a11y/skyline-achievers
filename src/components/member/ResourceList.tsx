import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  Check,
  FileText,
  Headphones,
  ImageIcon,
  Link2,
  NotebookPen,
  Presentation,
  Share2,
  Video,
} from "lucide-react";
import { useState } from "react";

import { getResourceLink } from "@/lib/member.functions";
import { RESOURCE_TYPE_LABEL } from "@/lib/brand";

const ICONS: Record<string, typeof FileText> = {
  video: Video,
  pdf: FileText,
  audio: Headphones,
  presentation: Presentation,
  book: BookOpen,
  link: Link2,
  note: NotebookPen,
  image: ImageIcon,
};

export type MemberResource = {
  id: string;
  title: string;
  description?: string | null;
  resource_type: string;
  body?: string | null;
  thumbnail_url?: string | null;
  lectures?: { id: string; title: string } | null;

};

export function ResourceList({ resources }: { resources: MemberResource[] }) {
  const resolve = useServerFn(getResourceLink);
  const [busy, setBusy] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [openImage, setOpenImage] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function open(resource: MemberResource) {
    if (resource.resource_type === "note" && resource.body) {
      setOpenNote((prev) => (prev === resource.id ? null : resource.id));
      return;
    }
    if (resource.resource_type === "image" && openImage?.id === resource.id) {
      setOpenImage(null);
      return;
    }
    setBusy(resource.id);
    try {
      const { url } = await resolve({ data: { resourceId: resource.id } });
      if (url && resource.resource_type === "image") {
        setOpenImage({ id: resource.id, url });
      } else if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusy(null);
    }
  }

  async function share(resource: MemberResource) {
    const link = `${window.location.origin}/resource/${resource.id}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy this link", link);
    }
    setCopied(resource.id);
    window.setTimeout(() => setCopied((id) => (id === resource.id ? null : id)), 1800);
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
              {resource.thumbnail_url ? (
                <img
                  src={resource.thumbnail_url}
                  alt=""
                  loading="lazy"
                  className="h-10 w-10 shrink-0 rounded-xl border border-hairline object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-glass text-brand-glow">
                  <Icon className="h-4 w-4" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{resource.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {RESOURCE_TYPE_LABEL[resource.resource_type] ?? resource.resource_type}
                  {resource.lectures?.title ? ` · ${resource.lectures.title}` : ""}

                </span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {busy === resource.id
                  ? "Opening…"
                  : resource.resource_type === "note"
                    ? "Read"
                    : resource.resource_type === "image" && openImage?.id === resource.id
                      ? "Close"
                      : "Open"}
              </span>
            </button>
            {openImage?.id === resource.id ? (
              <div className="border-t border-hairline p-3">
                <img
                  src={openImage.url}
                  alt={resource.title}
                  className="max-h-[70dvh] w-full rounded-xl border border-hairline object-contain"
                />
              </div>
            ) : null}
            <div className="flex items-center justify-end border-t border-hairline px-3 py-2">
              <button
                type="button"
                onClick={() => void share(resource)}
                className="inline-flex min-w-fit items-center gap-1.5 rounded-full border border-hairline bg-glass px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {copied === resource.id ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                {copied === resource.id ? "Link copied" : "Copy link"}
              </button>
            </div>
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
