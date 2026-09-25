import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  ShieldOff,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime12 } from "@/lib/format";
import { SESSION_WINDOW_HOURS } from "@/lib/journey";
import { JOURNEY_MAX_SCORE, maxScoreForSession, performanceCategory } from "@/lib/journey-scoring";
import {
  approveWhatsappReview,
  createTraineeReportLink,
  getTraineeJourneyForUpline,
  getTraineeReportLinks,
  grantForeverAccess,
  reviewSessionSubmission,
  setTraineeReportLinkRevoked,
} from "@/lib/journey.functions";

/** Hidden by default: "Show review" reveals text, pictures and voice note plus decisions. */
function ReviewDetails({
  session,
  onDone,
}: {
  session: any;
  traineeId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(session.review === "pending");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [score, setScore] = useState(session.score == null ? "" : String(session.score));
  const maximum = maxScoreForSession(session.sessionNumber);
  const decide = useServerFn(reviewSessionSubmission);
  const mutation = useMutation({
    mutationFn: (decision: "approved" | "rejected") =>
      decide({
        data: {
          reviewId: session.reviewId,
          decision,
          note: reason.trim() || null,
          score: decision === "approved" ? Number(score) : null,
        },
      } as never),
    onSuccess: (_r, decision) => {
      toast.success(decision === "approved" ? "Review approved" : "Review rejected");
      setRejecting(false);
      setReason("");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const images: string[] = session.reviewImageUrls?.length
    ? session.reviewImageUrls
    : session.reviewImageUrl
      ? [session.reviewImageUrl]
      : [];

  return (
    <div className="mt-2">
      <Button
        size="sm"
        variant={open ? "outline" : "brand"}
        className="w-full rounded-xl text-[12px]"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide review" : "Show review"}
      </Button>
      {open ? (
        <div className="mt-2 space-y-2 rounded-2xl border border-hairline p-3">
          {session.reviewBody ? (
            <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-2 text-[12px]">
              {session.reviewBody}
            </p>
          ) : null}
          {images.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {images.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="Review" className="aspect-square w-full rounded-xl object-cover" />
                </a>
              ))}
            </div>
          ) : null}
          {session.reviewVoiceUrl ? (
            <audio controls src={session.reviewVoiceUrl} className="w-full" />
          ) : null}
          {!session.reviewBody && !images.length && !session.reviewVoiceUrl ? (
            <p className="text-[11px] text-muted-foreground">No review content saved.</p>
          ) : null}

          {session.review === "pending" ? (
            rejecting ? (
              <div className="space-y-2">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="rounded-xl text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => setRejecting(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-xl"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate("rejected")}
                  >
                    {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="inset-panel space-y-2 rounded-xl p-3">
                  <Label htmlFor={`score-${session.reviewId}`}>Marks (maximum {maximum})</Label>
                  <Input
                    id={`score-${session.reviewId}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={maximum}
                    value={score}
                    onChange={(event) => setScore(event.target.value)}
                    placeholder={`0–${maximum}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="brand"
                  className="rounded-xl"
                  disabled={mutation.isPending || score === ""}
                  onClick={() => mutation.mutate("approved")}
                >
                  {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Approve
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setRejecting(true)}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                </div>
              </div>
            )
          ) : session.review === "approved" ? (
            <div className="inset-panel space-y-2 rounded-xl p-3">
              {session.score != null ? (
                <p className="text-sm font-semibold text-cyan">
                  Marks: {session.score} / {maximum}
                </p>
              ) : null}
              <Label htmlFor={`score-${session.reviewId}`}>
                {session.score == null ? "Add marks" : "Edit marks"} (maximum {maximum})
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`score-${session.reviewId}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={maximum}
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                  placeholder={`0–${maximum}`}
                />
                <Button variant="brand" disabled={mutation.isPending || score === ""} onClick={() => mutation.mutate("approved")}>
                  {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save marks
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  none: "No review yet",
  pending: "Waiting for your decision",
  approved: "Approved",
  rejected: "Rejected",
};

/**
 * Read-only progress record for one person in the team: every session with its
 * scheduled time, the time it was opened, the time the review was submitted,
 * on time or late, and the upline decision. Session timings are set once from
 * the Seat Reservation page, so nothing is scheduled here.
 */
export function TraineeProgressRecord({
  traineeId,
  traineeName,
  onClose,
}: {
  traineeId: string;
  traineeName: string;
  onClose: () => void;
}) {
  const [portalReady, setPortalReady] = useState(false);
  const queryClient = useQueryClient();
  const load = useServerFn(getTraineeJourneyForUpline);
  const loadLinks = useServerFn(getTraineeReportLinks);
  const makeLink = useServerFn(createTraineeReportLink);
  const revoke = useServerFn(setTraineeReportLinkRevoked);

  const { data, isPending } = useQuery({
    queryKey: ["trainee-record", traineeId],
    queryFn: () => load({ data: { traineeId } } as never),
    retry: false,
  });
  const links = useQuery({
    queryKey: ["trainee-report-links", traineeId],
    queryFn: () => loadLinks({ data: { traineeId } } as never),
    retry: false,
  });

  const markWhatsapp = useServerFn(approveWhatsappReview);
  const whatsapp = useMutation({
    mutationFn: (values: { sessionNumber: number; score: number }) =>
      markWhatsapp({ data: { traineeId, ...values } } as never),
    onSuccess: () => {
      toast.success("Marked as reviewed on WhatsApp and approved");
      void queryClient.invalidateQueries({ queryKey: ["trainee-record", traineeId] });
      void queryClient.invalidateQueries({ queryKey: ["upline-review-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["upline-action-queue"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const grant = useServerFn(grantForeverAccess);
  const access = useMutation({
    mutationFn: () => grant({ data: { traineeId } } as never),
    onSuccess: () => {
      toast.success("Session 08 access de diya — trainee ko congratulations bhej diya");
      void queryClient.invalidateQueries({ queryKey: ["trainee-record", traineeId] });
      void queryClient.invalidateQueries({ queryKey: ["upline-action-queue"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const create = useMutation({
    mutationFn: () => makeLink({ data: { traineeId } } as never),
    onSuccess: () => {
      toast.success("Report link created");
      void queryClient.invalidateQueries({ queryKey: ["trainee-report-links", traineeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: (values: { linkId: string; revoked: boolean }) =>
      revoke({ data: values } as never),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trainee-report-links", traineeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sessions = (data?.sessions ?? []) as any[];
  const scoredSessions = sessions.filter((session) => session.score != null).length;
  const totalScore = sessions.reduce((sum, session) => sum + Number(session.score ?? 0), 0);
  const performance = performanceCategory(totalScore, scoredSessions);
  const basicApproved = sessions.filter(
    (s) => s.sessionNumber <= 7 && s.review === "approved",
  ).length;
  const accessGiven = data?.stage === "interview_passed" || data?.stage === "mentorship";
  const needsAccess = basicApproved >= 7 && !accessGiven;
  const accessButton = (
    <Button
      type="button"
      className="w-full"
      disabled={access.isPending}
      onClick={() => access.mutate()}
    >
      {access.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      Give Session 08 access
    </Button>
  );
  const [whatsappScores, setWhatsappScores] = useState<Record<number, string>>({});

  useEffect(() => {
    setPortalReady(true);
  }, []);

  if (!portalReady || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex min-h-[100dvh] items-center justify-center bg-background/90 p-3 backdrop-blur-sm">
      <div className="raised-panel metal-edge max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-3xl p-5 animate-rise-in [scrollbar-gutter:stable]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Progress record
            </p>
            <h2 className="font-display text-lg font-bold">{traineeName}</h2>
            <p className="text-[11px] text-muted-foreground">
              {data?.profile?.code ?? ""} · read-only training history, kept permanently
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isPending ? (
          <div className="flex justify-center py-10">
            <SkylineLoader />
          </div>
        ) : (
          <>
            {needsAccess ? (
              <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-3">
                <p className="text-sm font-bold text-primary">
                  7 sessions complete — is person ko Session 08 access dena hai
                </p>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Access dene par trainee ko training complete aur Final Interview pass ki congratulations milegi.
                </p>
                {accessButton}
              </div>
            ) : null}
            {accessGiven ? (
              <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs font-semibold text-emerald-300">
                Session 08 access given · Final Interview passed
              </p>
            ) : null}
            {data?.stage === "ready_for_interview" || data?.stage === "reassess" ? (
              <InterviewScheduler
                traineeId={traineeId}
                requestedAt={(data as any)?.interviewRequestedAt ?? null}
                availabilityNote={(data as any)?.interviewAvailabilityNote ?? null}
                scheduledAt={(data as any)?.interviewScheduledAt ?? null}
                onDone={() => {
                  void queryClient.invalidateQueries({ queryKey: ["trainee-record", traineeId] });
                  void queryClient.invalidateQueries({ queryKey: ["upline-action-queue"] });
                }}
              />
            ) : null}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                {
                  label: "Approved",
                  value: sessions.filter((s) => s.review === "approved").length,
                },
                {
                  label: "Waiting",
                  value: sessions.filter((s) => s.review === "pending").length,
                },
                {
                  label: "Marks",
                  value: `${totalScore}/${JOURNEY_MAX_SCORE}`,
                },
              ].map((item) => (
                <div key={item.label} className="inset-panel rounded-xl px-2 py-2">
                  <p className="font-display text-lg font-semibold tabular-nums">{item.value}</p>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-cyan/25 bg-primary/10 p-3">
              <p className="font-display text-sm font-semibold text-cyan">{performance.label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{performance.detail}</p>
            </div>

            <ul className="mt-4 space-y-2">
              {sessions.map((session) => {
                const late =
                  session.scheduledAt && session.reviewSubmittedAt
                    ? new Date(session.reviewSubmittedAt).getTime() >
                      new Date(session.scheduledAt).getTime() +
                        SESSION_WINDOW_HOURS * 3_600_000
                    : false;
                return (
                  <li key={session.sessionNumber} className="glass-panel rounded-2xl p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                        Session {String(session.sessionNumber).padStart(2, "0")} · {session.title}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          session.review === "approved"
                            ? "bg-cyan/15 text-cyan"
                            : session.review === "pending"
                              ? "bg-primary/15 text-primary"
                              : session.review === "rejected"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABEL[session.review] ?? session.review}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                      <p>
                        Scheduled:{" "}
                        {session.scheduledAt ? formatDateTime12(session.scheduledAt) : "—"}
                      </p>
                      <p>
                        Attendance:{" "}
                        {session.openedAt
                          ? `Attended · ${formatDateTime12(session.openedAt)}`
                          : session.review === "approved"
                            ? `Attended · review approved${session.reviewedAt ? ` ${formatDateTime12(session.reviewedAt)}` : ""}`
                            : "Not attended"}
                        {session.openedAt && session.scheduledAt
                          ? ` (${Math.max(
                              0,
                              Math.round(
                                (new Date(session.openedAt).getTime() -
                                  new Date(session.scheduledAt).getTime()) /
                                  60000,
                              ),
                            )} min after start)`
                          : ""}
                      </p>
                      <p>
                        Review sent:{" "}
                        {session.reviewSubmittedAt
                          ? formatDateTime12(session.reviewSubmittedAt)
                          : "—"}{" "}
                        {session.reviewSubmittedAt ? (
                          <span className={late ? "text-destructive" : "text-cyan"}>
                            {late ? "Late" : "On time"}
                          </span>
                        ) : null}
                      </p>
                      <p>
                        Decision:{" "}
                        {session.reviewedAt ? formatDateTime12(session.reviewedAt) : "Pending"}
                      </p>
                    </div>
                    {session.reviewId ? (
                      <ReviewDetails
                        session={session}
                        traineeId={traineeId}
                        onDone={() => {
                          void queryClient.invalidateQueries({ queryKey: ["trainee-record", traineeId] });
                          void queryClient.invalidateQueries({ queryKey: ["upline-review-requests"] });
                          void queryClient.invalidateQueries({ queryKey: ["upline-action-queue"] });
                        }}
                      />
                    ) : null}
                    {session.reviewSource === "whatsapp" ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                        <MessageCircle className="h-3.5 w-3.5" /> Review shared on WhatsApp
                      </p>
                    ) : null}
                    {session.sessionNumber > 7 ? (
                      accessGiven ? (
                        <p className="mt-2 text-[11px] font-semibold text-emerald-300">Access given ✓</p>
                      ) : needsAccess ? (
                        <div className="mt-2">{accessButton}</div>
                      ) : (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Saare 7 sessions approve hone ke baad yahan access button aayega.
                        </p>
                      )
                    ) : session.review !== "approved" ? (
                      <div className="mt-2 grid grid-cols-[6rem_1fr] gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={maxScoreForSession(session.sessionNumber)}
                          value={whatsappScores[session.sessionNumber] ?? ""}
                          onChange={(event) => setWhatsappScores((current) => ({ ...current, [session.sessionNumber]: event.target.value }))}
                          placeholder={`0–${maxScoreForSession(session.sessionNumber)}`}
                          aria-label={`Session ${session.sessionNumber} WhatsApp review marks`}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-[12px]"
                          disabled={whatsapp.isPending}
                          onClick={() => {
                            const max = maxScoreForSession(session.sessionNumber);
                            const raw = (whatsappScores[session.sessionNumber] ?? "").trim();
                            if (raw === "") {
                              toast.error("Pehle marks likhein, phir approve karein.");
                              return;
                            }
                            const score = Math.max(0, Math.min(max, Math.round(Number(raw) || 0)));
                            whatsapp.mutate({ sessionNumber: session.sessionNumber, score });
                          }}
                        >
                          {whatsapp.isPending && whatsapp.variables?.sessionNumber === session.sessionNumber ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                          Approve WhatsApp review
                        </Button>
                      </div>
                    ) : null}
                    {session.uplineNote ? (
                      <p className="mt-1 text-[11px] text-primary">Note: {session.uplineNote}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
              <p>Stage: {String(data?.stage ?? "sessions").replace(/_/g, " ")}</p>
              <p>Final interview: {data?.interviewResult ?? "Not decided"}</p>
              <p>
                Personal Mentorship verified: {data?.wallet?.verified ?? 0} of{" "}
                {data?.wallet?.required ?? 0}
              </p>
              <p>
                2CC verified: {data?.wallet?.ccVerified ?? 0} of {data?.wallet?.ccTarget ?? 0}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-hairline p-3">
              <p className="flex items-center gap-2 font-display text-sm font-semibold">
                <Link2 className="h-4 w-4 text-brand-glow" /> Share this record with a senior
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                A private link with the complete timing record. You can close any link at any time.
              </p>
              <Button
                variant="brand"
                className="mt-3 w-full rounded-2xl"
                disabled={create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Generate report link
              </Button>

              <ul className="mt-3 space-y-2">
                {((links.data?.links ?? []) as any[]).map((link) => {
                  const url = `${origin}/report/${link.token}`;
                  return (
                    <li key={link.id} className="glass-panel rounded-xl p-2">
                      <p className="truncate text-[11px] text-muted-foreground">{url}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg px-2 text-[11px]"
                          onClick={() => {
                            void navigator.clipboard.writeText(url);
                            toast.success("Link copied");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          variant={link.revoked ? "brand" : "outline"}
                          className="h-8 rounded-lg px-2 text-[11px]"
                          onClick={() =>
                            toggle.mutate({ linkId: link.id, revoked: !link.revoked })
                          }
                        >
                          {link.revoked ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <ShieldOff className="h-3.5 w-3.5" />
                          )}
                          {link.revoked ? "Open again" : "Close link"}
                        </Button>
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDateTime12(link.createdAt)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="mt-4 text-[10px] text-muted-foreground">
              Session timings are set from the Seat Reservation page. A missed session moves to the next day automatically.
            </p>
            <Button variant="outline" className="mt-3 w-full rounded-2xl" onClick={onClose}>
              Close
            </Button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
