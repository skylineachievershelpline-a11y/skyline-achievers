import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { adminAssignInterviewSenior, adminListFinalInterviews } from "@/lib/interview-admin.functions";

const STAGE: Record<string, string> = {
  ready_for_interview: "Waiting",
  reassess: "Reassess",
  interview_passed: "Passed",
};

/** Admin hub: every Final Interview, with senior assignment by 12-digit ID. */
export function FinalInterviewHub() {
  const qc = useQueryClient();
  const list = useServerFn(adminListFinalInterviews);
  const assign = useServerFn(adminAssignInterviewSenior);
  const q = useQuery({ queryKey: ["admin-final-interviews"], queryFn: () => list() });
  const [ids, setIds] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: (v: { traineeId: string; seniorMemberId: string | null }) => assign({ data: v }),
    onSuccess: (r) => {
      toast.success(r.seniorName ? `Assigned to ${r.seniorName}` : "Senior removed");
      qc.invalidateQueries({ queryKey: ["admin-final-interviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <details className="group glass-panel metal-edge rounded-2xl p-5" open>
      <summary className="flex cursor-pointer items-center gap-2 font-display text-lg font-bold">
        <UserCheck className="h-5 w-5 text-primary" /> Final Interviews
      </summary>
      <p className="mt-1 text-xs text-muted-foreground">
        Assign a senior by member ID. The senior gets an alert and sees the interview on their dashboard to set the time and give marks.
      </p>
      {q.isLoading ? (
        <Loader2 className="mt-4 animate-spin" />
      ) : !q.data?.length ? (
        <p className="mt-4 text-sm text-muted-foreground">No trainees at Final Interview yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {q.data.map((r) => (
            <div key={r.traineeId} className="inset-panel rounded-2xl p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{r.name} <span className="text-muted-foreground">({r.code})</span></p>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">{STAGE[r.stage] ?? r.stage}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Upline: {r.upline ?? "—"} · Time: {r.scheduledAt ? formatDateTime(r.scheduledAt) : "Not set"}
                {r.marks != null ? ` · Marks: ${r.marks}/${r.maxMarks}` : ""}
              </p>
              <p className="mt-1 text-xs">Senior: <b>{r.senior ? `${r.senior.name} (${r.senior.memberId})` : "Upline (default)"}</b></p>
              {r.stage !== "interview_passed" ? (
                <div className="mt-2 flex gap-2">
                  <Input
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="Senior ID (12 digits)"
                    value={ids[r.traineeId] ?? ""}
                    onChange={(e) => setIds((s) => ({ ...s, [r.traineeId]: e.target.value.replace(/\D/g, "") }))}
                  />
                  <Button
                    size="sm"
                    disabled={m.isPending || (ids[r.traineeId] ?? "").length !== 12}
                    onClick={() => m.mutate({ traineeId: r.traineeId, seniorMemberId: ids[r.traineeId] })}
                  >Assign</Button>
                  {r.senior ? (
                    <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ traineeId: r.traineeId, seniorMemberId: null })}>Clear</Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
