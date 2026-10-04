import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Eye,
  Loader2,
  Lock,
  PartyPopper,
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
import { formatDateTime12 as formatDateTime } from "@/lib/format";
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
  requestFinalInterview,
} from "@/lib/journey.functions";
import { VoiceGuide } from "@/components/voice/VoiceGuide";
import finalInterviewPoster from "@/assets/final-interview-poster.jpg";
import { PaymentClaimForm } from "./PaymentClaimForm";
import { PaymentWalletCard } from "./PaymentWalletCard";
import { InterviewTimeTag } from "./InterviewTimeTag";
import { SeatAlertTag } from "./SeatAlertTag";
import { SessionReviewForm } from "./SessionReviewForm";
import { youtubeId } from "@/components/media/SecureYouTubePlayer";
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

/** The complete guided journey shown on the trainee's dashboard. */
export function TraineeJourney() {
  const queryClient = useQueryClient();
  const load = useServerFn(getTraineeJourney);
  const loadSeats = useServerFn(getMentorshipSeats);
  const play = useServerFn(playJourneyVideo);
  const watchGuide = useServerFn(markInterviewGuideWatched);
  const watchWebinar = useServerFn(markWebinarWatched);

  const [playing, setPlaying] = useState<Playing | null>(null);
  const [watchedId, setWatchedId] = useState<string | null>(null);
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
  const action = nextAction({
    stage: data.stage,
    sessions: basic,
    mentorshipRemaining: data.wallet.remaining,
    mentorshipDueAt: data.mentorshipDueAt,
    webinarWatched: Boolean(data.webinarWatchedAt),
  });

  if ((data as any).mentorshipAccountCode) {
    return <AccountReady code={(data as any).mentorshipAccountCode as string} />;
  }

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
          onWatched={() => setWatchedId(playing.id)}
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
          playing.videoUrl && youtubeId(playing.videoUrl) && watchedId !== playing.id ? (
            <p className="mt-4 rounded-2xl border border-hairline p-3 text-xs text-muted-foreground">
              Poori video dekhne ke baad review form yahan khulega.
            </p>
          ) : (
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
      <InterviewTimeTag scheduledAt={(data as any).interviewScheduledAt ?? null} />

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
                    {sessionExpired(current, now) && current.review === "pending" ? (
                      <>
                        <p className="text-sm font-semibold text-amber-300">Review pending</p>
                        <p className="text-[11px] text-muted-foreground">
                          Your upline is checking it. The 3-hour session window has closed.
                        </p>
                      </>
                    ) : sessionExpired(current, now) ? (
                      <>
                        <p className="text-sm font-semibold text-brand-glow">Moving to the next day</p>
                        <p className="text-[11px] text-muted-foreground">
                          This session moves to the same time tomorrow. Refresh to see the new time.
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
                ) : msLeftInWindow(current, now) !== null && current.review !== "approved" ? (
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
                      Aap ka review reject ho gaya hai. Kal aap ne yehi session dobara dekhna hai, ya
                      upline se rabta kar ke recorded session dekh sakte hain.
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
                  disabled={!sessionOpen(current, now) || open.isPending || !current.sessionId}
                  onClick={() => current.sessionId && open.mutate(current.sessionId)}
                >
                  {open.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )}
                  Start session
                </Button>

                {sessionOpen(current, now) &&
                current.review !== "pending" &&
                current.review !== "approved" ? (
                  <SessionReviewForm
                    sessionNumber={current.sessionNumber}
                    onSent={() => refresh()}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              All seven sessions are approved. Your Final Interview Guide is next.
            </p>
          )}
        </section>
      ) : null}

      {/* ---------- try again: the senior did not pass this attempt ---------- */}
      {data.stage === "reassess" ? (
        <section className="raised-panel rounded-[28px] border-2 border-destructive/40 bg-destructive/10 p-5 animate-rise-in">
          <p className="text-[10px] uppercase tracking-[0.18em] text-destructive">Try again</p>
          <h2 className="mt-1 font-display text-lg font-semibold">
            Final Interview is baar clear nahi hua
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Himmat na harein — ye sirf ek qadam hai. Guide video dobara dhyan se dekhein, apne upline
            se baat karein aur naya interview time lein. Aap taiyar hon to neeche se dobara "I'm
            ready" bhej sakte hain.
          </p>
          {data.interviewMarks != null ? (
            <p className="mt-3 text-xs font-semibold text-destructive">
              Aap ke marks: {data.interviewMarks} / {data.interviewMaxMarks ?? 25}
            </p>
          ) : null}
        </section>
      ) : null}


      {/* ---------- final interview guide: stays open until the result is in ---------- */}
      {data.stage === "interview_guide" ||
      data.stage === "reassess" ||
      data.stage === "ready_for_interview" ? (
        <section className="raised-panel overflow-hidden rounded-[28px] animate-rise-in">
          <div className="relative aspect-video bg-media">
            <img
              src={data.interviewGuide?.thumbnailUrl ?? finalInterviewPoster}
              alt="Final Interview Guide cover"
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
            <span className="absolute left-3 top-3 rounded-full border border-cyan/30 bg-background/80 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-brand-glow backdrop-blur-sm">
              Final interview guide
            </span>
          </div>
          <div className="p-5">
          <h2 className="mt-1 font-display text-lg font-semibold">
            {data.interviewGuide?.title ?? "Your final interview guide"}
          </h2>

          <p className="mt-2 text-xs text-muted-foreground">
            This video explains what the final interview is, why it matters, how to prepare, how to
            communicate and what to expect. It stays open until your result is shared.
          </p>
          {data.stage === "reassess" && data.interviewNote ? (
            <p className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-200">
              Your senior asked you to prepare again: {data.interviewNote}
            </p>
          ) : null}
          <VoiceGuide
            className="mt-3"
            label="Listen"
            ur="Mubarak ho, aap ne saat sessions mukammal kar liye hain. Ab ye Final Interview Guide video poori dekhein, phir apne upline se final interview dein. Interview pass hone ke baad Forever Business Plan wala session khul jayega."
            en="Congratulations, you have completed all seven sessions. Watch this Final Interview Guide completely, then take your final interview with your upline. The Forever Business Plan session unlocks after you pass."
          />
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
          </div>
        </section>

      ) : null}

      {data.stage === "ready_for_interview" ? (
        <InterviewReadyCard
          requestedAt={(data as any).interviewRequestedAt ?? null}
          scheduledAt={(data as any).interviewScheduledAt ?? null}
          onDone={refresh}
        />
      ) : null}

      {/* ---------- session 08 locked preview: no timing, interview gate only ---------- */}
      {data.stage === "interview_guide" ||
      data.stage === "reassess" ||
      data.stage === "ready_for_interview" ? (
        <section className="glass-panel overflow-hidden rounded-[28px] animate-rise-in">
          <div className="relative aspect-video bg-media">
            {data.businessPlan?.thumbnailUrl ? (
              <img
                src={data.businessPlan.thumbnailUrl}
                alt="Forever Business Plan cover"
                className="h-full w-full object-cover opacity-60"
              />
            ) : null}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/75 px-6 text-center backdrop-blur-sm">
              <Lock className="h-6 w-6 text-brand-glow" />
              <p className="text-sm font-semibold">Locked</p>
              <p className="text-[11px] text-muted-foreground">
                This session can only be opened after you pass your Final Interview.
              </p>
            </div>
          </div>
          <div className="p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-brand-glow">Session 08</p>
            <h2 className="mt-1 font-display text-lg font-semibold">
              {data.businessPlan?.title ?? "Forever Business Plan"}
            </h2>
          </div>
        </section>
      ) : null}

      {/* ---------- session 08: Forever Business Plan ---------- */}
      {data.stage === "interview_passed" || data.stage === "mentorship" ? (
        <>
          {data.stage === "interview_passed" ? (
            <section className="raised-panel rounded-[28px] p-5 text-center animate-scale-in">
              <PartyPopper className="mx-auto h-8 w-8 text-brand-glow" />
              <p className="mt-3 font-display text-lg font-semibold">
                Congratulations! You have passed your Final Interview
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your Forever Business Plan session is now unlocked. Watch it completely to move on to
                Personal Mentorship.
              </p>
            </section>
          ) : null}

          <SeatAlertTag startSeats={seats?.available ?? 3} />

          <section className="raised-panel metal-edge overflow-hidden rounded-[28px] animate-rise-in">
            <button
              type="button"
              className="relative block aspect-video w-full bg-media"
              disabled={!data.businessPlan}
              onClick={() => data.businessPlan && open.mutate(data.businessPlan.id)}
            >
              {data.businessPlan?.thumbnailUrl ? (
                <img
                  src={data.businessPlan.thumbnailUrl}
                  alt={`${data.businessPlan.title} cover`}
                  className="h-full w-full object-cover"
                />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center bg-background/25">
                <span className="flex h-14 w-14 items-center justify-center rounded-full brand-gradient shadow-brand">
                  <PlayCircle className="h-7 w-7 text-primary-foreground" />
                </span>
              </span>
            </button>
            <div className="p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-brand-glow">Session 08</p>
            <h2 className="mt-1 font-display text-lg font-semibold">
              {data.businessPlan?.title ?? "Forever Business Plan"}
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              You passed your final interview, so the business plan session is now open.
            </p>
            <VoiceGuide
              className="mt-3"
              label="Listen"
              ur="Mubarak ho, aap ka final interview pass ho gaya hai. Ab Forever Business Plan wala session poora dekhein. Personal Mentorship ki seats limited hain, is liye jaldi session complete karein — webinar dekhne ke baad payment ka option khul jayega."
              en="Congratulations, you passed your final interview. Watch the complete Forever Business Plan session now. Personal Mentorship seats are limited, so finish quickly — the payment option opens after you watch the webinar."
            />
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
            </div>
          </section>
        </>
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
              {seats.available} of {Math.max(15, seats.total)} seats available right now
            </p>
          ) : null}

          <ReserveSeat>
            <PaymentClaimForm
              purpose="mentorship"
              profile={data.profile}
              methods={(data as any).paymentMethods ?? []}
              defaultAmount={Math.max(0, data.wallet.remaining || data.wallet.required)}
              onSent={refresh}
            />
          </ReserveSeat>
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

/**
 * Final interview readiness card: before the request the trainee confirms with
 * an availability note; afterwards a red premium alert shows the scheduled
 * time with a live countdown and the high-stakes warning.
 */
function InterviewReadyCard({
  requestedAt,
  scheduledAt,
  onDone,
}: {
  requestedAt: string | null;
  scheduledAt: string | null;
  onDone: () => void;
}) {
  const request = useServerFn(requestFinalInterview);
  const [note, setNote] = useState("");
  const now = useNow();

  const send = useMutation({
    mutationFn: () => request({ data: { availabilityNote: note.trim() || null } } as never),
    onSuccess: () => {
      toast.success("Request sent — aap ke upline ko notification mil gayi hai");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!requestedAt) {
    return (
      <section className="raised-panel metal-edge rounded-[28px] p-5 animate-rise-in">
        <ShieldCheck className="mx-auto h-8 w-8 text-brand-glow" />
        <p className="mt-3 text-center font-display text-lg font-semibold">
          Final Interview ki tayari complete?
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Jab aap poori tarah tayar hon, neeche button dabayen. Aap ke upline ko foran notification
          jayegi aur wo aap ka interview time set karenge.
        </p>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Optional: aap kab kab available hotay hain? (misal: shaam 6 se 9 tak)"
          className="mt-4 w-full rounded-2xl border border-hairline bg-surface-2 p-3 text-sm outline-none focus:border-brand"
        />
        <Button
          variant="brand"
          size="xl"
          className="mt-3 w-full rounded-2xl"
          disabled={send.isPending}
          onClick={() => send.mutate()}
        >
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          I Have Prepared &amp; I'm Ready for the Final Interview
        </Button>
      </section>
    );
  }

  const targetMs = scheduledAt ? new Date(scheduledAt).getTime() : null;
  const left = targetMs !== null ? targetMs - now : null;

  return (
    <section className="rounded-[28px] border-2 border-red-500/60 bg-red-500/10 p-5 shadow-[0_0_40px_rgba(239,68,68,0.25)] animate-rise-in">
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.24em] text-red-400">
        ⚠ Final Interview — Official Notice
      </p>
      {targetMs !== null ? (
        <>
          <p className="mt-3 text-center font-mono text-3xl font-bold tabular-nums text-red-300">
            {left !== null && left > 0 ? countdownText(left) : "Interview time!"}
          </p>
          <p className="mt-1 text-center text-xs font-semibold text-red-200">
            {formatDateTime(scheduledAt!)} (Pakistan time)
          </p>
        </>
      ) : (
        <p className="mt-3 text-center text-sm font-semibold text-red-200">
          Request received — aap ka upline interview ka time set kar raha hai. Notification ka
          intezar karein.
        </p>
      )}
      <div className="mt-4 rounded-2xl border border-red-500/40 bg-background/60 p-3">
        <p className="text-[11px] font-bold text-red-300">Strict Warning</p>
        <p className="mt-1 text-[11px] leading-relaxed text-red-100/90">
          Apne interview se 10 minute pehle online aur tayar rahen. Agar aap muqarrara waqt par
          available nahi hotay ya interview fail ho jata hai, to aap ki training seat revoke ho
          sakti hai aur aap ko poora 7-day curriculum Day 01 se dobara karna par sakta hai. Ek bar
          fail hone par dobara chance mumkin nahi bhi ho sakta — poori tayari ke sath aayen.
        </p>
      </div>
    </section>
  );
}

function ReserveSeat({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) return <>{children}</>;
  return (
    <div className="mt-4">
      <p className="text-xs text-muted-foreground">
        To reserve your Personal Mentorship seat, fill in this official application form with your
        payment screenshot.
      </p>
      <Button variant="brand" size="xl" className="mt-3 w-full rounded-2xl" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" /> Personal Mentorship Application Form
      </Button>
    </div>
  );
}

function AccountReady({ code }: { code: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="raised-panel metal-edge rounded-[30px] p-6 text-center animate-scale-in">
      <PartyPopper className="mx-auto h-10 w-10 text-brand-glow" />
      <h2 className="mt-3 font-display text-xl font-semibold">Welcome to Personal Mentorship</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your payment is verified and your new Skyline Achievers account is ready. This training
        dashboard is now closed — sign in to your new account.
      </p>
      <div className="mt-5 rounded-2xl border border-hairline bg-surface-2 p-4 text-left">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Member ID</p>
        <p className="font-mono text-lg font-bold tracking-wider text-brand-glow">{code}</p>
        <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Password</p>
        <p className="font-mono text-lg font-bold tracking-wider">00000000</p>
        <p className="mt-3 text-[11px] text-muted-foreground">
          You can sign in with this Member ID or your registered mobile number.
        </p>
      </div>
      <Button
        variant="brand"
        size="xl"
        className="mt-5 w-full rounded-2xl"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const { supabase } = await import("@/integrations/supabase/client");
          await supabase.auth.signOut();
          window.location.href = "/";
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Sign in to my new account
      </Button>
    </section>
  );
}
