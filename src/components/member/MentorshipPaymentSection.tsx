import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Clock,
  Copy,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { uploadJourneyFile } from "@/components/journey/journey-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { getReviewUploadUrl } from "@/lib/journey.functions";
import { getMyPaymentCentre, submitMemberPaymentClaim } from "@/lib/member-payments.functions";
import { formatPkr } from "@/lib/mentorship";

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

/**
 * The complete Personal Mentorship payment journey on the member dashboard:
 * where to pay, how much is left, the screenshot upload, the pending claims and
 * the full payment history. Verified totals only ever change after the office
 * checks a claim.
 */
export function MentorshipPaymentSection() {
  const queryClient = useQueryClient();
  const load = useServerFn(getMyPaymentCentre);
  const slot = useServerFn(getReviewUploadUrl);
  const send = useServerFn(submitMemberPaymentClaim);

  const { data, isPending } = useQuery({
    queryKey: ["member-payment-centre"],
    queryFn: () => load(),
    retry: false,
  });

  const [method, setMethod] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Please wait — loading your payment details.");
      if (!method) throw new Error("Choose the payment method you used.");
      const value = Number(amount) || 0;
      if (value <= 0) throw new Error("Enter the amount you paid.");
      if (value > data.mentorship.remaining) {
        throw new Error(
          `That is more than your remaining amount of ${formatPkr(data.mentorship.remaining)}.`,
        );
      }
      if (!proof) throw new Error("Attach the payment screenshot — it is required.");
      const proofPath = await uploadJourneyFile(slot as never, proof);
      await send({
        data: {
          purpose: "mentorship" as const,
          claimedAmount: value,
          method,
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
      void queryClient.invalidateQueries({ queryKey: ["member-payment-centre"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending || !data) return null;

  const { mentorship, cc, methods, policy, history } = data;
  const pending = history.filter((row) => row.status === "pending");
  const selected = methods.find((entry) => entry.name === method) ?? null;
  const percent = mentorship.required
    ? Math.min(100, Math.round((mentorship.verified / mentorship.required) * 100))
    : 100;

  return (
    <section
      id="pay-mentorship"
      className="raised-panel metal-edge scroll-mt-24 space-y-5 rounded-3xl p-5"
    >
      {/* ---------- summary ---------- */}
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-cyan" />
        <h2 className="font-display text-base font-semibold">Personal Mentorship payment</h2>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold tabular-nums">
            {formatPkr(mentorship.required)}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Total</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold tabular-nums text-cyan">
            {formatPkr(mentorship.verified)}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">
            Verified paid
          </p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
          <p className="font-display text-sm font-bold tabular-nums">
            {formatPkr(mentorship.remaining)}
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
      ) : (
        <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs font-semibold text-amber-300">
          Complete your Personal Mentorship amount within {policy.mentorshipDays} days to keep the
          lower 2CC target of {formatPkr(policy.ccTargetFullPayment)}. After that the applicable
          target is {formatPkr(policy.ccTargetPartial)}. Your account is never suspended for this.
        </p>
      )}

      {/* ---------- where to pay ---------- */}
      {!mentorship.complete ? (
        <div className="space-y-3">
          <div>
            <p className="font-display text-sm font-semibold">Complete Personal Mentorship payment</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Remaining amount: {formatPkr(mentorship.remaining)}
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

              <div className="grid gap-2 sm:grid-cols-2">
                {methods.map((entry) => (
                  <button
                    key={entry.name}
                    type="button"
                    onClick={() => setMethod(entry.name)}
                    className={`rounded-2xl border p-3 text-left transition-colors ${
                      method === entry.name
                        ? "border-cyan/60 bg-primary/10"
                        : "border-hairline bg-surface-2 hover:border-cyan/30"
                    }`}
                  >
                    <p className="text-sm font-semibold">{entry.name}</p>
                    {entry.accountTitle ? (
                      <p className="text-[11px] text-muted-foreground">{entry.accountTitle}</p>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected ? (
            <div className="space-y-2 rounded-2xl border border-hairline bg-surface p-3">
              {selected.accountTitle ? (
                <p className="text-xs">
                  <span className="text-muted-foreground">Account title: </span>
                  <span className="font-semibold">{selected.accountTitle}</span>
                </p>
              ) : null}
              {selected.accountNumber ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs">
                    <span className="text-muted-foreground">Account number: </span>
                    <span className="font-semibold tabular-nums">{selected.accountNumber}</span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    aria-label="Copy account number"
                    onClick={() => {
                      void navigator.clipboard?.writeText(selected.accountNumber);
                      toast.success("Account number copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
              {selected.instructions ? (
                <p className="whitespace-pre-wrap text-[11px] text-muted-foreground">
                  {selected.instructions}
                </p>
              ) : null}
              {selected.qrUrl ? (
                <img
                  src={selected.qrUrl}
                  alt={`${selected.name} QR code`}
                  className="h-40 w-40 rounded-2xl border border-hairline object-contain"
                />
              ) : null}
            </div>
          ) : null}

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
                placeholder={String(mentorship.remaining)}
                onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
                className="h-11 rounded-2xl tabular-nums"
              />
              <p className="text-[11px] text-muted-foreground">
                Cannot be more than {formatPkr(mentorship.remaining)}.
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
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) setProof(file);
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
              disabled={submit.isPending || !proof || !method}
            >
              {submit.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Submit payment for verification
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
                {formatPkr(mentorship.remaining)}
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
