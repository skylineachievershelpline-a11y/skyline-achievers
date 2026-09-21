import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { useMemberGuard } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { createAiThread, deleteAiThread, listAiThreads } from "@/lib/ai-chat.functions";

export const Route = createFileRoute("/ai/")({
  head: () => ({ meta: [
    { title: "Skyline Achievers AI — Skyline Achievers" },
    { name: "description", content: "Private, account-based help for using your Skyline Achievers dashboard." },
    { name: "robots", content: "noindex" },
    { property: "og:title", content: "Skyline Achievers AI — Skyline Achievers" },
    { property: "og:description", content: "Get help with the features available on your Skyline Achievers dashboard." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AiThreadsPage,
});

function AiThreadsPage() {
  const ready = useMemberGuard();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const load = useServerFn(listAiThreads);
  const create = useServerFn(createAiThread);
  const remove = useServerFn(deleteAiThread);
  const { data, isPending } = useQuery({ queryKey: ["ai-threads"], queryFn: () => load(), enabled: ready });
  const createMutation = useMutation({ mutationFn: () => create(), onSuccess: ({ id }) => void navigate({ to: "/ai/$threadId", params: { threadId: id } }) });
  const deleteMutation = useMutation({
    mutationFn: (threadId: string) => remove({ data: { threadId } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["ai-threads"] }),
    onError: (error) => toast.error(error.message),
  });
  if (!ready || isPending) return <div className="flex min-h-screen items-center justify-center"><SkylineLoader variant="page" /></div>;
  return (
    <AiPageShell title="Skyline Achievers AI">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><h1 className="font-display text-xl font-semibold">Your conversations</h1><p className="text-sm text-muted-foreground">Saved securely to your account.</p></div>
          <Button variant="brand" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}><MessageSquarePlus /> New chat</Button>
        </div>
        <div className="space-y-3">
          {(data?.threads ?? []).map((thread) => (
            <div key={thread.id} className="glass-panel metal-edge flex items-center gap-3 rounded-2xl p-3">
              <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start gap-3 py-3 text-left" onClick={() => void navigate({ to: "/ai/$threadId", params: { threadId: thread.id } })}>
                <Bot className="h-5 w-5 shrink-0 text-brand-glow" /><span className="truncate">{thread.title}</span>
              </Button>
              <Button variant="ghost" size="icon" aria-label="Delete conversation" onClick={() => { if (window.confirm("Delete this conversation?")) deleteMutation.mutate(thread.id); }}><Trash2 /></Button>
            </div>
          ))}
          {data?.threads.length === 0 ? <div className="raised-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">Start your first private Skyline AI conversation.</div> : null}
        </div>
      </div>
    </AiPageShell>
  );
}