import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  RotateCcw,
  Save,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { VoiceRecorder } from "@/components/media/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { BASIC_SESSION_COUNT, SESSION_PLAN, type JourneySession } from "@/lib/journey";
import {
  getReviewUploadUrl,
  getTraineeJourneyForUpline,
  recordInterviewResult,
  reviewSessionSubmission,
  saveTraineeSchedule,
} from "@/lib/journey.functions";
import { createSchedulePoster } from "@/lib/journey-poster";
import { uploadJourneyFile } from "./journey-upload";

const STAGE_LABEL: Record<string, string> = {
  sessions: "Basic training sessions",
  interview_guide: "Final interview guide",
  ready_for_interview: "Ready for final interview",
  interview_passed: "Interview passed",
  reassess: "Reassess / retrain",
  mentorship: "Personal Mentorship",
};

function toLocalInput(value: string | null, fallback: Date | null): string {
  const date = value ? new Date(value) : fallback;
  if (!date) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Everything an upline does for one trainee: timings, poster, reviews, interview. */
export function UplineJourneyDialog({
  traineeId,
  traineeName,
  traineePhone,
  uplineName,
  onClose,
}: {
  traineeId: string;
  traineeName: string;
  traineePhone: string | null;
  uplineName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getTraineeJourneyForUpline);
  const saveSchedule = useServerFn(saveTraineeSchedule);
  const decide = useServerFn(reviewSessionSubmission);
  const interview = useServerFn(recordInterviewResult);
  const slot = useServerFn(getReviewUploadUrl);

  const [slots, setSlots] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [voice, setVoice] = useState<File | null>(null);
  const [interviewNote, setInterviewNote] = useState("");
  const [posterBusy, setPosterBusy] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["upline-journey", traineeId],
    queryFn: () => load({ data: { traineeId } } as never),
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    const start = new Date();
    start.setDate(start.getDate() + 1);
    const next: Record<number, string> = {};
    for (const plan of SESSION_PLAN) {
      const existing = (data.sessions as JourneySession[]).find(
        (item) => item.sessionNumber === plan.session,
      );
      const fallback = new Date(start);
      fallback.setDate(start.getDate() + (plan.day - 1));
      const [hour, minute] = plan.time.split(":");
      fallback.setHours(Number(hour), Number(minute), 0, 0);
      next[plan.session] = toLocalInput(existing?.scheduledAt ?? null, fallback);
    }
    setSlots(next);
  }, [data]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["upline-journey", traineeId] });
    void queryClient.invalidateQueries({ queryKey: ["upline-action-queue"] });
  }

  const persist = useMutation({
    mutationFn: () =>
      saveSchedule({
        data: {
          traineeId,
          slots: SESSION_PLAN.map((plan) => ({
            sessionNumber: plan.session,
            dayNumber: plan.day,
            scheduledAt: new Date(slots[plan.session] ?? "").toISOString(),
          })),
        },
      } as never),
    onSuccess: () => {
      toast.success("Session timings saved");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const review = useMutation({
    mutationFn: async (values: { reviewId: string; decision: "approved" | "rejected" }) => {
      const voicePath = voice ? await uploadJourneyFile(slot as never, voice) : null;
      if (values.decision === "rejected" && !note.trim() && !voicePath) {
        throw new Error("Write a note or record a voice note before rejecting.");
      }
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
      toast.success("Review saved");
      setNote("");
      setVoice(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const result = useMutation({
    mutationFn: (value: "pass" | "reassess") =>
      interview({
        data: { traineeId, result: value, note: interviewNote.trim() || null },
      } as never),
    onSuccess: () => {
      toast.success("Interview result saved");
      setInterviewNote("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function buildPoster(share: boolean) {
    if (!data) return;
    setPosterBusy(true);
    try {
      const blob = await createSchedulePoster({
        traineeName,
        traineeCode: (data.profile as any).code,
        avatarUrl: (data.profile as any).avatarUrl ?? null,
        uplineName,
        sessions: (data.sessions as JourneySession[]).slice(0, BASIC_SESSION_COUNT).map((item) => ({
          sessionNumber: item.sessionNumber,
          dayNumber: item.dayNumber,
          title: item.title,
          thumbnailUrl: item.thumbnailUrl,
          scheduledAt: item.scheduledAt,
        })),
      });
      const file = new File([blob], `skyline-schedule-${(data.profile as any).code}.png`, {
        type: "image/png",
      });
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Training schedule" });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the poster");
    } finally {
      setPosterBusy(false);
    }
  }

  const pending = data
    ? (data.sessions as JourneySession[]).find((item) => item.review === "pending")
    : null;

  const whatsappText = encodeURIComponent(
    `Assalam o Alaikum ${traineeName}, main ${uplineName} — Skyline Achievers. Aap ka training schedule set ho gaya hai. Session apne time par zaroor attend karein.`,
  );
  const whatsappNumber = (traineePhone ?? "").replace(/\D/g, "");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{traineeName} — training journey</DialogTitle>
        </DialogHeader>

        {isPending || !data ? (
          <div className="flex justify-center py-10">
            <SkylineLoader />
          </div>
        ) : (
          <div className="space-y-5">
            <p className="glass-panel rounded-2xl px-4 py-3 text-xs text-muted-foreground">
              Current stage:{" "}
              <span className="font-semibold text-foreground">
                {STAGE_LABEL[data.stage] ?? data.stage}
              </span>
            </p>

            {/* ---------- schedule ---------- */}
            <section>
              <p className="flex items-center gap-2 font-display text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-brand-glow" /> Schedule session timings
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Official timings are filled in already. Change them to suit this trainee.
              </p>
              <div className="mt-3 space-y-2">
                {SESSION_PLAN.map((plan) => (
                  <div key={plan.session} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[11px] text-muted-foreground">
                      Day {String(plan.day).padStart(2, "0")} · S
                      {String(plan.session).padStart(2, "0")}
                    </span>
                    <Input
                      type="datetime-local"
                      value={slots[plan.session] ?? ""}
                      onChange={(event) =>
                        setSlots((current) => ({ ...current, [plan.session]: event.target.value }))
                      }
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button
                  variant="brand"
                  className="rounded-2xl"
                  disabled={persist.isPending}
                  onClick={() => persist.mutate()}
                >
                  {persist.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save timings
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  disabled={posterBusy}
                  onClick={() => void buildPoster(true)}
                >
                  {posterBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  Generate schedule poster
                </Button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  disabled={posterBusy}
                  onClick={() => void buildPoster(false)}
                >
                  <Download className="h-4 w-4" /> Download poster
                </Button>
                {whatsappNumber ? (
                  <Button asChild variant="outline" className="rounded-2xl">
                    <a
                      href={`https://wa.me/${whatsappNumber}?text=${whatsappText}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp this trainee
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" className="rounded-2xl" disabled>
                    <MessageCircle className="h-4 w-4" /> No phone saved
                  </Button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                WhatsApp opens with the message ready — nothing is sent until you press send.
              </p>
            </section>

            {/* ---------- pending review ---------- */}
            {pending ? (
              <section className="raised-panel rounded-3xl p-4">
                <p className="font-display text-sm font-semibold">
                  Review — Day {String(pending.dayNumber).padStart(2, "0")} · Session{" "}
                  {String(pending.sessionNumber).padStart(2, "0")}
                </p>
                {pending.reviewBody ? (
                  <p className="mt-2 whitespace-pre-line rounded-2xl bg-surface-2 p-3 text-xs leading-relaxed">
                    {pending.reviewBody}
                  </p>
                ) : null}
                {pending.reviewImageUrl ? (
                  <img
                    src={pending.reviewImageUrl}
                    alt="Trainee review picture"
                    className="mt-2 max-h-56 w-full rounded-2xl object-cover"
                  />
                ) : null}
                {pending.reviewVoiceUrl ? (
                  <audio controls src={pending.reviewVoiceUrl} className="mt-2 w-full" />
                ) : null}

                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Your written feedback"
                  className="mt-3 rounded-2xl"
                />
                <div className="mt-2">
                  <VoiceRecorder value={voice} onChange={setVoice} label="Voice feedback (optional)" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="brand"
                    className="rounded-2xl"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate({ reviewId: pending.reviewId!, decision: "approved" })
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-2xl"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate({ reviewId: pending.reviewId!, decision: "rejected" })
                    }
                  >
                    <RotateCcw className="h-4 w-4" /> Reject — do it again
                  </Button>
                </div>
              </section>
            ) : null}

            {/* ---------- interview result ---------- */}
            {data.stage === "ready_for_interview" ? (
              <section className="raised-panel rounded-3xl p-4">
                <p className="flex items-center gap-2 font-display text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-brand-glow" /> Final interview result
                </p>
                <Textarea
                  value={interviewNote}
                  onChange={(event) => setInterviewNote(event.target.value)}
                  rows={3}
                  placeholder="Interview notes (optional)"
                  className="mt-3 rounded-2xl"
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="brand"
                    className="rounded-2xl"
                    disabled={result.isPending}
                    onClick={() => result.mutate("pass")}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Pass
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    disabled={result.isPending}
                    onClick={() => result.mutate("reassess")}
                  >
                    <RotateCcw className="h-4 w-4" /> Reassess / retrain
                  </Button>
                </div>
              </section>
            ) : null}

            {/* ---------- session history ---------- */}
            <section>
              <p className="font-display text-sm font-semibold">Session progress</p>
              <ul className="mt-2 space-y-1.5">
                {(data.sessions as JourneySession[]).map((item) => (
                  <li
                    key={item.sessionNumber}
                    className="glass-panel flex items-center justify-between gap-2 rounded-2xl px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs">
                      S{String(item.sessionNumber).padStart(2, "0")} · {item.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {item.review === "approved"
                        ? "Approved"
                        : item.review === "pending"
                          ? "Review pending"
                          : item.review === "rejected"
                            ? "Rejected"
                            : item.scheduledAt
                              ? formatDateTime(item.scheduledAt)
                              : "Not scheduled"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <Button variant="outline" size="xl" className="w-full rounded-2xl" onClick={onClose}>
              <Share2 className="h-4 w-4" /> Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
