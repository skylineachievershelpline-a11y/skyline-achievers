import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminGetAiQuestions } from "@/lib/admin-ai.functions";

const RANGES = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

export function AiQuestionsTab() {
  const loadQuestions = useServerFn(adminGetAiQuestions);
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["admin-ai-questions", days, search],
    queryFn: () =>
      loadQuestions({
        data: search.trim() ? { days, search: search.trim() } : { days },
      }),
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        <h2 className="text-lg font-semibold text-white">Skyline AI — questions report</h2>
        <p className="mt-1 text-sm text-white/60">
          What members and beginners are asking the AI guide. Use it to improve training content.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {RANGES.map((range) => (
            <Button
              key={range.days}
              size="sm"
              variant={days === range.days ? "default" : "outline"}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </Button>
          ))}
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search a word in questions"
            className="h-9 w-full max-w-xs"
          />
        </div>
      </div>

      {isPending ? (
        <SkylineLoader label="Loading questions" />
      ) : !data ? (
        <p className="text-sm text-white/60">No data yet.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Questions asked" value={data.total} />
            <Stat label="People asking" value={data.people} />
            <Stat label="Range" value={`${data.days} days`} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <h3 className="text-sm font-semibold text-white">Most asked topics</h3>
            {data.topTopics.length === 0 ? (
              <p className="mt-2 text-sm text-white/50">No questions in this range.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.topTopics.map((topic) => (
                  <span
                    key={topic.topic}
                    className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100"
                  >
                    {topic.topic}
                    <span className="ml-2 font-semibold text-white">{topic.count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {data.byAccess.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <h3 className="text-sm font-semibold text-white">Questions by access level</h3>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                {data.byAccess.map((row) => (
                  <li key={row.access} className="flex items-center justify-between gap-3">
                    <span>{row.access}</span>
                    <span className="font-semibold text-white">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <h3 className="text-sm font-semibold text-white">Latest questions</h3>
            {data.questions.length === 0 ? (
              <p className="mt-2 text-sm text-white/50">Nothing to show.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.questions.map((question) => (
                  <li
                    key={question.id}
                    className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
                  >
                    <p className="text-sm text-white/90">{question.text}</p>
                    <p className="mt-2 text-xs text-white/50">
                      {question.name} · {question.access} ·{" "}
                      {new Date(question.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
