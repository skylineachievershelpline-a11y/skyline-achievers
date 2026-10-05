import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pencil, Save, Trash2, Wallet } from "lucide-react";
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

type Method = { provider: string; accountTitle: string; accountNumber: string; note: string };
const EMPTY: Method = { provider: "Easypaisa", accountTitle: "", accountNumber: "", note: "" };

function PaymentMethodPage() {
  const load = useServerFn(getMyPaymentMethod);
  const save = useServerFn(saveMyPaymentMethod);
  const { data, refetch } = useQuery({ queryKey: ["my-payment-method"], queryFn: () => load() });
  const [methods, setMethods] = useState<Method[]>([]);
  const [form, setForm] = useState<Method>(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.methods) setMethods(data.methods.map((m) => ({ ...m, note: m.note ?? "" })));
  }, [data]);

  const full = methods.length >= 3 && editing === null;

  const persist = async (next: Method[], message: string) => {
    setBusy(true);
    try {
      await save({ data: { methods: next } });
      setMethods(next);
      toast.success(message);
      void refetch();
      return true;
    } catch {
      toast.error("Please fill account title and number correctly.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (full) return;
    const next = editing === null ? [...methods, form] : methods.map((m, i) => (i === editing ? form : m));
    if (await persist(next, editing === null ? "Payment method added" : "Payment method updated")) {
      setForm(EMPTY);
      setEditing(null);
    }
  };

  const onDelete = (index: number) => {
    if (!window.confirm("Delete this payment method?")) return;
    void persist(methods.filter((_, i) => i !== index), "Payment method deleted");
    if (editing === index) { setEditing(null); setForm(EMPTY); }
  };

  return (
    <MemberShell>
      <div className="mx-auto max-w-xl space-y-5">
        <header className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-brand-glow" />
          <h1 className="font-display text-xl font-semibold">My Payment Method</h1>
          <span className="ml-auto text-xs text-muted-foreground">{methods.length}/3</span>
        </header>
        <section className="glass-panel metal-edge space-y-4 rounded-3xl p-5">
          {full ? (
            <p className="text-sm text-muted-foreground">You have added the maximum of 3 payment methods. Edit or delete one below to change it.</p>
          ) : (
            <>
              <p className="text-sm font-semibold">{editing === null ? "Add a payment method" : "Edit payment method"}</p>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((p) => (
                  <Button key={p} type="button" size="sm" variant={form.provider === p ? "default" : "outline"} onClick={() => setForm({ ...form, provider: p })}>
                    {p}
                  </Button>
                ))}
              </div>
              <Input placeholder="Account title" value={form.accountTitle} onChange={(e) => setForm({ ...form, accountTitle: e.target.value })} />
              <Input placeholder="Account number / IBAN" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
              <Textarea placeholder="Note for the visitor (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={onSave} disabled={busy}>
                  <Save className="mr-2 h-4 w-4" /> {editing === null ? "Save payment method" : "Update payment method"}
                </Button>
                {editing !== null ? (
                  <Button variant="outline" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancel</Button>
                ) : null}
              </div>
            </>
          )}
        </section>

        {methods.length ? (
          <div className="space-y-3">
            {methods.map((m, i) => (
              <article key={i} className="glass-panel metal-edge rounded-3xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-glow">{m.provider}</p>
                    <p className="mt-1 break-words font-display text-lg font-semibold">{m.accountTitle}</p>
                    <p className="break-all font-mono text-sm text-cyan">{m.accountNumber}</p>
                    {m.note ? <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{m.note}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" aria-label="Edit payment method" onClick={() => { setEditing(i); setForm(m); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Delete payment method" disabled={busy} onClick={() => onDelete(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Copy your enrollment video link from the Beginners Sessions page. Visitors see these payment cards after tapping "See More".
        </p>
      </div>
    </MemberShell>
  );
}
