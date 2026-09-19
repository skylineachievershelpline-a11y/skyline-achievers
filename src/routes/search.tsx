import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/member/cards";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchLibrary } from "@/lib/member.functions";
import { formatDuration } from "@/lib/format";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search Library — Skyline Achievers" },
      {
        name: "description",
        content: "Search every Skyline Achievers training video and resource unlocked for your rank.",
      },
      { property: "og:title", content: "Search Library — Skyline Achievers" },
      { property: "og:description", content: "Find any training video or resource instantly." },
    ],
  }),
  component: SearchPage,
});

type Results = Awaited<ReturnType<typeof searchLibrary>>;

function SearchPage() {
  useMemberGuard();
  const run = useServerFn(searchLibrary);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) return;
    setPending(true);
    setResults(await run({ data: { query: term } }));
    setPending(false);
  }

  const empty = results && results.lectures.length === 0 && results.resources.length === 0;

  return (
    <MemberShell title="Search" subtitle="Training videos and resources">
      <form onSubmit={onSubmit} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any topic — related videos and files also show"
            className="h-12 rounded-2xl pl-11 text-base"
          />
        </div>
        <Button type="submit" variant="brand" size="xl" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {empty ? <EmptyState title="Nothing matched that search" /> : null}

      {results && results.lectures.length > 0 ? (
        <section className="mb-6">
          <SectionTitle>Training videos</SectionTitle>
          <ul className="space-y-2">
            {results.lectures.map((lecture: any) => (
              <li key={lecture.id}>
                <Link
                  to="/lecture/$lectureId"
                  params={{ lectureId: lecture.id }}
                  className="glass-panel flex items-center gap-3 rounded-2xl p-3"
                >
                  <span className="h-12 w-20 shrink-0 overflow-hidden rounded-xl bg-media">
                    {lecture.thumbnail_url ? (
                      <img
                        src={lecture.thumbnail_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{lecture.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {lecture.training_categories?.name ?? lecture.levels?.name ?? ""}
                      {lecture.match === "related" ? (
                        <span className="rounded-md border border-cyan/30 px-1.5 py-0.5 text-cyan">
                          Related
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDuration(lecture.duration_seconds)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}


      {results && results.resources.length > 0 ? (
        <section>
          <SectionTitle>Files and resources</SectionTitle>
          <ul className="space-y-2">
            {results.resources.map((resource: any) => (
              <li key={resource.id} className="glass-panel rounded-2xl p-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{resource.title}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {resource.resource_type}
                  </span>
                  {resource.match === "related" ? (
                    <span className="rounded-md border border-cyan/30 px-1.5 py-0.5 text-[10px] uppercase text-cyan">
                      Related
                    </span>
                  ) : null}
                </span>
                {resource.lectures?.title ? (
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {resource.lectures.title}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

    </MemberShell>
  );
}
