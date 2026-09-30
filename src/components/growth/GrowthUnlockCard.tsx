/**
 * Paid unlock screen for Skyline Growth Executive.
 *
 * Shows the value first, then the payment accounts the office shared, then a
 * short claim form. Access opens only after the office verifies the payment.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, ImagePlus, Loader2, Lock, Rocket, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { compressImageForUpload } from "@/components/admin/upload";
import { PaymentMethodWallet } from "@/components/journey/PaymentMethodWallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGrowthProofUploadUrl, requestGrowthAccess } from "@/lib/growth.functions";
import { money } from "@/lib/growth-cycle";
import { putWithProgress } from "@/lib/upload-progress";

type Method = {
  id: string;
  label: string;
  account_name: string | null;
  account_number: string | null;
  instructions: string | null;
  qr_url: string | null;
};

const BENEFITS = [
  "Save up to 70% of your calling and follow-up time.",
  "Assign spreadsheet leads directly to your executives.",
  "Track every enrollment and 2CC commission automatically.",
  "No fixed salary — pay only for verified performance.",
  "Monitor every 10-day target cycle live.",
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
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  const walletMethods = methods.map((method) => ({
    name: method.label,
    accountTitle: method.account_name ?? "",
    accountNumber: method.account_number ?? "",
    instructions: method.instructions ?? "",
    qrUrl: method.qr_url ?? "",
  }));

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Attach the payment screenshot.");
      const ready = await compressImageForUpload(file, 900_000);
      let proofPath = "";
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const slot = await makeUrl({ data: { fileName: ready.name } });
          await putWithProgress(slot.signedUrl, ready, (percent) => setUploadPercent(percent));
          proofPath = slot.path;
          break;
        } catch (error) {
          lastError = error;
          setUploadPercent(0);
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      if (!proofPath) {
        throw lastError instanceof Error
          ? lastError
          : new Error("Screenshot upload failed. Check your connection and try again.");
      }
      return send({
        data: {
          method: form.method || "Bank",
          senderName: form.senderName,
          referenceNo: form.referenceNo || null,
          amount: unlockFee,
          proofPath,
        },
      });
    },
    onSuccess: () => {
      toast.success("Request sent. Access will open after office verification.");
      setFile(null);
      setUploadPercent(null);
      void qc.invalidateQueries({ queryKey: ["growth-status"] });
    },
    onError: (e: Error) => {
      setUploadPercent(null);
      toast.error(e.message);
    },
  });

  if (state === "pending") {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center">
        <Clock className="mx-auto size-10 text-primary" />
        <h2 className="mt-3 text-lg font-semibold">Payment verification in progress</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The office is checking your payment. Skyline Growth Executive will unlock automatically after approval,
          and you will receive an alert.
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
            <p className="text-xs text-muted-foreground">Your team's calling and follow-up engine</p>
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
          <h3 className="text-sm font-semibold">Choose a payment account</h3>
          <PaymentMethodWallet
            methods={walletMethods}
            selectedName={form.method}
            onSelect={(method) => setForm((current) => ({ ...current, method }))}
          />
        </section>
      )}

      <section className="glass-panel rounded-2xl p-5">
        <h3 className="text-sm font-semibold">Send payment confirmation</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Payment method</Label>
            <Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="JazzCash / EasyPaisa / Bank" />
          </div>
          <div>
            <Label>Sender name</Label>
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
          onChange={async (event) => {
            const selected = event.target.files?.[0];
            if (!selected) return;
            try {
              const bytes = await selected.arrayBuffer();
              const type = selected.type || "image/jpeg";
              const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
              setFile(new File([bytes], `growth-payment.${ext}`, { type }));
            } catch {
              toast.error("This screenshot could not be read. Please choose it from your gallery again.");
            } finally {
              event.target.value = "";
            }
          }}
        />
        {file ? (
          <div className="mt-3 flex h-11 items-center justify-between rounded-xl border border-border/60 bg-card/50 px-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <ImagePlus className="size-4 shrink-0 text-primary" />
              <span className="truncate">{file.name}</span>
            </span>
            <Button type="button" size="icon" variant="ghost" aria-label="Remove screenshot" onClick={() => setFile(null)}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-4" /> Upload payment screenshot
          </Button>
        )}
        <Button
          className="mt-3 w-full"
          disabled={submit.isPending || !file || form.senderName.trim().length < 2}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {uploadPercent !== null && uploadPercent < 100
            ? `Uploading ${uploadPercent}%`
            : `I paid ${money(unlockFee)} — Request access`}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Access opens automatically after office verification. Your screenshot is used only as payment proof.
        </p>
      </section>
    </div>
  );
}
