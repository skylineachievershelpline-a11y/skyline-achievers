import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Lock,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { SessionVideo } from "@/components/media/SessionVideo";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import {
  BASIC_SESSION_COUNT,
  SESSION_WINDOW_HOURS,
  countdownText,
  currentSessionNumber,
  msLeftInWindow,
  nextAction,
  sessionExpired,
  sessionOpen,
  type JourneySession,
} from "@/lib/journey";
import {
  getMentorshipSeats,
  getTraineeJourney,
  markInterviewGuideWatched,
  markWebinarWatched,
  playJourneyVideo,
} from "@/lib/journey.functions";
import { VoiceGuide } from "@/components/voice/VoiceGuide";
import { PaymentClaimForm } from "./PaymentClaimForm";
import { PaymentWalletCard } from "./PaymentWalletCard";
import { SeatAlertTag } from "./SeatAlertTag";
import { SessionReviewForm } from "./SessionReviewForm";
import { WhatDoINowCard } from "./WhatDoINowCard";
import { useNow } from "./useCountdown";

type Playing = {
  id: string;
  title: string;
  description: string | null;
  aspectRatio: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const REVIEW_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "🟡 Review pending", className: "text-amber-300" },
  approved: { label: "✅ Approved", className: "text-brand-glow" },
  rejected: { label: "🔁 Send again", className: "text-destructive" },
};

/** The complete guided journey shown on the trainee's dashboard. */
export function TraineeJourney() {
  const queryClient = useQueryClient();
  const load = useServerFn(getTraineeJourney);
  const loadSeats = useServerFn(getMentorshipSeats);
  const play = useServerFn(playJourneyVideo);
  const watchGuide = useServerFn(markInterviewGuideWatched);
  const watchWebinar = useServerFn(markWebinarWatched);

  const [playing, setPlaying] = useState<Playing | null>(null);
  const now = useNow();

  const { data, isPending } = useQuery({
    queryKey: ["trainee-journey"],
    queryFn: () => load(),
    retry: false,
  });
  const { data: seats } = useQuery({
    queryKey: ["mentorship-seats"],
    queryFn: () => loadSeats(),
    retry: false,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["trainee-journey"] });
  }

  const open = useMutation({
    mutationFn: (sessionId: string) => play({ data: { sessionId } } as never),
    onSuccess: (result: any) => {
      if (result.status === "expired") {
        toast.error(
          `This session closed ${SESSION_WINDOW_HOURS} hours after its start time because no review was submitted.`,
        );
        return;
      }
      if (result.status === "locked") {
        toast.error("This session opens at its scheduled time.");
        return;
      }
      if (result.status !== "ok") {
        toast.error("This video is not available right now.");
        return;
      }
      setPlaying(result.session);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmGuide = useMutation({
    mutationFn: () => watchGuide(),
    onSuccess: () => {
      toast.success("Ready for your final interview");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmWebinar = useMutation({
    mutationFn: () => watchWebinar(),
    onSuccess: () => {
      toast.success("Webinar complete — the reservation form is open");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending || !data) {
    return (
      <div className="flex justify-center py-12">
        <SkylineLoader />
      </div>
    );
  }

  const sessions = (data.sessions ?? []) as JourneySession[];
  const basic = sessions.slice(0, BASIC_SESSION_COUNT);
  const currentNumber = currentSessionNumber(basic);
  const current = basic.find((item) => item.sessionNumber === currentNumber) ?? null;
  const approvedCount = basic.filter((item) => item.review === "approved").length;
  const action = nextAction({
    stage: data.stage,
    sessions: basic,
    mentorshipRemaining: data.wallet.remaining,
    mentorshipDueAt: data.mentorshipDueAt,
    webinarWatched: Boolean(data.webinarWatchedAt),
  });

  if (playing) {
    return (
      <section className="raised-panel relative mt-4 overflow-hidden rounded-[30px] p-4 animate-scale-in sm:p-6">
        <span className="connector-line absolute inset-x-0 top-0 h-1" aria-hidden />
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="rounded-2xl"
            aria-label="Back to my journey"
            onClick={() => setPlaying(null)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold tracking-tight">
            {playing.title}
          </h2>
        </div>
        <SessionVideo
          title={playing.title}
          videoUrl={playing.videoUrl}
          aspectRatio={playing.aspectRatio}
          poster={playing.thumbnailUrl}
          frameClassName="rounded-3xl border border-hairline"
        />
        {playing.description ? (
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {playing.description}
          </p>
        ) : null}

        {data.stage === "sessions" &&
        current &&
        playing.id === current.sessionId &&
        current.review !== "pending" &&
        current.review !== "approved" ? (
          <SessionReviewForm
            sessionNumber={current.sessionNumber}
            onSent={() => {
              setPlaying(null);
              refresh();
            }}
          />
        ) : null}

        {data.stage === "interview_guide" && playing.id === data.interviewGuide?.id ? (
          <Button
            variant="brand"
            size="xl"
            className="mt-5 w-full rounded-2xl"
            disabled={confirmGuide.isPending}
            onClick={() => confirmGuide.mutate()}
          >
            {confirmGuide.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            I have watched the full interview guide
          </Button>
        ) : null}

        {data.stage === "mentorship" && playing.id === data.webinar?.id && !data.webinarWatchedAt ? (
          <Button
            variant="brand"
            size="xl"
            className="mt-5 w-full rounded-2xl"
            disabled={confirmWebinar.isPending}
            onClick={() => confirmWebinar.mutate()}
          >
            {confirmWebinar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            I have watched the full webinar
          </Button>
        ) : null}

        <Button
          variant="outline"
          size="xl"
          className="mt-4 w-full rounded-2xl"
          onClick={() => setPlaying(null)}
        >
          <ArrowLeft className="h-4 w-4" /> Back to my journey
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <WhatDoINowCard action={action} />

      <VoiceGuide
        className="justify-center"
        label="Listen to this step"
        ur={`Assalam-o-Alaikum. Aap is waqt ${action.where} par hain. Ab aap ko ye karna hai: ${action.now}. Is ke baad: ${action.next}. Session apne muqarrar waqt par khulta hai aur sirf ${SESSION_WINDOW_HOURS} ghante khula rehta hai, is doran video dekh kar apna review zaroor submit karein.`}
        en={`Welcome. You are at ${action.where}. Right now you need to: ${action.now}. After that: ${action.next}. Every session opens at its scheduled time and stays open for ${SESSION_WINDOW_HOURS} hours, so watch the video and submit your review inside that window.`}
      />

      {/* ---------- hero: the session in front of the trainee right now ---------- */}
      {data.stage === "sessions" ? (
        <section className="raised-panel metal-edge overflow-hidden rounded-[30px] animate-rise-in">
          <div className="border-b border-hairline/60 px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-brand-glow">
              Your training journey
            </p>
            <p className="mt-1 font-display text-xl font-semibold tracking-tight">
              {current
                ? `Day ${pad(current.dayNumber)} — Session ${pad(current.sessionNumber)}`
                : "Basic training complete"}
            </p>
          </div>

          {current ? (
            <>
              <div className="relative aspect-video bg-media">
                {current.thumbnailUrl ? (
                  <img
                    src={current.thumbnailUrl}
                    alt={`${current.title} cover`}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                {!sessionOpen(current, now) ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 px-6 text-center backdrop-blur-sm">
                    <Lock className="h-6 w-6 text-brand-glow" />
                    {sessionExpired(current, now) ? (
                      <>
                        <p className="text-sm font-semibold text-destructive">Session closed</p>
                        <p className="text-[11px] text-muted-foreground">
                          The {SESSION_WINDOW_HOURS}-hour window ended and no review was submitted.
                          Ask your upline to schedule this session again.
                        </p>
                      </>
                    ) : current.scheduledAt ? (
                      <>
                        <p className="font-mono text-2xl tabular-nums">
                          {countdownText(new Date(current.scheduledAt).getTime() - now)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Opens {formatDateTime(current.scheduledAt)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Your upline has not set the timing for this session yet.
                      </p>
                    )}
                  </div>
                ) : msLeftInWindow(current, now) !== null && current.review === "none" ? (
                  <span className="absolute left-3 top-3 rounded-full bg-background/80 px-3 py-1 font-mono text-[11px] tabular-nums text-brand-glow backdrop-blur-sm">
                    Closes in {countdownText(msLeftInWindow(current, now) ?? 0)}
                  </span>
                ) : null}
              </div>

              <div className="p-5">
                <p className="font-display text-base font-semibold">{current.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {current.scheduledAt ? formatDateTime(current.scheduledAt) : "Timing not set yet"}
                </p>

                {current.review === "pending" ? (
                  <p className="mt-3 text-xs font-semibold text-amber-300">
                    🟡 Review pending — your upline is checking it
                  </p>
                ) : null}
                {current.review === "rejected" ? (
                  <div className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3">
                    <p className="text-xs font-semibold text-destructive">
                      Your upline asked you to do this session again
                    </p>
                    {current.uplineNote ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{current.uplineNote}</p>
                    ) : null}
                    {current.uplineVoiceUrl ? (
                      <audio controls src={current.uplineVoiceUrl} className="mt-2 w-full" />
                    ) : null}
                  </div>
                ) : null}

                <Button
                  variant="brand"
                  size="xl"
                  className="mt-4 w-full rounded-2xl"
                  disabled={
                    !sessionOpen(current, now) ||
                    current.review === "pending" ||
                    open.isPending ||
                    !current.sessionId
                  }
                  onClick={() => current.sessionId && open.mutate(current.sessionId)}
                >
                  {open.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )}
                  Start session
                </Button>
              </div>
            </>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              All seven sessions are approved. Your Final Interview Guide is next.
            </p>
          )}
        </section>
      ) : null}

      {/* ---------- the seven-session track ---------- */}
      <section className="glass-panel metal-edge rounded-[28px] p-5 animate-rise-in">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Basic training
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold">7 guided sessions</h2>
          </div>
          <span className="font-display text-2xl font-semibold tabular-nums text-brand-glow">
            {approvedCount}/{BASIC_SESSION_COUNT}
          </span>
        </div>

        <ul className="mt-4 space-y-2">
          {basic.map((session) => {
            const badge = REVIEW_BADGE[session.review];
            const expired = sessionExpired(session, now);
            const locked = !sessionOpen(session, now);
            return (
              <li key={session.sessionNumber} className="glass-panel flex items-center gap-3 rounded-2xl p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-display text-sm font-semibold tabular-nums text-brand-glow">
                  {pad(session.sessionNumber)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{session.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Day {pad(session.dayNumber)} ·{" "}
                    {session.scheduledAt ? formatDateTime(session.scheduledAt) : "timing not set"}
                  </p>
                  {badge ? (
                    <p className={`mt-0.5 text-[11px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </p>
                  ) : null}
                  {expired ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-destructive">
                      ⏳ Closed — no review inside the {SESSION_WINDOW_HOURS}-hour window
                    </p>
                  ) : null}
                </div>
                {session.review === "approved" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-glow" />
                ) : locked ? (
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <button
                    type="button"
                    onClick={() => session.sessionId && open.mutate(session.sessionId)}
                    aria-label={`Open ${session.title}`}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-brand"
                  >
                    <PlayCircle className="h-5 w-5" />
                  </button>
                )}
              </li>
            );
          })}
          {basic.length === 0 ? (
            <li className="text-xs text-muted-foreground">
              Sessions are being prepared. Please check back soon.
            </li>
          ) : null}
        </ul>
      </section>

      {/* ---------- final interview guide ---------- */}
      {data.stage === "interview_guide" || data.stage === "reassess" ? (
        <section className="raised-panel rounded-[28px] p-5 animate-rise-in">
          <p className="text-[10px] uppercase tracking-[0.18em] text-brand-glow">
            Final interview guide
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold">
            {data.interviewGuide?.title ?? "Your final interview guide"}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            This video explains what the final interview is, why it matters, how to prepare, how to
            communicate and what to expect.
          </p>
          {data.stage === "reassess" && data.interviewNote ? (
            <p className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-200">
              Your senior asked you to prepare again: {data.interviewNote}
            </p>
          ) : null}
          {data.interviewGuide ? (
            <Button
              variant="brand"
              size="xl"
              className="mt-4 w-full rounded-2xl"
              onClick={() => open.mutate(data.interviewGuide!.id)}
            >
              <PlayCircle className="h-4 w-4" /> Watch the interview guide
            </Button>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              The guide video is being prepared by the office.
            </p>
          )}
        </section>
      ) : null}

      {data.stage === "ready_for_interview" ? (
        <section className="raised-panel rounded-[28px] p-5 text-center animate-rise-in">
          <ShieldCheck className="mx-auto h-8 w-8 text-brand-glow" />
          <p className="mt-3 font-display text-lg font-semibold">Ready for final interview</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your senior will take your final interview and share the result here.
          </p>
        </section>
      ) : null}

      {/* ---------- session 08: Forever Business Plan ---------- */}
      {data.stage === "interview_passed" || data.stage === "mentorship" ? (
        <section className="raised-panel rounded-[28px] p-5 animate-rise-in">
          <p className="text-[10px] uppercase tracking-[0.18em] text-brand-glow">Session 08</p>
          <h2 className="mt-1 font-display text-lg font-semibold">
            {data.businessPlan?.title ?? "Forever Business Plan"}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            You passed your final interview, so the business plan session is now open.
          </p>
          {data.businessPlan ? (
            <Button
              variant="brand"
              size="xl"
              className="mt-4 w-full rounded-2xl"
              onClick={() => open.mutate(data.businessPlan!.id)}
            >
              <PlayCircle className="h-4 w-4" /> Watch the business plan
            </Button>
          ) : null}
        </section>
      ) : null}

      {/* ---------- personal mentorship ---------- */}
      {data.stage === "interview_passed" || data.stage === "mentorship" ? (
        <section className="raised-panel rounded-[28px] p-5 animate-rise-in">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-glow" />
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Personal Mentorship
            </p>
          </div>
          <h2 className="mt-1 font-display text-lg font-semibold">
            Your mentorship seat
          </h2>
          {seats ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {seats.available} of {seats.total} seats available right now
            </p>
          ) : null}

          {data.webinarWatchedAt ? (
            <>
              <p className="mt-3 text-xs text-brand-glow">
                ✅ You have watched the complete webinar
              </p>
              <PaymentClaimForm
                purpose="mentorship"
                profile={data.profile}
                defaultAmount={Math.max(0, data.wallet.remaining || data.wallet.required)}
                onSent={refresh}
              />
            </>
          ) : (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                Watch the complete webinar first. The reservation form opens right after it.
              </p>
              {data.webinar ? (
                <Button
                  variant="brand"
                  size="xl"
                  className="mt-4 w-full rounded-2xl"
                  onClick={() => open.mutate(data.webinar!.id)}
                >
                  <Eye className="h-4 w-4" /> Watch the mentorship webinar
                </Button>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  The webinar video is being prepared by the office.
                </p>
              )}
            </>
          )}
        </section>
      ) : null}

      {data.wallet.verified > 0 || data.wallet.pendingCount > 0 ? (
        <PaymentWalletCard
          wallet={data.wallet}
          dueAt={data.mentorshipDueAt}
          showCc={data.wallet.remaining === 0}
        />
      ) : null}

      {/* ---------- 2CC journey ---------- */}
      {data.wallet.remaining === 0 && data.wallet.verified > 0 ? (
        <section className="raised-panel rounded-[28px] p-5 animate-rise-in">
          <p className="text-[10px] uppercase tracking-[0.18em] text-brand-glow">2CC journey</p>
          <h2 className="mt-1 font-display text-lg font-semibold">Work towards your 2CC target</h2>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full brand-gradient"
              style={{
                width: `${Math.min(100, Math.round((data.wallet.ccVerified / Math.max(1, data.wallet.ccTarget)) * 100))}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {Math.min(
              100,
              Math.round((data.wallet.ccVerified / Math.max(1, data.wallet.ccTarget)) * 100),
            )}
            % complete
          </p>
          <PaymentClaimForm
            purpose="two_cc"
            profile={data.profile}
            defaultAmount={data.wallet.ccRemaining}
            onSent={refresh}
          />
        </section>
      ) : null}
    </div>
  );
}
