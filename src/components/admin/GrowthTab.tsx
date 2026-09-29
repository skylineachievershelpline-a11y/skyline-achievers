/**
 * Admin control for Skyline Growth Executive: unlock price, 10-day cycle
 * commission rates and the FBO unlock requests waiting for verification.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GrowthSettings } from "@/lib/growth-cycle";
import {
  adminDecideGrowthAccess,
  adminGetGrowth,
  adminGrantGrowthAccess,
  adminSaveGrowthSettings,
} from "@/lib/growth.functions";

export function GrowthTab() {
  const qc = useQueryClient();
  const load = useServerFn(adminGetGrowth);
  const save = useServerFn(adminSaveGrowthSettings);
  const decide = useServerFn(adminDecideGrowthAccess);
  const grant = useServerFn(adminGrantGrowthAccess);
  const { data, isPending } = useQuery({ queryKey: ["admin-growth"], queryFn: () => load() });
  const [s, setS] = useState<GrowthSettings | null>(null);
  const [code, setCode] = useState("");
  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-growth"] });

  const saving = useMutation({
    mutationFn: () => save({ data: s! }),
    onSuccess: () => {
      toast.success("Growth Executive settings saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const act = useMutation({
    mutationFn: (v: { fboId: string; decision: "approve" | "reject"; note?: string | null }) => decide({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const manual = useMutation({
    mutationFn: () => grant({ data: { memberCode: code.trim() } }),
    onSuccess: () => {
      toast.success("Access granted");
      setCode("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !s) return <Loader2 className="mx-auto size-6 animate-spin" />;
  const num = (v: string) => Number(v) || 0;

  return (
    <div className="space-y-6">
      <section className="glass-panel space-y-4 rounded-2xl p-5">
        <h3 className="font-semibold">Skyline Growth Executive — unlock &amp; commission</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>One-time unlock fee (Rs.)</Label>
            <Input value={s.unlockFee} onChange={(e) => setS({ ...s, unlockFee: num(e.target.value) })} />
          </div>
          <div>
            <Label>Access validity in days (0 = forever)</Label>
            <Input value={s.unlockDays} onChange={(e) => setS({ ...s, unlockDays: num(e.target.value) })} />
          </div>
        </div>

        <h4 className="pt-2 text-sm font-semibold">Rs. 249 enrollment tiers (conversion % → Rs per enrollment)</h4>
        {s.enrollmentTiers.map((t, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <Label>From %</Label>
              <Input
                value={t.minRate}
                onChange={(e) =>
                  setS({
                    ...s,
                    enrollmentTiers: s.enrollmentTiers.map((x, j) =>
                      j === i ? { ...x, minRate: num(e.target.value) } : x,
                    ),
                  })
                }
              />
            </div>
            <div className="flex-1">
              <Label>Rs / enrollment</Label>
              <Input
                value={t.perEnrollment}
                onChange={(e) =>
                  setS({
                    ...s,
                    enrollmentTiers: s.enrollmentTiers.map((x, j) =>
                      j === i ? { ...x, perEnrollment: num(e.target.value) } : x,
                    ),
                  })
                }
              />
            </div>
            <Button
              size="icon"
              variant="outline"
              disabled={s.enrollmentTiers.length < 2}
              onClick={() => setS({ ...s, enrollmentTiers: s.enrollmentTiers.filter((_, j) => j !== i) })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setS({ ...s, enrollmentTiers: [...s.enrollmentTiers, { minRate: 0, perEnrollment: 0 }] })}
        >
          <Plus className="size-4" /> Add tier
        </Button>

        <h4 className="pt-2 text-sm font-semibold">2CC tiers inside one 10-day cycle (count → Rs per 2CC)</h4>
        {s.ccTiers.map((t, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <Label>From count</Label>
              <Input
                value={t.minCount}
                onChange={(e) =>
                  setS({ ...s, ccTiers: s.ccTiers.map((x, j) => (j === i ? { ...x, minCount: num(e.target.value) } : x)) })
                }
              />
            </div>
            <div className="flex-1">
              <Label>Rs / 2CC</Label>
              <Input
                value={t.perCc}
                onChange={(e) =>
                  setS({ ...s, ccTiers: s.ccTiers.map((x, j) => (j === i ? { ...x, perCc: num(e.target.value) } : x)) })
                }
              />
            </div>
            <Button
              size="icon"
              variant="outline"
              disabled={s.ccTiers.length < 2}
              onClick={() => setS({ ...s, ccTiers: s.ccTiers.filter((_, j) => j !== i) })}
            >
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

      <section className="glass-panel space-y-3 rounded-2xl p-5">
        <h3 className="font-semibold">Unlock requests ({data?.rows.length ?? 0})</h3>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label>Grant manually by member ID</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="76xxxxxxxxxx" />
          </div>
          <Button disabled={manual.isPending || code.trim().length < 3} onClick={() => manual.mutate()}>
            Grant
          </Button>
        </div>
        {(data?.rows ?? []).map((r: any) => (
          <div key={r.id} className="rounded-xl border border-border/50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">
                {r.fbo?.full_name} ({r.fbo?.member_id})
              </span>
              <span className="text-xs text-muted-foreground">
                {r.status} · Rs. {Number(r.amount).toLocaleString("en-PK")} · {r.method ?? "-"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {r.sender_name ?? "-"} {r.reference_no ? `· Ref ${r.reference_no}` : ""} ·{" "}
              {new Date(r.requested_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {r.proofUrl ? (
                <a className="text-xs text-primary underline" href={r.proofUrl} target="_blank" rel="noreferrer">
                  View screenshot
                </a>
              ) : null}
              {r.status !== "active" && (
                <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ fboId: r.fbo_id, decision: "approve" })}>
                  <Check className="size-4" /> Approve
                </Button>
              )}
              {r.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={act.isPending}
                  onClick={() =>
                    act.mutate({ fboId: r.fbo_id, decision: "reject", note: "Payment confirm nahi ho saki." })
                  }
                >
                  <X className="size-4" /> Reject
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
