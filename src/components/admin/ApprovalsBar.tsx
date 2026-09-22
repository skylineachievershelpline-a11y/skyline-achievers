import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { adminDecideEnrollment } from "@/lib/admin-courses.functions";
import { adminDecideLeave, adminGetApprovals } from "@/lib/admin-reports.functions";
import { adminGetPaymentSubmissions } from "@/lib/journey-admin.functions";
import { formatDate } from "@/lib/format";

/** Everything waiting for approval, pinned at the top of the admin panel. */
export function ApprovalsBar() {
  const queryClient = useQueryClient();
  const load = useServerFn(adminGetApprovals);
  const decideLeave = useServerFn(adminDecideLeave);
  const decideCourse = useServerFn(adminDecideEnrollment);

  const loadPayments = useServerFn(adminGetPaymentSubmissions);

  const { data } = useQuery({
    queryKey: ["admin-approvals"],
    queryFn: () => load(),
    refetchInterval: 60_000,
    retry: false,
  });
  // New payment claims and account requests appear at the top of the panel too.
  const payments = useQuery({
    queryKey: ["admin-payment-submissions"],
    queryFn: () => loadPayments(),
    refetchInterval: 60_000,
    retry: false,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-approvals"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
  };

  const leave = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "rejected" }) =>
      decideLeave({ data: input } as never),
    onSuccess: (_result, input) => {
      toast.success(`Leave ${input.status}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const course = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "rejected" }) =>
      decideCourse({ data: input } as never),
    onSuccess: (_result, input) => {
      toast.success(`Course payment ${input.status}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pendingPayments = (payments.data?.rows ?? []).filter(
    (row: any) => row.status === "pending",
  ) as any[];
  const total =
    (data?.leaves.length ?? 0) + (data?.courses.length ?? 0) + pendingPayments.length;
  if (total === 0) return null;

  return (
    <section className="glass-panel metal-edge mb-6 rounded-3xl p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan/30 bg-primary/12 text-cyan">
          <BellRing className="h-4 w-4" />
        </span>
        <div>
          <p className="font-display text-sm font-bold">Waiting for your approval</p>
          <p className="text-[11px] text-muted-foreground">
            {total} request{total === 1 ? "" : "s"} pending
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {(data?.leaves ?? []).map((item) => (
          <li
            key={item.id}
            className="inset-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                Leave request — {item.memberName}{" "}
                <span className="text-xs font-normal text-muted-foreground">{item.memberCode}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatDate(item.fromDate)} — {formatDate(item.toDate)}
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {item.reason}
              </p>
            </div>
            <Actions
              busy={leave.isPending}
              onApprove={() => leave.mutate({ id: item.id, status: "approved" })}
              onReject={() => leave.mutate({ id: item.id, status: "rejected" })}
            />
          </li>
        ))}

        {pendingPayments.map((item) => (
          <li
            key={item.id}
            className="inset-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {item.purpose === "mentorship" ? "Personal Mentorship payment" : "2CC payment"} —{" "}
                {item.payerName}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {item.payerCode ?? "—"} · {item.method ?? "Method not given"} · PKR{" "}
                {item.claimed.toLocaleString("en-PK")} · upline {item.uplineName ?? "—"}
              </p>
              <p className="mt-1 text-[11px] text-cyan">
                Open the Journey &amp; Payments tab to enter the verified amount.
              </p>
            </div>
          </li>
        ))}

        {(data?.courses ?? []).map((item) => (
          <li
            key={item.id}
            className="inset-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                Course payment — {item.courseTitle}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {item.buyerName} · {item.buyerCode} · PKR {item.amount.toLocaleString("en-PK")}
              </p>
            </div>
            <Actions
              busy={course.isPending}
              onApprove={() => course.mutate({ id: item.id, status: "approved" })}
              onReject={() => course.mutate({ id: item.id, status: "rejected" })}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Actions({
  busy,
  onApprove,
  onReject,
}: {
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button variant="brand" size="sm" className="rounded-2xl" disabled={busy} onClick={onApprove}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Approve
      </Button>
      <Button variant="outline" size="sm" className="rounded-2xl" disabled={busy} onClick={onReject}>
        <X className="h-4 w-4" />
        Reject
      </Button>
    </div>
  );
}
