import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import {
  MemberShell,
  TrainingOnlyLock,
  useMemberGuard,
  useTrainingOnly,
} from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDailyReport, submitLeaveApplication } from "@/lib/daily-report.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/leave")({
  head: () => ({
    meta: [
      { title: "Leave Application — Skyline Achievers" },
      {
        name: "description",
        content:
          "Send a leave application to your Skyline Achievers administrator and track its approval.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Leave Application — Skyline Achievers" },
      { property: "og:description", content: "Request approved leave days from your admin." },
    ],
  }),
  component: LeavePage,
});

const STATUS_STYLE: Record<string, string> = {
  pending: "border-metal/30 bg-surface-2 text-muted-foreground",
  approved: "border-cyan/35 bg-primary/12 text-cyan",
  rejected: "border-destructive/45 bg-destructive/12 text-destructive",
};

function LeavePage() {
  const ready = useMemberGuard();
  const trainingOnly = useTrainingOnly();
  const queryClient = useQueryClient();
  const load = useServerFn(getDailyReport);
  const send = useServerFn(submitLeaveApplication);

  const { data, isPending } = useQuery({
    queryKey: ["daily-report"],
    queryFn: () => load(),
    enabled: ready,
  });

  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState("");

  const submit = useMutation({
    mutationFn: () => send({ data: { fromDate, toDate, reason } } as never),
    onSuccess: () => {
      toast.success("Application sent to your admin");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["daily-report"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (trainingOnly) {
    return (
      <MemberShell title="Leave Application">
        <TrainingOnlyLock area="Leave Application" />
      </MemberShell>
    );
  }

  return (
    <MemberShell title="Leave Application" subtitle="Ask your admin for approved leave days">
      {!ready || isPending ? (
        <div className="flex justify-center py-16">
          <SkylineLoader />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <section className="raised-panel metal-edge rounded-3xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Application form
            </p>
            <h2 className="mt-1 font-display text-xl font-bold">Request leave</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Leave counts only after your admin approves it. Approved days are never marked as a
              missed report.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (reason.trim().length < 25) {
                  toast.error("Please write a proper application (at least 25 characters).");
                  return;
                }
                submit.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="leave-from">Leave from</Label>
                  <Input
                    id="leave-from"
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leave-to">Leave until</Label>
                  <Input
                    id="leave-to"
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leave-reason">Reason for leave</Label>
                <Textarea
                  id="leave-reason"
                  rows={5}
                  placeholder="Write your application here so your admin can approve it."
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                variant="brand"
                className="w-full rounded-2xl sm:w-auto"
                disabled={submit.isPending}
              >
                {submit.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit application
              </Button>
            </form>
          </section>

          <section className="raised-panel metal-edge rounded-3xl p-5">
            <h3 className="font-display text-lg font-bold">Your applications</h3>
            {(data?.leaves.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No applications sent yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data!.leaves.map((leave) => (
                  <li key={leave.id} className="inset-panel rounded-2xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <CalendarCheck className="h-4 w-4 text-brand-glow" />
                        {formatDate(leave.fromDate)} — {formatDate(leave.toDate)}
                      </p>
                      <span
                        className={`rounded-xl border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                          STATUS_STYLE[leave.status] ?? STATUS_STYLE["pending"]
                        }`}
                      >
                        {leave.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {leave.reason}
                    </p>
                    {leave.adminNote ? (
                      <p className="mt-2 text-xs font-medium text-cyan">Admin: {leave.adminNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </MemberShell>
  );
}
