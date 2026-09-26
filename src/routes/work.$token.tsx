import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, Phone } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAssistantPortal, logLeadCall } from "@/lib/assistant-portal.functions";

export const Route = createFileRoute("/work/$token")({
  head: () => ({
    meta: [
      { title: "Assistant Workspace — Skyline Achievers" },
      { name: "description", content: "Private calling workspace for Skyline Achievers Job Assistants." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Assistant Workspace — Skyline Achievers" },
      { property: "og:description", content: "Private calling workspace for Job Assistants." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkPage,
});

const TABS = [
  ["new", "Nayi"],
  ["follow_up", "Follow-up"],
  ["contacted", "Contacted"],
  ["enrolled", "Enrolled"],
  ["done", "Band"],
] as const;

function WorkPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const load = useServerFn(getAssistantPortal);
  const log = useServerFn(logLeadCall);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("new");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [follow, setFollow] = useState("");

  const { data, isPending, error } = useQuery({
    queryKey: ["work", token],
    queryFn: () => load({ data: { token } }),
    retry: false,
  });

  const save = useMutation({
    mutationFn: (v: { leadId: string; outcome: string }) =>
      log({
        data: {
          token,
          leadId: v.leadId,
          outcome: v.outcome,
          ...(note ? { note } : {}),
          followUpAt: follow ? new Date(`${follow}:00+05:00`).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Save ho gaya");
      setOpen(null);
      setNote("");
      setFollow("");
      void qc.invalidateQueries({ queryKey: ["work", token] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = useMemo(() => {
    const leads = data?.leads ?? [];
    if (tab === "done") return leads.filter((l) => ["not_interested", "invalid", "cc_done"].includes(l.status));
    const rows = leads.filter((l) => l.status === tab);
    if (tab === "follow_up") rows.sort((a, b) => (a.follow_up_at ?? "").localeCompare(b.follow_up_at ?? ""));
    return rows;
  }, [data, tab]);

  if (isPending) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin" /></div>;
  if (error || !data)
    return <div className="grid min-h-screen place-items-center p-6 text-center text-muted-foreground">{(error as Error)?.message}</div>;

  const a = data.assistant;
  const count = (s: string) =>
    s === "done"
      ? data.leads.filter((l) => ["not_interested", "invalid", "cc_done"].includes(l.status)).length
      : data.leads.filter((l) => l.status === s).length;

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-4 p-4">
      <header className="glass-panel flex items-center gap-3 rounded-2xl p-4">
        <BrandLogo size="sm" withWordmark={false} />
        <div className="flex-1">
          <p className="font-semibold">{a.name}</p>
          <p className="text-xs text-muted-foreground">
            {a.role === "calling" ? "Calling Assistant" : "Full Funnel Assistant"} · FBO {a.fboName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">{data.todayCalls}/{a.dailyLimit}</p>
          <p className="text-[10px] text-muted-foreground">Aaj ki calls</p>
        </div>
      </header>

      <div className="grid grid-cols-5 gap-1">
        {TABS.map(([k, l]) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} className="flex-col h-auto py-1.5 text-[11px]" onClick={() => setTab(k)}>
            {l}
            <span className="font-bold">{count(k)}</span>
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {list.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Is list mein koi lead nahi.</p>}
        {list.map((l) => {
          const wa = `https://wa.me/92${l.phone.slice(-10)}`;
          return (
            <div key={l.id} className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{l.full_name ?? "Lead"}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.phone} {l.city ? `· ${l.city}` : ""} · {l.call_count} calls
                  </p>
                  {l.follow_up_at && (
                    <p className="text-xs text-primary">
                      Follow-up: {new Date(l.follow_up_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}
                    </p>
                  )}
                  {l.notes && <p className="mt-1 text-xs italic text-muted-foreground">{l.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <Button asChild size="icon" variant="outline"><a href={`tel:${l.phone}`}><Phone className="size-4" /></a></Button>
                  <Button asChild size="icon" variant="outline"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="size-4" /></a></Button>
                </div>
              </div>
              {open === l.id ? (
                <div className="mt-3 space-y-2">
                  <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Follow-up time (PKT, sirf follow-up ke liye)</p>
                    <Input type="datetime-local" value={follow} onChange={(e) => setFollow(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["no_answer", "Phone nahi uthaya"],
                      ["follow_up", "Follow-up"],
                      ["contacted", "Baat ho gayi"],
                      ["enrolled", "Rs. 249 enrolled"],
                      ["not_interested", "Interest nahi"],
                      ["invalid", "Galat number"],
                      ...(a.role === "full_funnel" ? [["cc_done", "2CC done"]] : []),
                    ].map(([o, label]) => (
                      <Button key={o} size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ leadId: l.id, outcome: o! })}>
                        {label}
                      </Button>
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" className="w-full" onClick={() => setOpen(null)}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" className="mt-3 w-full" onClick={() => { setOpen(l.id); setNote(l.notes ?? ""); setFollow(""); }}>
                  Call result likhein
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
