/**
 * Admin control for Skyline Growth Executive: unlock price, 10-day cycle
 * commission rates and the FBO unlock requests waiting for verification.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, X } from "lucide-react";
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
import { adminDecideExecutiveApplication, adminDecideVerification, adminDecideWithdrawal, adminGetExecutiveOperations } from "@/lib/growth-executive.functions";

export function GrowthTab() {
  const qc = useQueryClient();
  const load = useServerFn(adminGetGrowth);
  const save = useServerFn(adminSaveGrowthSettings);
  const decide = useServerFn(adminDecideGrowthAccess);
  const grant = useServerFn(adminGrantGrowthAccess);
  const { data, isPending } = useQuery({ queryKey: ["admin-growth"], queryFn: () => load() });
  const opsFn = useServerFn(adminGetExecutiveOperations);
  const decideAppFn = useServerFn(adminDecideExecutiveApplication);
  const decideVerificationFn = useServerFn(adminDecideVerification);
  const decideWithdrawalFn = useServerFn(adminDecideWithdrawal);
  const ops = useQuery({ queryKey: ["admin-growth-operations"], queryFn: () => opsFn() });
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
  const application = useMutation({ mutationFn: (v: { id: string; decision: "approve" | "reject" | "changes_requested"; note?: string }) => decideAppFn({ data: v }), onSuccess: (result) => { if (result.executiveId) toast.success(`Created ${result.executiveId} / ${result.password}`); else toast.success("Application updated"); void qc.invalidateQueries({ queryKey: ["admin-growth-operations"] }); }, onError: (e: Error) => toast.error(e.message) });
  const verification = useMutation({ mutationFn: (v: { id: string; decision: "verify" | "reject" }) => decideVerificationFn({ data: v }), onSuccess: () => { toast.success("Result reviewed"); void qc.invalidateQueries({ queryKey: ["admin-growth-operations"] }); }, onError: (e: Error) => toast.error(e.message) });
  const withdrawal = useMutation({ mutationFn: (v: { id: string; decision: "approve" | "reject" | "paid"; reference?: string }) => decideWithdrawalFn({ data: v }), onSuccess: () => { toast.success("Withdrawal updated"); void qc.invalidateQueries({ queryKey: ["admin-growth-operations"] }); }, onError: (e: Error) => toast.error(e.message) });

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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label>Maximum executives / FBO</Label><Input value={s.maxExecutivesPerFbo} onChange={(e) => setS({ ...s, maxExecutivesPerFbo: num(e.target.value) })} /></div>
          <div><Label>Daily lead target</Label><Input value={s.dailyLeadTarget} onChange={(e) => setS({ ...s, dailyLeadTarget: num(e.target.value) })} /></div>
          <div><Label>Fee / verified enrollment</Label><Input value={s.enrollmentServiceFee} onChange={(e) => setS({ ...s, enrollmentServiceFee: num(e.target.value) })} /></div>
          <div><Label>Fee / verified 2CC</Label><Input value={s.ccServiceFee} onChange={(e) => setS({ ...s, ccServiceFee: num(e.target.value) })} /></div>
        </div>
        <div className="rounded-xl border border-border/50 p-3 text-sm text-muted-foreground">
          Enrollment per 10-lead batch: 1 = Rs.50, 2 = Rs.70 each, 3 = Rs.90 each, 4 = Rs.120 each, then +Rs.30 up to Rs.200 each. 2CC per PKT cycle: 1 = Rs.3,000, 2 = Rs.5,000 each, 3 = Rs.7,000 each, then +Rs.2,000 each.
        </div>

        <Button className="w-full" disabled={saving.isPending} onClick={() => saving.mutate()}>
          {saving.isPending && <Loader2 className="size-4 animate-spin" />} Save settings
        </Button>
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-5">
        <h3 className="font-semibold">Applications ({ops.data?.applications.length ?? 0})</h3>
        {(ops.data?.applications ?? []).map((r: any) => <div key={r.id} className="rounded-xl border border-border/50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{r.full_name}</strong><span>{r.status} · {r.requested_role === "calling" ? "Calling" : "Full Funnel"}</span></div><p className="text-xs text-muted-foreground">{r.phone} · {r.email} · FBO {r.fbo?.full_name} ({r.fbo?.member_id})</p><p className="text-xs text-muted-foreground">{r.qualification} · {r.city} · {r.payout_method} {r.payout_account_number}</p><div className="mt-2 flex flex-wrap gap-2">{r.avatarUrl && <a className="text-xs text-primary underline" href={r.avatarUrl} target="_blank" rel="noreferrer">Profile picture</a>}{r.cnicUrl && <a className="text-xs text-primary underline" href={r.cnicUrl} target="_blank" rel="noreferrer">CNIC front</a>}{r.status !== "approved" && <><Button size="sm" disabled={application.isPending} onClick={() => application.mutate({ id: r.id, decision: "approve" })}><Check className="size-4" /> Approve & create ID</Button><Button size="sm" variant="outline" onClick={() => application.mutate({ id: r.id, decision: "changes_requested", note: "Please correct the submitted details." })}>Request correction</Button><Button size="sm" variant="destructive" onClick={() => application.mutate({ id: r.id, decision: "reject" })}><X className="size-4" /> Reject</Button></>}</div></div>)}
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-5">
        <h3 className="font-semibold">Result verification ({ops.data?.verification.length ?? 0})</h3>
        {(ops.data?.verification ?? []).map((r: any) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 p-3 text-sm"><div><strong>{r.kind === "enrollment" ? "Rs. 249 enrollment" : "2CC completion"}</strong><p className="text-xs text-muted-foreground">{r.lead?.full_name} · {r.lead?.phone} · {r.assistant?.full_name} ({r.assistant?.executive_id})</p></div><div className="flex gap-2"><Button size="sm" onClick={() => verification.mutate({ id: r.id, decision: "verify" })}>Verify & ledger</Button><Button size="sm" variant="outline" onClick={() => verification.mutate({ id: r.id, decision: "reject" })}>Reject</Button></div></div>)}
      </section>

      <section className="glass-panel space-y-3 rounded-2xl p-5">
        <h3 className="font-semibold">Withdrawals ({ops.data?.withdrawals.length ?? 0})</h3>
        {(ops.data?.withdrawals ?? []).map((r: any) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 p-3 text-sm"><div><strong>{r.assistant?.full_name} · Rs. {Number(r.amount).toLocaleString("en-PK")}</strong><p className="text-xs text-muted-foreground">{r.status} · {r.payout_method} · {r.payout_account_number}</p></div><div className="flex gap-2">{r.status === "requested" && <><Button size="sm" onClick={() => withdrawal.mutate({ id: r.id, decision: "approve" })}>Approve</Button><Button size="sm" variant="outline" onClick={() => withdrawal.mutate({ id: r.id, decision: "reject" })}>Reject</Button></>}{r.status === "approved" && <Button size="sm" onClick={() => withdrawal.mutate({ id: r.id, decision: "paid", reference: window.prompt("Payment reference") ?? "" })}>Mark paid</Button>}</div></div>)}
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
