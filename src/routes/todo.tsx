import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { DailyTodoList } from "@/components/member/DailyTodoList";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { getDashboard } from "@/lib/member.functions";

export const Route = createFileRoute("/todo")({
  head: () => ({
    meta: [
      { title: "My To-do List — Skyline Achievers" },
      {
        name: "description",
        content:
          "Your daily Skyline Achievers to-do list: reports, payments and trainee follow-ups, refreshed every morning at 6 AM Pakistan time.",
      },
      { property: "og:title", content: "My To-do List — Skyline Achievers" },
      { property: "og:description", content: "Your daily member to-do list." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TodoPage,
});

function TodoPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getDashboard);
  const { data, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => load(),
    enabled: ready,
    retry: false,
  });

  if (!ready || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <SkylineLoader variant="page" />
      </div>
    );
  }

  const progress = data?.progress ?? null;
  const isFbo = Number(data?.member?.level?.rank_order ?? 0) >= 2;

  return (
    <MemberShell title="To-do List" subtitle="Your tasks for today" executive>
      <section className="mx-auto w-full max-w-3xl space-y-6 px-1 py-3 sm:px-4">
        <DailyTodoList
          remaining={!isFbo && progress && !progress.feeComplete ? progress.feeRemaining : null}
          deadline={!isFbo ? progress?.dueAt ?? null : null}
        />
      </section>
    </MemberShell>
  );
}
