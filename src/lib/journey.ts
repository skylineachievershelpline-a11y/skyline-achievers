/**
 * Basic Training journey rules: 7 guided sessions, the Final Interview Guide,
 * the Forever Business Plan (session 8) and the Personal Mentorship stage.
 * Pure logic only — safe on the client and the server.
 */

export const BASIC_SESSION_COUNT = 7;

/** Day number and default start time for every basic session. */
export const SESSION_PLAN: { session: number; day: number; time: string }[] = [
  { session: 1, day: 1, time: "20:00" },
  { session: 2, day: 2, time: "16:00" },
  { session: 3, day: 2, time: "20:00" },
  { session: 4, day: 3, time: "16:00" },
  { session: 5, day: 3, time: "20:00" },
  { session: 6, day: 4, time: "16:00" },
  { session: 7, day: 4, time: "20:00" },
];

export type JourneyPolicy = {
  mentorshipFeePkr: number;
  mentorshipDays: number;
  ccTargetFullPayment: number;
  ccTargetPartial: number;
  mentorshipSeats: number;
};

export const DEFAULT_POLICY: JourneyPolicy = {
  mentorshipFeePkr: 50000,
  mentorshipDays: 5,
  ccTargetFullPayment: 150000,
  ccTargetPartial: 200000,
  mentorshipSeats: 3,
};

export type JourneyStage =
  | "sessions"
  | "interview_guide"
  | "ready_for_interview"
  | "interview_passed"
  | "reassess"
  | "mentorship";

export type ReviewStatus = "none" | "pending" | "approved" | "rejected";

export type JourneySession = {
  sessionNumber: number;
  dayNumber: number;
  sessionId: string | null;
  title: string;
  thumbnailUrl: string | null;
  scheduledAt: string | null;
  review: ReviewStatus;
  reviewId: string | null;
  reviewBody: string | null;
  reviewImageUrl: string | null;
  reviewVoiceUrl: string | null;
  reviewedAt: string | null;
  uplineNote: string | null;
  uplineVoiceUrl: string | null;
};

/** Builds the seven default date/times starting from tomorrow (or a given day). */
export function defaultSchedule(startDate: Date): { session: number; day: number; at: Date }[] {
  return SESSION_PLAN.map((slot) => {
    const at = new Date(startDate);
    at.setDate(at.getDate() + (slot.day - 1));
    const [hour, minute] = slot.time.split(":").map(Number);
    at.setHours(hour ?? 20, minute ?? 0, 0, 0);
    return { session: slot.session, day: slot.day, at };
  });
}

/** Which session the trainee should be working on right now. */
export function currentSessionNumber(sessions: JourneySession[]): number | null {
  for (const session of sessions) {
    if (session.review !== "approved") return session.sessionNumber;
  }
  return null;
}

export function allSessionsApproved(sessions: JourneySession[]): boolean {
  return (
    sessions.length >= BASIC_SESSION_COUNT &&
    sessions.slice(0, BASIC_SESSION_COUNT).every((session) => session.review === "approved")
  );
}

/** A session can be watched only once its scheduled time has arrived. */
export function sessionOpen(session: JourneySession, nowMs = Date.now()): boolean {
  if (!session.scheduledAt) return false;
  return new Date(session.scheduledAt).getTime() <= nowMs;
}

export function msUntilSession(session: JourneySession, nowMs = Date.now()): number | null {
  if (!session.scheduledAt) return null;
  return new Date(session.scheduledAt).getTime() - nowMs;
}

/** "01:42:18" style countdown. */
export function countdownText(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export type NextAction = {
  /** Where the trainee is right now. */
  where: string;
  /** What they are doing now. */
  now: string;
  /** What comes after this. */
  next: string;
  /** Who has to move: the trainee or their upline. */
  owner: "trainee" | "upline" | "admin";
  /** Deadline or opening time, when there is one. */
  dueAt: string | null;
};

export function nextAction(input: {
  stage: JourneyStage;
  sessions: JourneySession[];
  mentorshipRemaining: number;
  mentorshipDueAt: string | null;
  webinarWatched: boolean;
}): NextAction {
  const { stage, sessions } = input;

  if (stage === "sessions") {
    const number = currentSessionNumber(sessions);
    const session = sessions.find((item) => item.sessionNumber === number);
    if (!session) {
      return {
        where: "Basic Training",
        now: "Your upline is still setting your session timings",
        next: "Session 01 opens once the schedule is ready",
        owner: "upline",
        dueAt: null,
      };
    }
    if (session.review === "pending") {
      return {
        where: `Basic Training — Day 0${session.dayNumber}`,
        now: `Session ${String(session.sessionNumber).padStart(2, "0")} review sent to your upline`,
        next: "Your upline approves the review, then the next session opens",
        owner: "upline",
        dueAt: null,
      };
    }
    if (session.review === "rejected") {
      return {
        where: `Basic Training — Day 0${session.dayNumber}`,
        now: `Session ${String(session.sessionNumber).padStart(2, "0")} review needs to be sent again`,
        next: "Send an improved review to your upline",
        owner: "trainee",
        dueAt: null,
      };
    }
    return {
      where: `Basic Training — Day 0${session.dayNumber}`,
      now: `Watch Session ${String(session.sessionNumber).padStart(2, "0")} and send your review`,
      next: "Your upline approves the review, then the next session opens",
      owner: "trainee",
      dueAt: session.scheduledAt,
    };
  }

  if (stage === "interview_guide") {
    return {
      where: "Final Interview Guide",
      now: "Watch the complete Final Interview Guide",
      next: "Your final interview with your senior",
      owner: "trainee",
      dueAt: null,
    };
  }

  if (stage === "ready_for_interview") {
    return {
      where: "Ready for Final Interview",
      now: "Your senior will take your final interview",
      next: "After you pass, the Forever Business Plan opens",
      owner: "upline",
      dueAt: null,
    };
  }

  if (stage === "reassess") {
    return {
      where: "Final Interview — reassess",
      now: "Go through the guide again and prepare with your upline",
      next: "Re-take the final interview",
      owner: "trainee",
      dueAt: null,
    };
  }

  if (stage === "interview_passed") {
    return {
      where: "Forever Business Plan",
      now: "Watch the Forever Business Plan and open Personal Mentorship",
      next: "Reserve your Personal Mentorship seat",
      owner: "trainee",
      dueAt: null,
    };
  }

  if (!input.webinarWatched) {
    return {
      where: "Personal Mentorship",
      now: "Watch the complete Personal Mentorship webinar",
      next: "Fill the seat reservation form",
      owner: "trainee",
      dueAt: null,
    };
  }

  if (input.mentorshipRemaining > 0) {
    return {
      where: "Personal Mentorship",
      now: "Complete your Personal Mentorship payment",
      next: "Your 2CC journey starts once the payment is verified",
      owner: "trainee",
      dueAt: input.mentorshipDueAt,
    };
  }

  return {
    where: "Personal Mentorship — completed",
    now: "Work towards your 2CC target",
    next: "Assistant Supervisor",
    owner: "trainee",
    dueAt: null,
  };
}
