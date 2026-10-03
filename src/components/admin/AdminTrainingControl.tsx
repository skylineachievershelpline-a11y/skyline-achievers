/** Admin: see and override a member's mandatory Skyline AI training. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { adminGetTraining, adminSetTrainingComplete } from "@/lib/training.functions";

export function AdminTrainingControl({ memberId }: { memberId: string }) {
  const load = useServerFn(adminGetTraining);
  const save = useServerFn(adminSetTrainingComplete);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-training", memberId], queryFn: () => load({ data: { id: memberId } }), retry: false });
  const m = useMutation({
    mutationFn: (complete: boolean) => save({ data: { id: memberId, complete } }),
    onSuccess: () => {
      toast.success("Training status updated");
      void qc.invalidateQueries({ queryKey: ["admin-training", memberId] });
    },
    onError: () => toast.error("Could not update training"),
  });
  if (!q.data) return null;
  const passed = Object.entries(q.data.chapters).filter(([, v]) => (v as { passed?: boolean }).passed).length;
  return (
    <div className="mx-auto mb-4 flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-cyan/25 px-4 py-3 text-sm">
      <GraduationCap className="h-4 w-4 text-cyan" />
      <span className="flex-1">
        Mandatory training: {q.data.adminCompleted ? "Completed by admin" : q.data.locked ? `Locked (chapter ${q.data.current}, ${passed} passed)` : q.data.required ? "Complete" : "Not required for this rank"}
      </span>
      <Button size="sm" variant={q.data.adminCompleted ? "outline" : "brand"} disabled={m.isPending} onClick={() => m.mutate(!q.data.adminCompleted)}>
        {q.data.adminCompleted ? "Undo admin completion" : "Mark training complete"}
      </Button>
    </div>
  );
}
