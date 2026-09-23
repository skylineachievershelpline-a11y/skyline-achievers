import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  ShieldOff,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { Button } from "@/components/ui/button";
import { formatDateTime12 } from "@/lib/format";
import { SESSION_WINDOW_HOURS } from "@/lib/journey";
import {
  approveWhatsappReview,
  createTraineeReportLink,
  getTraineeJourneyForUpline,
  getTraineeReportLinks,
  setTraineeReportLinkRevoked,
} from "@/lib/journey.functions";

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
    mutationFn: (sessionNumber: number) =>
      markWhatsapp({ data: { traineeId, sessionNumber } } as never),
    onSuccess: () => {
      toast.success("Marked as reviewed on WhatsApp and approved");
      void queryClient.invalidateQueries({ queryKey: ["trainee-record", traineeId] });
      void queryClient.invalidateQueries({ queryKey: ["upline-review-requests"] });
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="raised-panel metal-edge max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5">
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
                  label: "No review",
                  value: sessions.filter((s) => s.review === "none").length,
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
                        Session opened:{" "}
                        {session.openedAt ? formatDateTime12(session.openedAt) : "Not opened"}
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
                    {session.reviewBody ? (
                      <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-2 p-2 text-[11px]">
                        {session.reviewBody}
                      </p>
                    ) : null}
                    {session.reviewSource === "whatsapp" ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                        <MessageCircle className="h-3.5 w-3.5" /> Review shared on WhatsApp
                      </p>
                    ) : null}
                    {session.review !== "approved" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full rounded-xl text-[12px]"
                        disabled={whatsapp.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Did ${traineeName} send the Session ${String(session.sessionNumber).padStart(2, "0")} review on WhatsApp? It will be approved.`,
                            )
                          )
                            whatsapp.mutate(session.sessionNumber);
                        }}
                      >
                        {whatsapp.isPending && whatsapp.variables === session.sessionNumber ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <MessageCircle className="h-3.5 w-3.5" />
                        )}
                        Approve review received on WhatsApp
                      </Button>
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
    </div>
  );
}
