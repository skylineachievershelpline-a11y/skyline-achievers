import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { BackButton } from "@/components/member/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listDeviceAccounts } from "@/lib/device-accounts";
import { formatDateTime12 as formatDateTime } from "@/lib/format";
import { hasStoredSession } from "@/lib/offline-cache";
import { getSharedTraineeReport, submitSharedInterviewResult } from "@/lib/journey.functions";
import {
  JOURNEY_MAX_SCORE,
  attendanceCategory,
  maxScoreForSession,
  performanceCategory,
} from "@/lib/journey-scoring";


export const Route = createFileRoute("/report/$token")({
  head: () => ({
    meta: [
      { title: "Training progress report | Skyline Achievers" },
      {
        name: "description",
        content:
          "A private, read-only training progress record shared by a Skyline Achievers upline: session timings, review submissions and interview result.",
      },
      { property: "og:title", content: "Training progress report | Skyline Achievers" },
      {
        property: "og:description",
        content: "Private read-only training progress record shared by a Skyline Achievers upline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharedReportPage,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SharedReportPage() {
  const { token } = Route.useParams();
  const read = useServerFn(getSharedTraineeReport);
  const report = useQuery({
    queryKey: ["shared-report", token],
    queryFn: () => read({ data: { token } } as never) as never,
  });

  const data = report.data as Awaited<ReturnType<typeof getSharedTraineeReport>> | undefined;
  const sessions = data?.status === "ok" ? data.sessions : [];
  const scoredSessions = sessions.filter((session) => session.score != null).length;
  const totalScore = sessions.reduce((sum, session) => sum + Number(session.score ?? 0), 0);
  const performance = performanceCategory(totalScore, scoredSessions);
  const attended = sessions.filter(
    (session) => Boolean(session.openedAt) || session.review === "approved",
  ).length;
  const onTime = sessions.filter(
    (session) => session.openedAt && Number(session.joinLateMinutes ?? 0) <= 10,
  ).length;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <BackButton fallback={home} />
        <Link
          to={home as "/dashboard"}
          className="rounded-xl border border-metal/30 bg-surface px-3 py-2 text-xs font-semibold shadow-glass hover:border-cyan/40"
        >
          {signedIn ? "← My Dashboard" : "Home"}
        </Link>
      </div>
      <BrandLogo className="mx-auto" />
      <h1 className="mt-5 text-center font-display text-xl font-bold">Training progress report</h1>

      {report.isLoading ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">Loading the record…</p>
      ) : !data || data.status !== "ok" ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          This report link is closed or not valid any more. Please ask the upline for a new link.
        </p>
      ) : (
        <>
          <section className="raised-panel mt-5 rounded-3xl p-5">
            <p className="font-display text-lg font-semibold">{data.trainee.name}</p>
            <p className="text-xs text-primary">{data.trainee.code}</p>
            <div className="mt-3">
              <Row label="Status" value={data.trainee.status} />
              <Row label="Joined" value={formatDateTime(data.trainee.joinedAt)} />
               <Row label="Report generated" value={formatDateTime(data.generatedAt)} />
              <Row
                label="Upline"
                value={data.upline ? `${data.upline.name} · ${data.upline.code}` : "—"}
              />
              <Row label="Stage" value={data.stage} />
              <Row label="Final interview" value={data.interviewResult ?? "not taken yet"} />
              {data.interviewNote ? <Row label="Interview note" value={data.interviewNote} /> : null}
              <Row
                label="Personal Mentorship verified"
                value={`${data.wallet.verified} / ${data.wallet.required}`}
              />
              <Row label="2CC verified" value={`${data.wallet.ccVerified} / ${data.wallet.ccTarget}`} />
            </div>
          </section>

           <section className="mt-4 overflow-hidden rounded-3xl border border-cyan/25 bg-primary/10 p-5">
             <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Performance result</p>
             <div className="mt-3 grid grid-cols-3 gap-2 text-center">
               <div className="inset-panel rounded-xl p-3">
                 <p className="font-display text-xl font-bold text-cyan">{totalScore}/{JOURNEY_MAX_SCORE}</p>
                 <p className="text-[9px] uppercase text-muted-foreground">Total marks</p>
               </div>
               <div className="inset-panel rounded-xl p-3">
                 <p className="font-display text-xl font-bold">{attended}/7</p>
                 <p className="text-[9px] uppercase text-muted-foreground">Attended</p>
               </div>
               <div className="inset-panel rounded-xl p-3">
                 <p className="font-display text-xl font-bold">{onTime}/7</p>
                 <p className="text-[9px] uppercase text-muted-foreground">On time</p>
               </div>
             </div>
             <p className="mt-3 font-display text-base font-semibold">{performance.label}</p>
             <p className="mt-1 text-xs text-muted-foreground">{performance.detail}</p>
           </section>

          <section className="glass-panel mt-4 space-y-3 rounded-3xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
              Sessions, timings and reviews
            </p>
            {data.sessions.map((session) => (
              <div key={session.sessionNumber} className="inset-panel rounded-2xl p-3">
                <p className="text-sm font-semibold">
                  Session {String(session.sessionNumber).padStart(2, "0")} — {session.title}
                </p>
                <div className="mt-2">
                  <Row
                    label="Scheduled"
                    value={session.scheduledAt ? formatDateTime(session.scheduledAt) : "not set"}
                  />
                  <Row
                    label="Joined"
                    value={session.openedAt
                      ? `${formatDateTime(session.openedAt)} · ${attendanceCategory(session.joinLateMinutes, true)}${session.joinLateMinutes ? ` (${session.joinLateMinutes} min)` : ""}`
                      : session.review === "approved"
                        ? `Attended · review approved${session.reviewedAt ? ` ${formatDateTime(session.reviewedAt)}` : ""}`
                        : "Not attended"}
                  />
                  <Row
                    label="Review sent"
                    value={
                      session.submittedAt
                        ? `${formatDateTime(session.submittedAt)}${session.late ? " · late" : " · in time"}`
                        : "not sent"
                    }
                  />
                  <Row
                    label="Decision"
                    value={
                      session.reviewSource === "whatsapp"
                        ? `${session.review} — Review shared on WhatsApp`
                        : session.review
                    }
                  />
                   <Row
                     label="Marks"
                     value={session.score == null ? "not scored" : `${session.score} / ${maxScoreForSession(session.sessionNumber)}`}
                   />
                  {session.reviewedAt ? (
                    <Row label="Decided on" value={formatDateTime(session.reviewedAt)} />
                  ) : null}
                  {session.uplineNote ? <Row label="Upline note" value={session.uplineNote} /> : null}
                </div>
                {session.reviewBody ? (
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-2 p-2 text-[11px] text-muted-foreground">
                    {session.reviewBody}
                  </p>
                ) : null}
                 {session.reviewImageUrls.length ? (
                   <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                     {session.reviewImageUrls.map((url) => (
                       <a key={url} href={url} target="_blank" rel="noreferrer">
                         <img src={url} alt={`Session ${session.sessionNumber} review`} className="aspect-square w-full rounded-xl object-cover" />
                       </a>
                     ))}
                   </div>
                 ) : null}
                 {session.reviewVoiceUrl ? <audio controls src={session.reviewVoiceUrl} className="mt-2 w-full" /> : null}
                 {session.uplineVoiceUrl ? (
                   <div className="mt-2">
                     <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Upline voice reply</p>
                     <audio controls src={session.uplineVoiceUrl} className="w-full" />
                   </div>
                 ) : null}
              </div>
            ))}
          </section>

          <FinalInterviewPanel
            token={token}
            interview={data.interview}
            result={data.interviewResult}
            note={data.interviewNote}
            onSaved={() => void report.refetch()}
          />

          <p className="mt-4 text-center text-[10px] text-muted-foreground">
            Read-only training record. No personal contact details are shared.
          </p>
        </>
      )}
    </main>
  );
}

/**
 * The senior who conducts the Final Interview marks the candidate pass or fail
 * right here, with marks and remarks. The result updates the candidate's record
 * and, on a pass, opens Session 08 for them automatically.
 */
function FinalInterviewPanel({
  token,
  interview,
  result,
  note,
  onSaved,
}: {
  token: string;
  interview: {
    marks: number | null;
    maxMarks: number;
    takenBy: string | null;
    decidedAt: string | null;
    scheduledAt: string | null;
    attempts: number;
    canEvaluate: boolean;
  };
  result: string | null;
  note: string | null;
  onSaved: () => void;
}) {
  const submit = useServerFn(submitSharedInterviewResult);
  const [seniorName, setSeniorName] = useState("");
  const [marks, setMarks] = useState("");
  const [remarks, setRemarks] = useState("");

  const save = useMutation({
    mutationFn: (decision: "pass" | "fail") => {
      if (seniorName.trim().length < 3) throw new Error("Please write your name or member ID.");
      if (marks.trim() === "") throw new Error("Please enter the interview marks.");
      return submit({
        data: {
          token,
          seniorName: seniorName.trim(),
          result: decision,
          marks: Math.max(0, Math.min(interview.maxMarks, Math.round(Number(marks) || 0))),
          note: remarks.trim() || null,
        },
      } as never);
    },
    onSuccess: (_r, decision) => {
      toast.success(
        decision === "pass"
          ? "Result saved — the candidate has passed and Session 08 is now open."
          : "Result saved — the candidate has been asked to try again.",
      );
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decided = Boolean(interview.decidedAt);

  return (
    <section className="mt-4 rounded-3xl border-2 border-primary/40 bg-primary/10 p-5">
      <p className="flex items-center gap-2 font-display text-base font-semibold">
        <ShieldCheck className="h-4 w-4 text-primary" /> Final Interview
      </p>

      <div className="mt-3">
        <Row
          label="Interview time"
          value={interview.scheduledAt ? formatDateTime(interview.scheduledAt) : "not set yet"}
        />
        <Row label="Attempts" value={String(interview.attempts)} />
        <Row label="Result" value={result ?? "not taken yet"} />
        <Row
          label="Interview marks"
          value={interview.marks == null ? "not marked" : `${interview.marks} / ${interview.maxMarks}`}
        />
        {interview.takenBy ? <Row label="Taken by" value={interview.takenBy} /> : null}
        {interview.decidedAt ? <Row label="Decided on" value={formatDateTime(interview.decidedAt)} /> : null}
        {note ? <Row label="Remarks" value={note} /> : null}
      </div>

      {interview.canEvaluate ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs font-semibold">
            {decided ? "Record the new interview result" : "Record the interview result"}
          </p>
          <div>
            <Label htmlFor="senior-name">Your name or member ID</Label>
            <Input
              id="senior-name"
              value={seniorName}
              onChange={(event) => setSeniorName(event.target.value)}
              placeholder="Senior who took the interview"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="interview-marks">Interview marks (maximum {interview.maxMarks})</Label>
            <Input
              id="interview-marks"
              type="number"
              inputMode="numeric"
              min={0}
              max={interview.maxMarks}
              value={marks}
              onChange={(event) => setMarks(event.target.value)}
              placeholder={`0–${interview.maxMarks}`}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="interview-remarks">Remarks (optional)</Label>
            <Textarea
              id="interview-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={3}
              placeholder="How was the candidate? Anything to improve?"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="brand"
              className="rounded-2xl"
              disabled={save.isPending}
              onClick={() => save.mutate("pass")}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Pass
            </Button>
            <Button
              variant="destructive"
              className="rounded-2xl"
              disabled={save.isPending}
              onClick={() => save.mutate("fail")}
            >
              <XCircle className="h-4 w-4" /> Fail
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            A pass opens Session 08 for the candidate at once. A fail asks the candidate to try
            again and lets the upline set a new interview time.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-muted-foreground">
          The interview panel opens once the candidate is at the Final Interview step.
        </p>
      )}
    </section>
  );
}
