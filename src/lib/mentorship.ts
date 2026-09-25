/**
 * Personal Mentorship fee rules and Forever Living rank targets.
 * Pure logic only — safe on the client and the server.
 */

export const MENTORSHIP_FEE_PKR = 50000;
/** Days a new member gets to clear the Personal Mentorship fee. */
export const MENTORSHIP_DAYS = 3;
/** Extra days the admin may grant after a short payment. */
export const MAX_MENTORSHIP_EXTENSIONS = 3;
/** Days a member gets to finish the first 2 CC once the fee is clear. */
export const CC_DAYS = 7;
export const MAX_CC_EXTENSIONS = 3;

export type RankTarget = {
  /** Rank the member is working towards. */
  next: string;
  /** Case Credits needed for that rank, when it is a CC target. */
  cc: number | null;
  /** Plain requirement text when the rank is earned by developing leaders. */
  note: string | null;
};

/**
 * Forever Living marketing plan targets, keyed by the member's current level slug.
 * Case Credit numbers are the totals required to reach the next rank.
 */
export const RANK_TARGETS: Record<string, RankTarget> = {
  "personal-mentorship": { next: "Assistant Supervisor", cc: 2, note: null },
  "assistant-supervisor-training": { next: "Supervisor", cc: 25, note: null },
  "supervisor-training": { next: "Assistant Manager", cc: 75, note: null },
  "assistant-manager-training": { next: "Manager", cc: 120, note: null },
  "manager-training": {
    next: "Senior Manager",
    cc: null,
    note: "Develop 2 Managers in your team",
  },
  "senior-manager": { next: "Soaring Manager", cc: null, note: "Develop 5 Managers in your team" },
  "soaring-manager": { next: "Sapphire Manager", cc: null, note: "Develop 9 Managers in your team" },
  "sapphire-manager": {
    next: "Diamond-Sapphire Manager",
    cc: null,
    note: "Develop 17 Managers in your team",
  },
  "diamond-sapphire-manager": {
    next: "Diamond Manager",
    cc: null,
    note: "Develop 25 Managers in your team",
  },
  "diamond-manager": {
    next: "Double Diamond Manager",
    cc: null,
    note: "Develop 50 Managers in your team",
  },
  "double-diamond-manager": {
    next: "Triple Diamond Manager",
    cc: null,
    note: "Develop 75 Managers in your team",
  },
  "triple-diamond-manager": {
    next: "Centurion Manager",
    cc: null,
    note: "Develop 150 Managers in your team",
  },
  "centurion-manager": { next: "Highest rank reached", cc: null, note: "Keep leading your team" },
};

export type MemberProgressInput = {
  levelSlug: string | null;
  feeTotal: number;
  feePaid: number;
  dueAt: string | null;
  extensions: number;
  completedAt: string | null;
  ccDueAt: string | null;
  ccExtensions: number;
  trainingLocked: boolean;
  /** Case Credits reported on this level so far. */
  ccDone: number;
};

export type MemberProgress = {
  feeTotal: number;
  feePaid: number;
  feeRemaining: number;
  feeComplete: boolean;
  feePercent: number;
  /** Deadline for the fee (or the CC target once the fee is clear). */
  dueAt: string | null;
  msLeft: number | null;
  expired: boolean;
  /** 0 = no warning yet, 1 = first, 2 = second, 3 = final warning. */
  warningStage: number;
  warning: string | null;
  /** Fee not clear yet: every section stays locked. */
  feeLocked: boolean;
  /** Part payment received: training stays open with admin-picked sections. */
  partialTraining: boolean;
  /** Training stays locked (fee pending, or the CC deadline ran out). */
  trainingLocked: boolean;
  ccDueAt: string | null;
  ccMsLeft: number | null;
  ccExpired: boolean;
  ccTarget: number | null;
  ccDone: number;
  ccRemaining: number | null;
  ccPercent: number;
  nextRank: string;
  requirementNote: string | null;
};

function msUntil(value: string | null, nowMs: number): number | null {
  if (!value) return null;
  return new Date(value).getTime() - nowMs;
}

export function computeMemberProgress(
  input: MemberProgressInput,
  nowMs: number = Date.now(),
): MemberProgress {
  const feeTotal = Math.max(0, Number(input.feeTotal) || 0);
  const feePaid = Math.max(0, Number(input.feePaid) || 0);
  const feeRemaining = Math.max(0, feeTotal - feePaid);
  const feeComplete = feeRemaining <= 0 || Boolean(input.completedAt);

  const feeMsLeft = msUntil(input.dueAt, nowMs);
  const feeExpired = feeMsLeft !== null && feeMsLeft <= 0;

  const ccMsLeft = msUntil(input.ccDueAt, nowMs);
  const ccExpired = ccMsLeft !== null && ccMsLeft <= 0;

  const target = RANK_TARGETS[input.levelSlug ?? ""] ?? {
    next: "Next rank",
    cc: null,
    note: null,
  };
  const ccDone = Math.max(0, Number(input.ccDone) || 0);
  const ccRemaining = target.cc === null ? null : Math.max(0, target.cc - ccDone);
  const ccPercent = target.cc ? Math.min(100, Math.round((ccDone / target.cc) * 100)) : 0;

  let warningStage = 0;
  let warning: string | null = null;

  if (!feeComplete) {
    warningStage = Math.min(3, Math.max(1, input.extensions + 1));
    if (input.extensions >= MAX_MENTORSHIP_EXTENSIONS || (feeExpired && input.extensions >= 2)) {
      warningStage = 3;
    }
    // Never a suspension threat: an incomplete amount only changes the 2CC target.
    warning =
      warningStage >= 3
        ? "Your Personal Mentorship amount is still incomplete — complete it to keep the lower 2CC target."
        : warningStage === 2
          ? "Your extra time is almost over. Please complete the remaining amount to keep the lower 2CC target."
          : "Complete your Personal Mentorship amount within the time shown to keep the lower 2CC target.";
  } else if (ccRemaining !== null && ccRemaining > 0 && input.ccDueAt) {
    if (ccExpired) {
      warningStage = Math.min(3, input.ccExtensions + 2);
      warning =
        warningStage >= 3
          ? "Final warning: finish your 2 CC now, training will be locked otherwise."
          : "Your 2 CC time is over. You have extra time — finish it now.";
    }
  }

  // Part payment received: training opens, admin decides which sections show.
  const partialTraining = !feeComplete && feePaid > 0;

  const trainingLocked =
    input.trainingLocked ||
    (ccExpired && input.ccExtensions >= MAX_CC_EXTENSIONS && (ccRemaining ?? 0) > 0);

  return {
    feeTotal,
    feePaid,
    feeRemaining,
    feeComplete,
    feePercent: feeTotal ? Math.min(100, Math.round((feePaid / feeTotal) * 100)) : 100,
    dueAt: input.dueAt,
    msLeft: feeMsLeft,
    expired: feeExpired,
    warningStage,
    warning,
    feeLocked: !feeComplete,
    partialTraining,
    trainingLocked,
    ccDueAt: input.ccDueAt,
    ccMsLeft,
    ccExpired,
    ccTarget: target.cc,
    ccDone,
    ccRemaining,
    ccPercent,
    nextRank: target.next,
    requirementNote: target.note,
  };
}

/** "1d 04:22:11" style countdown text. */
export function formatCountdown(msLeft: number | null): string {
  if (msLeft === null) return "—";
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatPkr(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString("en-PK")}`;
}
