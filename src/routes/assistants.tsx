import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Loader2, Pause, Play, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LeadsManager } from "@/components/assistants/LeadsManager";
import { GrowthCyclePanel } from "@/components/growth/GrowthCyclePanel";
import { GrowthUnlockCard } from "@/components/growth/GrowthUnlockCard";
import { getAssistantLink } from "@/lib/assistant-portal.functions";
import { addAssistant, getMyAssistants, updateAssistant } from "@/lib/assistants.functions";
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
  const load = useServerFn(getMyAssistants);
  const add = useServerFn(addAssistant);
  const update = useServerFn(updateAssistant);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    role: "calling" as "calling" | "full_funnel",
    dailyLeadLimit: "50",
  });

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
  const linkFn = useServerFn(getAssistantLink);
  async function copyLink(id: string) {
    try {
      const { token } = await linkFn({ data: { id } });
      await navigator.clipboard.writeText(`${window.location.origin}/work/${token}`);
      toast.success("Assistant ka private link copy ho gaya — WhatsApp par bhej dein");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const create = useMutation({
    mutationFn: () =>
      add({ data: { ...form, dailyLeadLimit: Number(form.dailyLeadLimit) || 50 } }),
    onSuccess: () => {
      toast.success("Assistant add ho gaya");
      setForm({ fullName: "", phone: "", email: "", role: "calling", dailyLeadLimit: "50" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const change = useMutation({
    mutationFn: (v: { id: string; status?: "active" | "paused" | "removed"; role?: "calling" | "full_funnel" }) =>
      update({ data: v }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

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
    <MemberShell title="Skyline Growth Executive" subtitle="Apna time leverage karein" executive>
      {error ? (
        <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">{(error as Error).message}</div>
      ) : (
        <div className="space-y-6">
          <GrowthCyclePanel />

          <section className="glass-panel rounded-2xl p-5">
            <SectionTitle>Naya Growth Executive add karein</SectionTitle>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Full name</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div>
                <Label>Mobile number</Label>
                <Input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Email (optional)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Daily lead limit</Label>
                <Input inputMode="numeric" value={form.dailyLeadLimit} onChange={(e) => setForm({ ...form, dailyLeadLimit: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Role</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(["calling", "full_funnel"] as const).map((r) => (
                    <Button key={r} type="button" variant={form.role === r ? "default" : "outline"} onClick={() => setForm({ ...form, role: r })}>
                      {ROLE_LABEL[r]}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {form.role === "calling"
                    ? "Leads → calling → Rs. 249 enrollment tak."
                    : "Calling se le kar 2CC tak poora funnel."}
                </p>
              </div>
            </div>
            <Button className="mt-4 w-full" disabled={create.isPending || !form.fullName || !form.phone} onClick={() => create.mutate()}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Add Growth Executive
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Limit: {data?.settings.maxAssistantsPerFbo} assistants. Ek number sirf ek assistant par.
            </p>
          </section>

          <section className="space-y-3">
            <SectionTitle>{`Mere Growth Executives (${data?.assistants.length ?? 0})`}</SectionTitle>
            {(data?.assistants ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Abhi koi assistant nahi.</p>
            )}
            {(data?.assistants ?? []).map((a) => (
              <div key={a.id} className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                <div>
                  <p className="font-semibold">{a.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.phone} · {ROLE_LABEL[a.role as keyof typeof ROLE_LABEL]} · {a.daily_lead_limit}/day
                  </p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${a.status === "active" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {a.status === "active" ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void copyLink(a.id)}>
                    <Link2 className="size-4" /> Link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => change.mutate({ id: a.id, role: a.role === "calling" ? "full_funnel" : "calling" })}>
                    Role badlein
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => change.mutate({ id: a.id, status: a.status === "active" ? "paused" : "active" })}>
                    {a.status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => confirm("Is assistant ko remove karein?") && change.mutate({ id: a.id, status: "removed" })}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </section>

          <LeadsManager assistants={(data?.assistants ?? []) as any} />
        </div>
      )}
    </MemberShell>
  );
}
