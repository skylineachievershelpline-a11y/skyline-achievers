import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCopy, Link2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { LeadsManager } from "@/components/assistants/LeadsManager";
import { GrowthCyclePanel } from "@/components/growth/GrowthCyclePanel";
import { GrowthUnlockCard } from "@/components/growth/GrowthUnlockCard";
import { createExecutiveInvite, getExecutiveTeam } from "@/lib/growth-executive.functions";
import { getGrowthStatus } from "@/lib/growth.functions";


export const Route = createFileRoute("/assistants")({
  head: () => ({
    meta: [
      { title: "Skyline Growth Executive — Skyline Achievers" },
      {
        name: "description",
        content:
          "Hire Calling and Full Funnel Growth Executives, assign leads and track 10-day cycle commissions.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Skyline Growth Executive — Skyline Achievers" },
      { property: "og:description", content: "Leads, calling and performance commissions in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantsPage,
});


const ROLE_LABEL = { calling: "Calling Executive", full_funnel: "Full Funnel Executive" } as const;

function AssistantsPage() {
  const ready = useMemberGuard();
  const qc = useQueryClient();
  const load = useServerFn(getExecutiveTeam);

  const statusFn = useServerFn(getGrowthStatus);
  const growth = useQuery({
    queryKey: ["growth-status"],
    queryFn: () => statusFn(),
    enabled: ready,
    retry: false,
  });
  const unlocked = growth.data?.state === "active";

  const { data, isPending, error } = useQuery({
    queryKey: ["my-assistants"],
    queryFn: () => load(),
    enabled: ready && unlocked,
    retry: false,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["my-assistants"] });
  const inviteFn = useServerFn(createExecutiveInvite);
  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/apply/growth/${token}`);
      toast.success("Private application link copied");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const create = useMutation({ mutationFn: () => inviteFn({ data: {} }), onSuccess: async (result) => { await copyLink(result.token); refresh(); }, onError: (e: Error) => toast.error(e.message) });

  if (!ready || growth.isPending) return <SkylineLoader />;

  if (growth.error) {
    return (
      <MemberShell title="Skyline Growth Executive" subtitle="Apna time leverage karein" executive>
        <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">
          {(growth.error as Error).message}
        </div>
      </MemberShell>
    );
  }

  if (!unlocked) {
    return (
      <MemberShell title="Skyline Growth Executive" subtitle="Apna time leverage karein" executive>
        <GrowthUnlockCard
          state={(growth.data?.state ?? "locked") as "locked" | "pending" | "expired" | "rejected"}
          unlockFee={growth.data?.unlockFee ?? 0}
          methods={(growth.data?.methods ?? []) as any}
          note={growth.data?.access?.note ?? null}
        />
      </MemberShell>
    );
  }

  if (isPending) return <SkylineLoader />;

  return (
    <MemberShell title="Skyline Growth Executive" subtitle="Build a verified performance team" executive>
      {error ? (
        <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">{(error as Error).message}</div>
      ) : (
        <div className="space-y-6">
          <GrowthCyclePanel />

          <section className="glass-panel rounded-2xl p-5"><SectionTitle>Invite a Growth Executive</SectionTitle><p className="mt-2 text-sm text-muted-foreground">Create a private application link. The applicant completes their details and the office approves the account.</p><Button className="mt-4 w-full" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Create & copy application link</Button>{(data?.invites ?? []).slice(0, 3).map((invite) => <div key={invite.id} className="mt-3 flex items-center justify-between rounded-xl border border-border/50 p-3 text-sm"><span>{invite.label ?? "Executive application"}</span><Button size="sm" variant="outline" onClick={() => void copyLink(invite.token)}><ClipboardCopy /> Copy</Button></div>)}</section>

          <section className="space-y-3">
            <SectionTitle>{`My Growth Executives (${data?.executives.length ?? 0})`}</SectionTitle>
            {(data?.executives ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No approved executive yet.</p>
            )}
            {(data?.executives ?? []).map((a) => (
              <div key={a.id} className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                <div>
                  <p className="font-semibold">{a.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.executive_id} · {a.phone} · {ROLE_LABEL[a.role as keyof typeof ROLE_LABEL]} · {a.daily_lead_limit}/day
                  </p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${a.status === "active" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {a.status === "active" ? "Active" : "Paused"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">Office managed</span>
              </div>
            ))}
          </section>

          <LeadsManager assistants={(data?.executives ?? []) as any} />
        </div>
      )}
    </MemberShell>
  );
}
