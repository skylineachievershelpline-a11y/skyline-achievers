import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { RESOURCE_TYPE_LABEL } from "@/lib/brand";
import { getSharedResource } from "@/lib/member.functions";

export const Route = createFileRoute("/resource/$resourceId")({
  loader: async ({ params }) => getSharedResource({ data: { resourceId: params.resourceId } }),
  head: ({ loaderData }) => {
    const resource = loaderData?.resource;
    const title = resource ? `${resource.title} — Skyline Achievers` : "Resource — Skyline Achievers";
    const description =
      resource?.description ??
      "A Skyline Achievers training resource shared with you — open it right here.";
    const image = resource?.thumbnailUrl ?? null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
    };
  },
  component: SharedResourcePage,
});

function SharedResourcePage() {
  const { resource } = Route.useLoaderData();

  return (
    <main className="motion-scope cinematic-shell relative min-h-screen px-4 py-8">
      <div className="cinematic-ambient pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-2xl">
        <header className="mb-6 flex items-center gap-3">
          <BrandLogo size="sm" />
        </header>

        {!resource ? (
          <div className="glass-panel metal-edge rounded-3xl p-8 text-center">
            <h1 className="font-display text-xl font-semibold">This resource is not available</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The link may have been removed or is not published yet.
            </p>
          </div>
        ) : (
          <article className="glass-panel metal-edge rounded-3xl p-5 animate-rise-in">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {RESOURCE_TYPE_LABEL[resource.resourceType] ?? resource.resourceType}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold">{resource.title}</h1>
            {resource.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{resource.description}</p>
            ) : null}

            {resource.resourceType === "image" && resource.url ? (
              <img
                src={resource.url}
                alt={resource.title}
                className="mt-4 w-full rounded-2xl border border-hairline object-contain"
              />
            ) : null}

            {resource.resourceType === "audio" && resource.url ? (
              <audio controls src={resource.url} className="mt-4 w-full" />
            ) : null}

            {resource.resourceType === "note" && resource.body ? (
              <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-hairline bg-glass p-4 text-sm leading-relaxed text-muted-foreground">
                {resource.body}
              </p>
            ) : null}

            {resource.url && !["image", "audio"].includes(resource.resourceType) ? (
              <Button asChild size="xl" className="mt-5 w-full rounded-2xl">
                <a href={resource.url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4" />
                  Open {RESOURCE_TYPE_LABEL[resource.resourceType] ?? "file"}
                </a>
              </Button>
            ) : null}

            <p className="mt-5 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Skyline Achievers · Learn • Earn • Lead
            </p>
          </article>
        )}
      </div>
    </main>
  );
}
