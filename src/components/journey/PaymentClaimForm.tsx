import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getReviewUploadUrl, submitPaymentClaim } from "@/lib/journey.functions";
import { uploadJourneyFile } from "./journey-upload";

type Profile = {
  fullName: string;
  phone: string | null;
  age: number | null;
  upline: { name: string; code: string } | null;
};

/**
 * Seat reservation / payment form. The screenshot is evidence only — the office
 * enters the amount actually received, so nothing is added here automatically.
 */
export function PaymentClaimForm({
  purpose,
  profile,
  defaultAmount,
  onSent,
}: {
  purpose: "mentorship" | "two_cc";
  profile: Profile;
  defaultAmount: number;
  onSent: () => void;
}) {
  const slot = useServerFn(getReviewUploadUrl);
  const send = useServerFn(submitPaymentClaim);

  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState(profile.age ? String(profile.age) : "");
  const [amount, setAmount] = useState(String(defaultAmount));
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!proof) throw new Error("Attach the payment screenshot — it is required.");
      const proofPath = await uploadJourneyFile(slot as never, proof);
      await send({
        data: {
          purpose,
          claimedAmount: Number(amount) || 0,
          proofPath,
          phone: phone.trim() || null,
          email: email.trim() || null,
          age: age ? Number(age) : null,
          note: [method.trim() ? `Method: ${method.trim()}` : null, note.trim() || null]
            .filter(Boolean)
            .join(" · ") || null,
        },
      } as never);
    },
    onSuccess: () => {
      toast.success("Sent for verification");
      setProof(null);
      setNote("");
      onSent();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="glass-panel metal-edge mt-5 space-y-3 rounded-3xl p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate();
      }}
    >
      <div>
        <p className="font-display text-sm font-semibold">
          {purpose === "mentorship" ? "Reserve your Personal Mentorship seat" : "Make a 2CC payment"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Your details are filled in from your account. The office checks the screenshot and enters
          the amount actually received.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={profile.fullName} readOnly className="h-11 rounded-2xl opacity-80" />
        </div>
        <div className="space-y-1.5">
          <Label>Upline</Label>
          <Input
            value={profile.upline ? `${profile.upline.name} (${profile.upline.code})` : "—"}
            readOnly
            className="h-11 rounded-2xl opacity-80"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email (optional)</Label>
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Age</Label>
          <Input
            value={age}
            onChange={(event) => setAge(event.target.value.replace(/\D/g, ""))}
            className="h-11 rounded-2xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Amount paid (Rs.)</Label>
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
            className="h-11 rounded-2xl tabular-nums"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Payment method</Label>
        <Input
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          placeholder="Easypaisa / JazzCash / bank transfer"
          className="h-11 rounded-2xl"
        />
      </div>

      {proof ? (
        <div className="glass-panel flex items-center gap-3 rounded-2xl p-2">
          <img
            src={URL.createObjectURL(proof)}
            alt="Payment screenshot"
            className="h-14 w-14 rounded-xl object-cover"
          />
          <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{proof.name}</p>
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
        <label className="glass-panel flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl text-xs text-muted-foreground">
          <ImagePlus className="h-4 w-4 text-brand-glow" />
          Payment screenshot (required)
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
        rows={3}
        placeholder="Anything the office should know (optional)"
        className="rounded-2xl"
      />

      <p className="flex items-start gap-2 rounded-2xl border border-hairline bg-surface-2 p-3 text-[11px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-glow" />
        A screenshot never adds money to your wallet. The office verifies the amount received and
        only that verified figure appears in your wallet.
      </p>

      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="w-full rounded-2xl"
        disabled={submit.isPending || !proof}
      >
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Send for verification
      </Button>
    </form>
  );
}
