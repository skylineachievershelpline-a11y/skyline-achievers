import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminGetAssistantSettings,
  adminSaveAssistantSettings,
  type AssistantSettings,
} from "@/lib/assistants.functions";

export function AssistantsTab() {
  const qc = useQueryClient();
  const load = useServerFn(adminGetAssistantSettings);
  const save = useServerFn(adminSaveAssistantSettings);
  const { data, isPending } = useQuery({ queryKey: ["admin-assistants"], queryFn: () => load() });
  const [s, setS] = useState<AssistantSettings | null>(null);
  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);

  const saving = useMutation({
    mutationFn: () => save({ data: s! }),
    onSuccess: () => {
      toast.success("Settings saved");
      void qc.invalidateQueries({ queryKey: ["admin-assistants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !s) return <Loader2 className="mx-auto size-6 animate-spin" />;
  const num = (v: string) => Number(v) || 0;

  return (
    <div className="space-y-6">
      <section className="glass-panel space-y-4 rounded-2xl p-5">
        <h3 className="font-semibold">Job Assistant rules</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Minimum sample leads</Label>
            <Input value={s.minSampleLeads} onChange={(e) => setS({ ...s, minSampleLeads: num(e.target.value) })} />
          </div>
          <div>
            <Label>Max assistants per FBO</Label>
            <Input value={s.maxAssistantsPerFbo} onChange={(e) => setS({ ...s, maxAssistantsPerFbo: num(e.target.value) })} />
          </div>
          <div>
            <Label>Skyline service fee %</Label>
            <Input value={s.serviceFeePercent} onChange={(e) => setS({ ...s, serviceFeePercent: num(e.target.value) })} />
          </div>
        </div>

        <h4 className="pt-2 text-sm font-semibold">Rs. 249 enrollment tiers (conversion % → Rs per enrollment)</h4>
        {s.enrollmentTiers.map((t, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <Label>From %</Label>
              <Input value={t.minRate} onChange={(e) => setS({ ...s, enrollmentTiers: s.enrollmentTiers.map((x, j) => (j === i ? { ...x, minRate: num(e.target.value) } : x)) })} />
            </div>
            <div className="flex-1">
              <Label>Rs / enrollment</Label>
              <Input value={t.perEnrollment} onChange={(e) => setS({ ...s, enrollmentTiers: s.enrollmentTiers.map((x, j) => (j === i ? { ...x, perEnrollment: num(e.target.value) } : x)) })} />
            </div>
            <Button size="icon" variant="outline" disabled={s.enrollmentTiers.length < 2} onClick={() => setS({ ...s, enrollmentTiers: s.enrollmentTiers.filter((_, j) => j !== i) })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setS({ ...s, enrollmentTiers: [...s.enrollmentTiers, { minRate: 0, perEnrollment: 0 }] })}>
          <Plus className="size-4" /> Add tier
        </Button>

        <h4 className="pt-2 text-sm font-semibold">2CC tiers (verified 2CC count → Rs per 2CC)</h4>
        {s.ccTiers.map((t, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <Label>From count</Label>
              <Input value={t.minCount} onChange={(e) => setS({ ...s, ccTiers: s.ccTiers.map((x, j) => (j === i ? { ...x, minCount: num(e.target.value) } : x)) })} />
            </div>
            <div className="flex-1">
              <Label>Rs / 2CC</Label>
              <Input value={t.perCc} onChange={(e) => setS({ ...s, ccTiers: s.ccTiers.map((x, j) => (j === i ? { ...x, perCc: num(e.target.value) } : x)) })} />
            </div>
            <Button size="icon" variant="outline" disabled={s.ccTiers.length < 2} onClick={() => setS({ ...s, ccTiers: s.ccTiers.filter((_, j) => j !== i) })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setS({ ...s, ccTiers: [...s.ccTiers, { minCount: 1, perCc: 0 }] })}>
          <Plus className="size-4" /> Add tier
        </Button>

        <Button className="w-full" disabled={saving.isPending} onClick={() => saving.mutate()}>
          {saving.isPending && <Loader2 className="size-4 animate-spin" />} Save settings
        </Button>
      </section>

      <section className="glass-panel rounded-2xl p-5">
        <h3 className="mb-3 font-semibold">All assistants ({data?.assistants.length ?? 0})</h3>
        <div className="space-y-2 text-sm">
          {(data?.assistants ?? []).map((a: any) => (
            <div key={a.id} className="flex justify-between border-b border-border/40 pb-2">
              <span>
                {a.full_name} · {a.phone} · {a.role === "calling" ? "Calling" : "Full Funnel"} · {a.status}
              </span>
              <span className="text-muted-foreground">
                FBO: {a.fbo?.full_name} ({a.fbo?.member_id})
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
