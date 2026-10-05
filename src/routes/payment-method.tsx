import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, Save, Wallet } from "lucide-react";
import { toast } from "sonner";

import { MemberShell } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getMyPaymentMethod, saveMyPaymentMethod } from "@/lib/fbo-payment.functions";

export const Route = createFileRoute("/payment-method")({
  head: () => ({
    meta: [
      { title: "My Payment Method — Skyline Achievers" },
      { name: "description", content: "Add the payment method shown on your enrollment video link." },
      { property: "og:title", content: "My Payment Method — Skyline Achievers" },
      { property: "og:description", content: "Add the payment method shown on your enrollment video link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentMethodPage,
});

const PROVIDERS = ["Easypaisa", "JazzCash", "Bank Transfer"];

function PaymentMethodPage() {
  const load = useServerFn(getMyPaymentMethod);
  const save = useServerFn(saveMyPaymentMethod);
  const { data, refetch } = useQuery({ queryKey: ["my-payment-method"], queryFn: () => load() });
  const [form, setForm] = useState({ provider: "Easypaisa", accountTitle: "", accountNumber: "", note: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.method) setForm({ ...data.method, note: data.method.note ?? "" });
  }, [data]);


  const onSave = async () => {
    setBusy(true);
    try {
      await save({ data: form });
      toast.success("Payment method saved");
      void refetch();
    } catch {
      toast.error("Please fill account title and number correctly.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MemberShell>
      <div className="mx-auto max-w-xl space-y-5">
        <header className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-brand-glow" />
          <h1 className="font-display text-xl font-semibold">My Payment Method</h1>
        </header>
        <section className="glass-panel metal-edge space-y-4 rounded-3xl p-5">
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={form.provider === p ? "default" : "outline"}
                onClick={() => setForm({ ...form, provider: p })}
              >
                {p}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Account title"
            value={form.accountTitle}
            onChange={(e) => setForm({ ...form, accountTitle: e.target.value })}
          />
          <Input
            placeholder="Account number / IBAN"
            value={form.accountNumber}
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
          />
          <Textarea
            placeholder="Note for the visitor (optional)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <Button className="w-full" onClick={onSave} disabled={busy}>
            <Save className="mr-2 h-4 w-4" /> Save payment method
          </Button>
        </section>
        <p className="text-xs text-muted-foreground">
          Copy your enrollment video link from the Beginners Sessions page. Visitors see this payment card after tapping "See More".
        </p>
      </div>
    </MemberShell>
  );
}
