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

/** A payment channel the office has configured. Nothing here is hard-coded. */
export type PaymentMethod = {
  name: string;
  accountTitle: string;
  accountNumber: string;
  instructions: string;
  qrUrl: string;
};

export type JourneyPolicy = {
  mentorshipFeePkr: number;
  mentorshipDays: number;
  ccTargetFullPayment: number;
  ccTargetPartial: number;
  mentorshipSeats: number;
  paymentMethods: PaymentMethod[];
};

export const DEFAULT_POLICY: JourneyPolicy = {
  mentorshipFeePkr: 50000,
  mentorshipDays: 5,
  ccTargetFullPayment: 150000,
  ccTargetPartial: 200000,
  mentorshipSeats: 3,
  paymentMethods: [],
};

/** Keeps stored payment methods to the known shape. */
export function normalizePaymentMethods(value: unknown): PaymentMethod[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      return {
        name: String(row["name"] ?? "").trim(),
        accountTitle: String(row["accountTitle"] ?? "").trim(),
        accountNumber: String(row["accountNumber"] ?? "").trim(),
        instructions: String(row["instructions"] ?? "").trim(),
        qrUrl: String(row["qrUrl"] ?? "").trim(),
      };
    })
    .filter((row) => row.name.length > 0);
}

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
  /** When the trainee actually opened the video for the first time. */
  openedAt?: string | null;
  /** When the review was submitted (used for the on-time / late record). */
  reviewSubmittedAt?: string | null;
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

/** Pakistan is UTC+5 all year; every session time is a Pakistan time. */
export const PKT_OFFSET_HOURS = 5;

/** One row of an upline's master schedule: which day and what time. */
export type MasterSlot = { session: number; day: number; time: string };

export const DEFAULT_MASTER_SLOTS: MasterSlot[] = SESSION_PLAN.map((slot) => ({
  session: slot.session,
  day: slot.day,
  time: slot.time,
}));

/** Keeps a saved master schedule to the known 7-session shape. */
export function normalizeMasterSlots(value: unknown): MasterSlot[] {
  const rows = Array.isArray(value) ? value : [];
  return DEFAULT_MASTER_SLOTS.map((fallback) => {
    const found = rows.find(
      (entry) => Number((entry as any)?.session) === fallback.session,
    ) as any;
    const time = String(found?.time ?? "").match(/^\d{1,2}:\d{2}$/)
      ? String(found.time).padStart(5, "0")
      : fallback.time;
    const day = Number(found?.day);
    return {
      session: fallback.session,
      day: Number.isFinite(day) && day >= 1 && day <= 30 ? day : fallback.day,
      time,
    };
  });
}

/** The Pakistan calendar day that the given moment falls on. */
export function pktDayParts(ms: number): { y: number; m: number; d: number } {
  const shifted = new Date(ms + PKT_OFFSET_HOURS * 3_600_000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

/** Turns "day 2 at 16:00 Pakistan time" into a real moment (ms since epoch). */
export function pktSlotMs(
  base: { y: number; m: number; d: number },
  dayOffset: number,
  time: string,
): number {
  const [hour, minute] = time.split(":").map(Number);
  return Date.UTC(
    base.y,
    base.m,
    base.d + dayOffset,
    (hour ?? 20) - PKT_OFFSET_HOURS,
    minute ?? 0,
    0,
    0,
  );
}

/**
 * Builds the real session date/times for one trainee from a master schedule.
 * Day 1 is the trainee's joining day; if that day's first session time has
 * already passed, the schedule starts the next day.
 */
export function scheduleFromMaster(
  slots: MasterSlot[],
  joinedAtMs: number,
  nowMs = Date.now(),
): { session: number; day: number; atIso: string }[] {
  const rows = normalizeMasterSlots(slots);
  const first = rows[0] ?? DEFAULT_MASTER_SLOTS[0]!;
  let base = pktDayParts(Math.max(joinedAtMs, nowMs));
  if (pktSlotMs(base, first.day - 1, first.time) <= nowMs) {
    base = pktDayParts(Math.max(joinedAtMs, nowMs) + 86_400_000);
  }
  return rows.map((slot) => ({
    session: slot.session,
    day: slot.day,
    atIso: new Date(pktSlotMs(base, slot.day - 1, slot.time)).toISOString(),
  }));
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

/** How long a session stays open after its scheduled start time. */
export const SESSION_WINDOW_HOURS = 3;

/** When the 3-hour window for a scheduled session closes. */
export function sessionWindowEndMs(scheduledAt: string): number {
  return new Date(scheduledAt).getTime() + SESSION_WINDOW_HOURS * 3_600_000;
}

/**
 * The window has closed and no review was sent, so the session is locked again.
 * Once a review exists the session stays open.
 */
export function sessionExpired(session: JourneySession, nowMs = Date.now()): boolean {
  if (!session.scheduledAt) return false;
  if (session.review !== "none") return false;
  return nowMs > sessionWindowEndMs(session.scheduledAt);
}

/** A session can be watched once its time has arrived and the window is live. */
export function sessionOpen(session: JourneySession, nowMs = Date.now()): boolean {
  if (!session.scheduledAt) return false;
  if (new Date(session.scheduledAt).getTime() > nowMs) return false;
  return !sessionExpired(session, nowMs);
}

/** Milliseconds left in the live 3-hour window, or null when not running. */
export function msLeftInWindow(session: JourneySession, nowMs = Date.now()): number | null {
  if (!session.scheduledAt) return null;
  const start = new Date(session.scheduledAt).getTime();
  if (start > nowMs) return null;
  const left = sessionWindowEndMs(session.scheduledAt) - nowMs;
  return left > 0 ? left : 0;
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
