import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { MemberStatusSaver } from "@/components/member/MemberStatusSaver";
import { getDashboard } from "@/lib/member.functions";

export const Route = createFileRoute("/status-saver")({
  head: () => ({
    meta: [
      { title: "Status Saver — Skyline Achievers" },
      { name: "description", content: "Create and share your official Skyline Achievers profile status." },
      { property: "og:title", content: "Status Saver — Skyline Achievers" },
      { property: "og:description", content: "Create your official Skyline Achievers profile status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatusSaverPage,
});

function StatusSaverPage() {
  const ready = useMemberGuard();
  const load = useServerFn(getDashboard);
  const { data, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => load(),
    enabled: ready,
  });

  if (!ready || isPending) {
    return <div className="flex min-h-screen items-center justify-center"><SkylineLoader variant="page" /></div>;
  }

  const member = data?.member;
  if (!member || data.blocked) return null;

  return (
    <MemberShell title="Status Saver" subtitle="Official Skyline profile status" executive>
      <div className="mx-auto w-full max-w-3xl py-3">
        <MemberStatusSaver
          member={{
            fullName: member.fullName,
            memberId: member.memberId,
            avatarUrl: member.avatarUrl,
            bio: member.bio,
            levelName: member.level?.name ?? "Unranked",
          }}
          expanded
        />
      </div>
    </MemberShell>
  );
}