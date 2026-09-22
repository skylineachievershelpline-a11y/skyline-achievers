import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Check, Loader2, UserCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { VoiceRecorder } from "@/components/media/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime12 } from "@/lib/format";
import {
  getReviewUploadUrl,
  getUplineReviewRequests,
  recordInterviewResult,
  reviewSessionSubmission,
} from "@/lib/journey.functions";
import { uploadJourneyFile } from "./journey-upload";

/**
 * Requests waiting for the upline, right at the top of the dashboard: every
 * session review sent by a trainee (newest first) plus the final interview
 * results that are due. Approve or reject with a note or a voice reply.
 */
export function UplineRequestsPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(getUplineReviewRequests);
  const slot = useServerFn(getReviewUploadUrl);
  const decide = useServerFn(reviewSessionSubmission);
  const interview = useServerFn(recordInterviewResult);

  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [voice, setVoice] = useState<File | null>(null);

  const { data } = useQuery({
    queryKey: ["upline-review-requests"],
    queryFn: () => load(),
    retry: false,
  });

  function refresh() {
    setNote("");
    setVoice(null);
    setOpenId(null);
    void queryClient.invalidateQueries({ queryKey: ["upline-review-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["upline-action-queue"] });
  }

  const send = useMutation({
    mutationFn: async (values: { reviewId: string; decision: "approved" | "rejected" }) => {
      const voicePath = voice ? await uploadJourneyFile(slot as never, voice) : null;
      await decide({
        data: {
          reviewId: values.reviewId,
          decision: values.decision,
          note: note.trim() || null,
          voicePath,
        },
      } as never);
    },
    onSuccess: () => {
      toast.success("Decision saved");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const result = useMutation({
    mutationFn: (values: { traineeId: string; result: "pass" | "reassess" }) =>
      interview({ data: { ...values, note: note.trim() || null } } as never),
    onSuccess: () => {
      toast.success("Interview result saved");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reviews = (data?.reviews ?? []) as any[];
  const interviews = (data?.interviews ?? []) as any[];
  if (reviews.length === 0 && interviews.length === 0) return null;

  return (
    <section className="raised-panel metal-edge rounded-3xl p-5 animate-rise-in">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-brand-glow">
          <BellRing className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Requests</p>
          <p className="text-[11px] text-muted-foreground">
            {reviews.length} session review{reviews.length === 1 ? "" : "s"} and{" "}
            {interviews.length} interview decision{interviews.length === 1 ? "" : "s"} waiting
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {reviews.map((row) => {
          const open = openId === row.reviewId;
          return (
            <li key={row.reviewId} className="glass-panel rounded-2xl p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Session {String(row.sessionNumber).padStart(2, "0")} ·{" "}
                    {row.submittedAt ? formatDateTime12(row.submittedAt) : "Just now"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={open ? "outline" : "brand"}
                  className="shrink-0 rounded-xl"
                  onClick={() => {
                    setNote("");
                    setVoice(null);
                    setOpenId(open ? null : row.reviewId);
                  }}
                >
                  {open ? "Close" : "Review now"}
                </Button>
              </div>

              {open ? (
                <div className="mt-3 space-y-3">
                  <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs">
                    {row.body}
                  </p>
                  {row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt="Review picture"
                      className="max-h-64 w-full rounded-xl object-contain"
                    />
                  ) : null}
                  {row.voiceUrl ? (
                    <audio controls src={row.voiceUrl} className="w-full" />
                  ) : null}
                  <div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                    <p>
                      Scheduled: {row.scheduledAt ? formatDateTime12(row.scheduledAt) : "—"}
                    </p>
                    <p>Opened: {row.openedAt ? formatDateTime12(row.openedAt) : "Not recorded"}</p>
                  </div>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="Note for the trainee (required when you reject)"
                    className="rounded-2xl"
                  />
                  <VoiceRecorder value={voice} onChange={setVoice} label="Voice reply (optional)" />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="brand"
                      className="flex-1 rounded-2xl"
                      disabled={send.isPending}
                      onClick={() =>
                        send.mutate({ reviewId: row.reviewId, decision: "approved" })
                      }
                    >
                      {send.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-2xl"
                      disabled={send.isPending}
                      onClick={() =>
                        send.mutate({ reviewId: row.reviewId, decision: "rejected" })
                      }
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}

        {interviews.map((row) => {
          const open = openId === `interview-${row.traineeId}`;
          return (
            <li key={row.traineeId} className="glass-panel rounded-2xl p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Final interview decision waiting
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={open ? "outline" : "brand"}
                  className="shrink-0 rounded-xl"
                  onClick={() => {
                    setNote("");
                    setOpenId(open ? null : `interview-${row.traineeId}`);
                  }}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  {open ? "Close" : "Decide"}
                </Button>
              </div>
              {open ? (
                <div className="mt-3 space-y-3">
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="Interview note (optional)"
                    className="rounded-2xl"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="brand"
                      className="flex-1 rounded-2xl"
                      disabled={result.isPending}
                      onClick={() => result.mutate({ traineeId: row.traineeId, result: "pass" })}
                    >
                      Pass
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-2xl"
                      disabled={result.isPending}
                      onClick={() =>
                        result.mutate({ traineeId: row.traineeId, result: "reassess" })
                      }
                    >
                      Reassess
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
