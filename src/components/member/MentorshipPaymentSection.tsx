import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Clock,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { compressImageForUpload } from "@/components/admin/upload";
import { PaymentMethodWallet } from "@/components/journey/PaymentMethodWallet";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoiceGuide } from "@/components/voice/VoiceGuide";
import { formatDateTime } from "@/lib/format";
import {
  createMemberPaymentProofUploadUrl,
  getMyPaymentCentre,
  submitMemberPaymentClaim,
} from "@/lib/member-payments.functions";
import { formatCountdown, formatPkr } from "@/lib/mentorship";
import { putWithProgress } from "@/lib/upload-progress";

const PURPOSE_LABEL: Record<string, string> = {
  mentorship: "Personal Mentorship",
  two_cc: "2CC",
};

function StatusChip({ status }: { status: string }) {
  const label =
    status === "verified" ? "Verified" : status === "rejected" ? "Rejected" : "Pending";
  const tone =
    status === "verified"
      ? "text-cyan"
      : status === "rejected"
        ? "text-destructive"
        : "text-amber-300";
  return <span className={`text-[11px] font-bold ${tone}`}>{label}</span>;
}

export function MentorshipPaymentSection({ standalone = false }: { standalone?: boolean }) {
  const queryClient = useQueryClient();
  const load = useServerFn(getMyPaymentCentre);
  const createProofUrl = useServerFn(createMemberPaymentProofUploadUrl);
  const send = useServerFn(submitMemberPaymentClaim);

  const { data, isPending } = useQuery({
    queryKey: ["member-payment-centre"],
    queryFn: () => load(),
    retry: false,
  });

  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [method, setMethod] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Please wait — loading your payment details.");
      if (!method.trim()) throw new Error("Choose or write the payment method you used.");
      const value = Number(amount) || 0;
      if (value <= 0) throw new Error("Enter the amount you paid.");
      const limit = data.mentorship.complete ? data.cc.remaining : data.mentorship.remaining;
      if (value > limit) {
        throw new Error(`That is more than your remaining amount of ${formatPkr(limit)}.`);
      }
      if (!proof) throw new Error("Attach the payment screenshot — it is required.");
      const ready = await compressImageForUpload(proof, 900_000);
      let proofPath = "";
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const upload = await createProofUrl({ data: { fileName: ready.name } });
          await putWithProgress(upload.signedUrl, ready, (percent) => setUploadPercent(percent));
          proofPath = upload.path;
          break;
        } catch (error) {
          lastError = error;
          setUploadPercent(0);
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }
      if (!proofPath) {
        throw lastError instanceof Error
          ? lastError
          : new Error("Screenshot upload failed. Check your connection and try again.");
      }
      await send({
        data: {
          purpose: data.mentorship.complete ? ("two_cc" as const) : ("mentorship" as const),
          claimedAmount: value,
          method: method.trim(),
          proofPath,
          note: note.trim() || null,
        },
      } as never);
    },
    onSuccess: () => {
      toast.success("Payment sent for verification");
      setAmount("");
      setNote("");
      setProof(null);
      setUploadPercent(null);
      void queryClient.invalidateQueries({ queryKey: ["member-payment-centre"] });
    },
    onError: (error: Error) => {
      setUploadPercent(null);
      toast.error(
        error.message === "Failed to fetch"
          ? "Screenshot upload failed. Check your internet and try again."
          : error.message,
      );
    },
  });

  if (isPending || !data) {
    return standalone ? (
      <section className="raised-panel metal-edge rounded-3xl p-5">
        <div className="flex min-h-[12rem] items-center justify-center">
          <SkylineLoader variant="page" />
        </div>
      </section>
    ) : null;
  }

  const { mentorship, cc, methods, policy, history } = data;
  const pending = history.filter((row) => row.status === "pending");
  const payingCc = mentorship.complete;
  const payLimit = payingCc ? cc.remaining : mentorship.remaining;
  const shownTotal = payingCc ? cc.target : mentorship.required;
  const shownPaid = payingCc ? cc.verified : mentorship.verified;
  const shownLeft = payingCc ? cc.remaining : mentorship.remaining;
  const percent = shownTotal ? Math.min(100, Math.round((shownPaid / shownTotal) * 100)) : 100;

  return (
    <section
      id="pay-mentorship"
      className="raised-panel metal-edge scroll-mt-24 space-y-5 rounded-3xl p-5"
    >
      {/* ---------- summary ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-cyan" />
          <h2 className="font-display text-base font-semibold">
            {payingCc ? "2CC payment" : "Personal Mentorship payment"}
          </h2>
        </div>
        <VoiceGuide
          label="Listen"
          ur="Yahan aap apni Personal Mentorship ki remaining amount jama kar sakte hain. Pehle payment method chunein, office ke diye gaye account par amount send karein, phir amount likh kar payment ka screenshot upload karein aur verification ke liye submit karein. Screenshot se amount khud add nahi hoti — office verify karega, uske baad aap ka received aur remaining update ho jayega."
          en="Here you can clear your remaining Personal Mentorship amount. Choose a payment method, send the amount to the office account, then enter the amount, upload the payment screenshot and submit it for verification. A screenshot never adds money by itself — the office verifies it, and then your received and remaining amounts update."
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold tabular-nums">
            {formatPkr(shownTotal)}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">
            {payingCc ? "2CC total" : "Total"}
          </p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold tabular-nums text-cyan">
            {formatPkr(shownPaid)}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">
            Verified paid
          </p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold tabular-nums">
            {formatPkr(shownLeft)}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Remaining</p>
        </div>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full border border-hairline bg-surface-2">
        <div
          className="brand-gradient h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.max(3, percent)}%` }}
        />
      </div>

      {mentorship.complete ? (
        <p className="flex items-center gap-2 rounded-2xl border border-cyan/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-cyan">
          <BadgeCheck className="h-4 w-4" /> Personal Mentorship payment completed — your 2CC target
          is {formatPkr(cc.target)}.
        </p>
      ) : null}
      {payingCc ? (
        <CcDeadlineNotice cc={cc} />
      ) : (
        <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs font-semibold text-amber-300">
          Complete your Personal Mentorship amount within {policy.mentorshipDays} days to keep the
          lower 2CC target of {formatPkr(policy.ccTargetFullPayment)}. After that the applicable
          target is {formatPkr(policy.ccTargetPartial)}. Your account is never suspended for this.
        </p>
      )}

      {/* ---------- where to pay ---------- */}
      {payLimit > 0 && (policy as any).formPolicy?.trim() && !policyAccepted ? (
        <div className="space-y-3 rounded-2xl border border-cyan/30 bg-primary/10 p-4">
          <p className="font-display text-sm font-semibold">Personal Mentorship policy</p>
          <p className="whitespace-pre-line text-xs leading-5 text-muted-foreground">
            {(policy as any).formPolicy}
          </p>
          <Button type="button" variant="brand" className="w-full rounded-2xl font-display" onClick={() => setPolicyAccepted(true)}>
            <BadgeCheck className="h-4 w-4" /> I accept — open payment form
          </Button>
        </div>
      ) : payLimit > 0 ? (
        <div className="space-y-3">
          <div>
            <p className="font-display text-sm font-semibold">
              {payingCc ? "Pay remaining 2CC amount" : "Complete Personal Mentorship payment"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Remaining amount: {formatPkr(payLimit)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Select payment method</Label>
            {methods.length === 0 ? (
              <>
                <p className="rounded-2xl border border-hairline bg-surface-2 p-3 text-[11px] text-muted-foreground">
                  The office has not added payment methods yet. Write the method you used and the
                  office will check it with your screenshot.
                </p>
                <Input
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  placeholder="Easypaisa / JazzCash / bank transfer"
                  className="h-12 rounded-2xl"
                />
              </>
            ) : (
              <PaymentMethodWallet
                methods={methods}
                selectedName={method}
                onSelect={(name) => setMethod(name)}
              />
            )}
          </div>


          {/* ---------- claim form ---------- */}
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Payment amount (Rs.)</Label>
              <Input
                value={amount}
                inputMode="numeric"
                placeholder={String(payLimit)}
                onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
                className="h-11 rounded-2xl tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                Cannot be more than {formatPkr(payLimit)}.
              </p>
            </div>

            {proof ? (
              <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface-2 p-2">
                <img
                  src={URL.createObjectURL(proof)}
                  alt="Payment screenshot"
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                  {proof.name}
                </p>
                <button
                  type="button"
                  onClick={() => setProof(null)}
                  aria-label="Remove screenshot"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-hairline bg-surface-2 text-xs text-muted-foreground">
                <ImagePlus className="h-4 w-4 text-cyan" />
                Upload payment screenshot (required)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      // Copy into memory so the phone gallery link can't expire before upload.
                      const bytes = await file.arrayBuffer();
                      const type = file.type || "image/jpeg";
                      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
                      setProof(new File([bytes], `payment.${ext}`, { type }));
                    } catch {
                      toast.error(
                        "Yeh screenshot phone se read nahi ho saka. Gallery se dobara chunein ya pehle download kar ke lagayein.",
                      );
                    } finally {
                      event.target.value = "";
                    }
                  }}
                />
              </label>
            )}

            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Transaction ID or anything the office should know (optional)"
              className="rounded-2xl"
            />

            <p className="flex items-start gap-2 rounded-2xl border border-hairline bg-surface-2 p-3 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
              A screenshot never adds money by itself. The office checks it and enters the amount
              actually received — only that verified amount changes your totals.
            </p>

            <Button
              type="submit"
              variant="brand"
              size="xl"
              className="w-full rounded-2xl"
              disabled={submit.isPending || !proof || !method.trim()}
            >
              {submit.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {submit.isPending
                ? uploadPercent != null && uploadPercent < 100
                  ? `Uploading screenshot ${uploadPercent}%`
                  : "Submitting payment…"
                : "Submit payment for verification"}
            </Button>
          </form>
        </div>
      ) : null}

      {/* ---------- pending ---------- */}
      {pending.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <Clock className="h-4 w-4" /> Payment verification pending
          </p>
          {pending.map((row) => (
            <div key={row.id} className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-3">
              <p className="text-xs font-semibold">
                {formatPkr(row.claimed)} · {PURPOSE_LABEL[row.purpose] ?? row.purpose}
                {row.method ? ` · ${row.method}` : ""}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Submitted {formatDateTime(row.createdAt)} · remaining before verification{" "}
                {formatPkr(payLimit)}
              </p>
              {row.proofUrl ? (
                <a href={row.proofUrl} target="_blank" rel="noreferrer">
                  <img
                    src={row.proofUrl}
                    alt="Submitted screenshot"
                    className="mt-2 h-20 w-20 rounded-xl object-cover"
                  />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* ---------- history ---------- */}
      <div className="space-y-2">
        <p className="font-display text-sm font-semibold">Payment history</p>
        {history.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No payments submitted yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-[11px]"
              >
                <span className="font-semibold">
                  {formatDateTime(row.createdAt)} · {PURPOSE_LABEL[row.purpose] ?? row.purpose}
                </span>
                <span className="text-muted-foreground">
                  {formatPkr(row.status === "verified" ? row.verified : row.claimed)}
                  {row.method ? ` · ${row.method}` : ""}
                </span>
                <StatusChip status={row.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CcDeadlineNotice({
  cc,
}: {
  cc: { target: number; remaining: number; dueAt: string | null; ccDays: number; full: number; partial: number };
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (cc.remaining <= 0) {
    return (
      <p className="rounded-2xl border border-cyan/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-cyan">
        2CC amount complete.
      </p>
    );
  }
  const left = cc.dueAt ? new Date(cc.dueAt).getTime() - now : null;
  return (
    <div className="space-y-2 rounded-2xl border border-cyan/30 bg-cyan/5 p-3 text-xs leading-5">
      {cc.dueAt ? (
        <>
          <p className="text-muted-foreground">
            Apna 2CC <span className="font-bold text-foreground">{cc.ccDays} din</span> ke andar
            complete karein to target sirf{" "}
            <span className="font-bold text-cyan">{formatPkr(cc.full)}</span> hai. Warna target{" "}
            <span className="font-bold text-foreground">{formatPkr(cc.partial)}</span> ho jayega.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-3">
            <span className="flex items-center gap-2 font-semibold text-muted-foreground">
              <Clock className="h-4 w-4" /> 2CC time left
            </span>
            <span className="font-display text-xl font-bold tabular-nums text-cyan">
              {formatCountdown(left)}
            </span>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">
          Aap ka 2CC target <span className="font-bold text-foreground">{formatPkr(cc.target)}</span>{" "}
          hai. Remaining amount complete karein.
        </p>
      )}
    </div>
  );
}
