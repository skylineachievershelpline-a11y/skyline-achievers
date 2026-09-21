import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { UIMessage } from "ai";

import { SkylineAiChat } from "@/components/ai/SkylineAiChat";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { useMemberGuard } from "@/components/member/MemberShell";
import { getAiThread } from "@/lib/ai-chat.functions";

export const Route = createFileRoute("/ai/$threadId")({
  head: () => ({ meta: [
    { title: "AI Conversation — Skyline Achievers" },
    { name: "description", content: "A private Skyline Achievers AI support conversation." },
    { name: "robots", content: "noindex" },
    { property: "og:title", content: "AI Conversation — Skyline Achievers" },
    { property: "og:description", content: "Private account-based Skyline Achievers dashboard help." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AiThreadPage,
});

function AiThreadPage() {
  const ready = useMemberGuard();
  const { threadId } = Route.useParams();
  const load = useServerFn(getAiThread);
  const { data, isPending, error } = useQuery({ queryKey: ["ai-thread", threadId], queryFn: () => load({ data: { threadId } }), enabled: ready, retry: false });
  if (!ready || isPending) return <div className="flex min-h-screen items-center justify-center"><SkylineLoader variant="page" /></div>;
  if (error || !data) return <AiPageShell title="Skyline Achievers AI"><p className="raised-panel rounded-2xl p-6 text-sm text-destructive">{error?.message ?? "Chat not found."}</p></AiPageShell>;
  return <AiPageShell title={data.thread.title} showThreads><SkylineAiChat threadId={threadId} initialMessages={data.messages as UIMessage[]} /></AiPageShell>;
}