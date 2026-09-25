import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, IdCard, Loader2, Plus, Save, ShieldCheck, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import {
  adminCreateMentorshipAccount,
  adminGetJourneyPolicy,
  adminGetPaymentSubmissions,
  adminSaveJourneyPolicy,
  adminVerifyPayment,
} from "@/lib/journey-admin.functions";

const PURPOSE_LABEL: Record<string, string> = {
  mentorship: "Personal Mentorship",
  two_cc: "2CC",
};

function pkr(value: number): string {
  return `Rs. ${Math.round(value).toLocaleString("en-PK")}`;
}

/** Payment verification centre plus the configurable journey policy values. */
export function JourneyTab() {
  const queryClient = useQueryClient();
  const loadRows = useServerFn(adminGetPaymentSubmissions);
  const loadPolicy = useServerFn(adminGetJourneyPolicy);
  const savePolicy = useServerFn(adminSaveJourneyPolicy);
  const verify = useServerFn(adminVerifyPayment);
  const createAccount = useServerFn(adminCreateMentorshipAccount);

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState<
    { name: string; accountTitle: string; accountNumber: string; instructions: string; qrUrl: string }[]
  >([]);
  const [form, setForm] = useState({
    mentorshipFeePkr: "",
    mentorshipDays: "",
    ccDays: "",
    ccTargetFullPayment: "",
    ccTargetPartial: "",
    mentorshipSeats: "",
  });

  const submissions = useQuery({
    queryKey: ["admin-payment-submissions"],
    queryFn: () => loadRows(),
    retry: false,
  });
  const policy = useQuery({
    queryKey: ["admin-journey-policy"],
    queryFn: () => loadPolicy(),
    retry: false,
  });

  useEffect(() => {
    const value = policy.data?.policy;
    if (!value) return;
    setForm({
      mentorshipFeePkr: String(value.mentorshipFeePkr),
      mentorshipDays: String(value.mentorshipDays),
      ccDays: String((value as any).ccDays ?? 5),
      ccTargetFullPayment: String(value.ccTargetFullPayment),
      ccTargetPartial: String(value.ccTargetPartial),
      mentorshipSeats: String(value.mentorshipSeats),
    });
    setMethods(((value as any).paymentMethods ?? []) as any[]);
  }, [policy.data]);

  const persistPolicy = useMutation({
    mutationFn: () =>
      savePolicy({
        data: {
          mentorshipFeePkr: Number(form.mentorshipFeePkr) || 0,
          mentorshipDays: Number(form.mentorshipDays) || 1,
          ccDays: Number((form as any).ccDays) || 5,
          ccTargetFullPayment: Number(form.ccTargetFullPayment) || 0,
          ccTargetPartial: Number(form.ccTargetPartial) || 0,
          mentorshipSeats: Number(form.mentorshipSeats) || 1,
          paymentMethods: methods
            .filter((entry) => entry.name.trim().length > 0)
            .map((entry) => ({
              name: entry.name.trim(),
              accountTitle: entry.accountTitle.trim(),
              accountNumber: entry.accountNumber.trim(),
              instructions: entry.instructions.trim(),
              qrUrl: entry.qrUrl.trim(),
            })),
        },
      } as never),
    onSuccess: () => {
      toast.success("Policy values saved");
      void queryClient.invalidateQueries({ queryKey: ["admin-journey-policy"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decide = useMutation({
    mutationFn: (values: { id: string; decision: "verified" | "rejected" }) =>
      verify({
        data: {
          id: values.id,
          decision: values.decision,
          verifiedAmount:
            values.decision === "verified" ? Number(amounts[values.id] ?? 0) || 0 : undefined,
          adminNote: notes[values.id]?.trim() || null,
        },
      } as never),
    onSuccess: () => {
      toast.success("Payment record updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-payment-submissions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const makeAccount = useMutation({
    mutationFn: (traineeId: string) => createAccount({ data: { traineeId } } as never),
    onSuccess: (result: any) => {
      const message = result.message ?? `Member ID: ${result.memberId}\nPassword: 00000000`;
      void navigator.clipboard?.writeText(message);
      toast.success(`Account ${result.memberId} created — login details copied`);
      void queryClient.invalidateQueries({ queryKey: ["admin-payment-submissions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = (submissions.data?.rows ?? []) as any[];
  const pending = rows.filter((row) => row.status === "pending");
  const settled = rows.filter((row) => row.status !== "pending");

  return (
    <div className="space-y-6">
      {/* ---------- policy ---------- */}
      <section className="glass-panel metal-edge rounded-2xl p-5">
        <p className="flex items-center gap-2 font-display text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-brand-glow" /> Journey policy values
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          These figures drive every wallet, target and countdown. Nothing is hard-coded.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { key: "mentorshipFeePkr", label: "Mentorship fee (Rs.)" },
            { key: "mentorshipDays", label: "Days to complete payment" },
            { key: "ccDays", label: "Days to complete 2CC (after mentorship)" },
            { key: "ccTargetFullPayment", label: "2CC target — full payment (Rs.)" },
            { key: "ccTargetPartial", label: "2CC target — partial payment (Rs.)" },
            { key: "mentorshipSeats", label: "Mentorship seats" },
          ].map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label>{field.label}</Label>
              <Input
                value={(form as any)[field.key]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [field.key]: event.target.value.replace(/\D/g, ""),
                  }))
                }
                className="h-10 rounded-xl tabular-nums"
              />
            </div>
          ))}
        </div>
        {/* ---------- payment methods members see ---------- */}
        <div className="mt-5 space-y-3">
          <p className="font-display text-sm font-semibold">Payment methods</p>
          <p className="text-[11px] text-muted-foreground">
            These are the only payment details members see. Nothing is invented by the app.
          </p>
          {methods.map((entry, index) => (
            <div key={index} className="raised-panel space-y-2 rounded-2xl p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { key: "name", label: "Method name (e.g. Easypaisa)" },
                  { key: "accountTitle", label: "Account title" },
                  { key: "accountNumber", label: "Account number" },
                ].map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label>{field.label}</Label>
                    <Input
                      value={(entry as any)[field.key] ?? ""}
                      onChange={(event) =>
                        setMethods((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, [field.key]: event.target.value } : row,
                          ),
                        )
                      }
                      className="h-10 rounded-xl"
                    />
                  </div>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Instructions (optional)</Label>
                  <Input
                    value={entry.instructions}
                    onChange={(event) =>
                      setMethods((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, instructions: event.target.value } : row,
                        ),
                      )
                    }
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>QR code image link (optional)</Label>
                  <Input
                    value={entry.qrUrl}
                    onChange={(event) =>
                      setMethods((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, qrUrl: event.target.value } : row,
                        ),
                      )
                    }
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-destructive"
                onClick={() =>
                  setMethods((current) => current.filter((_, rowIndex) => rowIndex !== index))
                }
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() =>
              setMethods((current) => [
                ...current,
                { name: "", accountTitle: "", accountNumber: "", instructions: "", qrUrl: "" },
              ])
            }
          >
            <Plus className="h-4 w-4" /> Add payment method
          </Button>
        </div>

        <Button
          variant="brand"
          className="mt-4 rounded-xl"
          disabled={persistPolicy.isPending}
          onClick={() => persistPolicy.mutate()}
        >
          {persistPolicy.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save policy
        </Button>
      </section>

      {/* ---------- verification ---------- */}
      <section className="glass-panel metal-edge rounded-2xl p-5">
        <p className="flex items-center gap-2 font-display text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-brand-glow" /> Payment verification
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          A screenshot is evidence only. Type the amount actually received — that verified figure is
          the only thing added to the wallet.
        </p>

        {submissions.isPending ? (
          <p className="mt-4 text-xs text-muted-foreground">Loading claims…</p>
        ) : pending.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">No payment claims waiting.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pending.map((row) => (
              <li key={row.id} className="raised-panel rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {row.payerName}{" "}
                      <span className="text-[11px] text-muted-foreground">{row.payerCode}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {PURPOSE_LABEL[row.purpose] ?? row.purpose} · claimed {pkr(row.claimed)}
                      {row.method ? ` · ${row.method}` : ""} · {formatDateTime(row.createdAt)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Upline: {row.uplineName ?? "—"} {row.uplineCode ? `(${row.uplineCode})` : ""}
                    </p>
                    {row.phone || row.email ? (
                      <p className="text-[11px] text-muted-foreground">
                        {[row.phone, row.email].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    {row.note ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{row.note}</p>
                    ) : null}
                  </div>
                  {row.proofUrl ? (
                    <a href={row.proofUrl} target="_blank" rel="noreferrer" className="shrink-0">
                      <img
                        src={row.proofUrl}
                        alt="Payment screenshot"
                        className="h-24 w-24 rounded-xl object-cover"
                      />
                    </a>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Verified amount received (Rs.)</Label>
                    <Input
                      value={amounts[row.id] ?? ""}
                      onChange={(event) =>
                        setAmounts((current) => ({
                          ...current,
                          [row.id]: event.target.value.replace(/\D/g, ""),
                        }))
                      }
                      placeholder={String(row.claimed)}
                      className="h-10 rounded-xl tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note (optional)</Label>
                    <Input
                      value={notes[row.id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="brand"
                    size="sm"
                    className="rounded-xl"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: row.id, decision: "verified" })}
                  >
                    Verify amount
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-xl"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: row.id, decision: "rejected" })}
                  >
                    Reject
                  </Button>
                  {row.purpose === "mentorship" && row.payerKind === "trainee" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={makeAccount.isPending}
                      onClick={() => makeAccount.mutate(row.payerId)}
                    >
                      {makeAccount.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <IdCard className="h-4 w-4" />
                      )}
                      Create mentorship account
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {settled.length > 0 ? (
          <div className="mt-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Checked payments
            </p>
            <ul className="mt-2 space-y-1.5">
              {settled.slice(0, 40).map((row) => (
                <li
                  key={row.id}
                  className="glass-panel flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px]"
                >
                  <span className="font-semibold">
                    {row.payerName} · {PURPOSE_LABEL[row.purpose] ?? row.purpose}
                  </span>
                  <span className="text-muted-foreground">
                    claimed {pkr(row.claimed)} · verified {pkr(row.verified)}
                    {row.method ? ` · ${row.method}` : ""} ·{" "}
                    {row.status === "verified" ? "Verified" : "Rejected"}
                    {row.verifiedAt ? ` · ${formatDateTime(row.verifiedAt)}` : ""}
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-brand"
                    aria-label="Copy member name"
                    onClick={() => void navigator.clipboard?.writeText(row.payerName)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
