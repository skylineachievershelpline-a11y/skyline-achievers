/**
 * Paid unlock screen for Skyline Growth Executive.
 *
 * Shows the value first, then the payment accounts the office shared, then a
 * short claim form. Access opens only after the office verifies the payment.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Copy, Loader2, Lock, Rocket, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGrowthProofUploadUrl, requestGrowthAccess } from "@/lib/growth.functions";
import { money } from "@/lib/growth-cycle";

type Method = {
  id: string;
  label: string;
  account_name: string | null;
  account_number: string | null;
  instructions: string | null;
  qr_url: string | null;
};

const BENEFITS = [
  "Aapka calling aur follow-up ka 70% time bach jata hai.",
  "Assistants ko leads Excel se seedha assign karein.",
  "Har enrollment aur 2CC ka commission khud hisaab hota hai.",
  "Salary nahi — sirf performance par payment.",
  "Har 10 din ka cycle target live nazar aata hai.",
];

export function GrowthUnlockCard({
  state,
  unlockFee,
  methods,
  note,
}: {
  state: "locked" | "pending" | "expired" | "rejected";
  unlockFee: number;
  methods: Method[];
  note?: string | null;
}) {
  const qc = useQueryClient();
  const makeUrl = useServerFn(createGrowthProofUploadUrl);
  const send = useServerFn(requestGrowthAccess);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ method: methods[0]?.label ?? "", senderName: "", referenceNo: "" });
  const [file, setFile] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Payment ka screenshot lagayein.");
      const slot = await makeUrl({ data: { fileName: file.name } });
      const res = await fetch(slot.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "image/jpeg" },
        body: file,
      });
      if (!res.ok) throw new Error("Screenshot upload nahi ho saka. Dobara koshish karein.");
      return send({
        data: {
          method: form.method || "Bank",
          senderName: form.senderName,
          referenceNo: form.referenceNo || null,
          amount: unlockFee,
          proofPath: slot.path,
        },
      });
    },
    onSuccess: () => {
      toast.success("Request bhej di gayi — office verify karte hi feature khul jayega.");
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["growth-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (state === "pending") {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center">
        <Clock className="mx-auto size-10 text-primary" />
        <h2 className="mt-3 text-lg font-semibold">Payment verification chal rahi hai</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Office aapki payment check kar raha hai. Confirm hote hi Skyline Growth Executive khud khul jayega aur
          aapko alert milega.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="glass-panel relative overflow-hidden rounded-2xl p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
            <Rocket className="size-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Skyline Growth Executive</h2>
            <p className="text-xs text-muted-foreground">Aapki team ka calling aur follow-up engine</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {BENEFITS.map((b) => (
            <li key={b} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center justify-between rounded-xl border border-border/60 bg-card/50 p-4">
          <div>
            <p className="text-xs text-muted-foreground">One-time unlock</p>
            <p className="text-xl font-semibold">{money(unlockFee)}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> {state === "expired" ? "Expired" : "Locked"}
          </span>
        </div>
        {state === "rejected" && note ? (
          <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{note}</p>
        ) : null}
      </section>

      {methods.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Payment kahan karein</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {methods.map((m) => (
              <div key={m.id} className="glass-panel rounded-2xl p-4">
                <p className="font-semibold">{m.label}</p>
                {m.account_name ? <p className="text-xs text-muted-foreground">{m.account_name}</p> : null}
                {m.account_number ? (
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center justify-between rounded-lg bg-card/60 px-3 py-2 text-sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(m.account_number ?? "");
                      toast.success("Number copy ho gaya");
                    }}
                  >
                    <span className="font-mono">{m.account_number}</span>
                    <Copy className="size-4 text-muted-foreground" />
                  </button>
                ) : null}
                {m.instructions ? <p className="mt-2 text-xs text-muted-foreground">{m.instructions}</p> : null}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="glass-panel rounded-2xl p-5">
        <h3 className="text-sm font-semibold">Payment ki tasdeeq bhejein</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Payment method</Label>
            <Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="JazzCash / EasyPaisa / Bank" />
          </div>
          <div>
            <Label>Bhejne wale ka naam</Label>
            <Input value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Reference / transaction number (optional)</Label>
            <Input value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} />
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> {file ? file.name.slice(0, 28) : "Screenshot chunein"}
        </Button>
        <Button
          className="mt-3 w-full"
          disabled={submit.isPending || !file || form.senderName.trim().length < 2}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {money(unlockFee)} bhej diya — unlock karein
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Office verify karne ke baad feature khud khul jayega. Screenshot sirf tasdeeq ke liye hai.
        </p>
      </section>
    </div>
  );
}
