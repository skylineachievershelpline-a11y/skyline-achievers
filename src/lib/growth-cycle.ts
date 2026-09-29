/**
 * Skyline Growth Executive — 10-day cycle maths.
 *
 * Every month is split into three working cycles in Pakistan time:
 * day 1-10, day 11-20, day 21-month end. Commission is always judged inside
 * one cycle, so a slow month never eats an assistant's strong 10 days.
 */

export type GrowthCycle = { start: string; end: string; label: string; index: 1 | 2 | 3 };

export type EnrollmentTier = { minRate: number; perEnrollment: number };
export type CcTier = { minCount: number; perCc: number };

export type GrowthSettings = {
  /** One-time amount an FBO pays to unlock the feature. */
  unlockFee: number;
  /** How long the unlock stays valid (0 = forever). */
  unlockDays: number;
  enrollmentTiers: EnrollmentTier[];
  ccTiers: CcTier[];
};

export const DEFAULT_GROWTH_SETTINGS: GrowthSettings = {
  unlockFee: 2500,
  unlockDays: 0,
  enrollmentTiers: [
    { minRate: 20, perEnrollment: 70 },
    { minRate: 30, perEnrollment: 90 },
    { minRate: 40, perEnrollment: 110 },
    { minRate: 50, perEnrollment: 130 },
  ],
  ccTiers: [
    { minCount: 1, perCc: 3000 },
    { minCount: 2, perCc: 5000 },
  ],
};

const PKT_OFFSET_MINUTES = 5 * 60;

/** Year/month/day as seen in Pakistan. */
export function pktParts(at: Date = new Date()) {
  const shifted = new Date(at.getTime() + PKT_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The 10-day cycle a moment belongs to. */
export function cycleOf(at: Date = new Date()): GrowthCycle {
  const { year, month, day } = pktParts(at);
  const last = daysInMonth(year, month);
  const index: 1 | 2 | 3 = day <= 10 ? 1 : day <= 20 ? 2 : 3;
  const startDay = index === 1 ? 1 : index === 2 ? 11 : 21;
  const endDay = index === 1 ? 10 : index === 2 ? 20 : last;
  return {
    start: iso(year, month, startDay),
    end: iso(year, month, endDay),
    label: `Cycle ${index} (${startDay}-${endDay})`,
    index,
  };
}

/** Milliseconds left in the cycle, plus a friendly day/hour split. */
export function cycleCountdown(cycle: GrowthCycle, now: Date = new Date()) {
  // Cycle ends at the close of its last day, Pakistan time.
  const endUtc = new Date(`${cycle.end}T23:59:59+05:00`).getTime();
  const ms = Math.max(0, endUtc - now.getTime());
  return {
    ms,
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
  };
}

/** Timestamp inside the cycle? Dates are compared in Pakistan time. */
export function inCycle(cycle: GrowthCycle, when: string | null | undefined) {
  if (!when) return false;
  const p = pktParts(new Date(when));
  const day = iso(p.year, p.month, p.day);
  return day >= cycle.start && day <= cycle.end;
}

const pickRate = (tiers: EnrollmentTier[], rate: number) =>
  [...tiers]
    .sort((a, b) => a.minRate - b.minRate)
    .reduce((best, tier) => (rate >= tier.minRate ? tier.perEnrollment : best), 0);

const pickCc = (tiers: CcTier[], count: number) =>
  [...tiers]
    .sort((a, b) => a.minCount - b.minCount)
    .reduce((best, tier) => (count >= tier.minCount ? tier.perCc : best), 0);

export type CycleInput = { leads: number; enrolled: number; ccDone: number };

export type CycleEarnings = {
  leads: number;
  enrolled: number;
  ccDone: number;
  /** Enrolled out of the leads actually worked, as a percentage. */
  conversionRate: number;
  enrollmentRate: number;
  enrollmentAmount: number;
  ccRate: number;
  ccAmount: number;
  total: number;
  /** What the next step up needs, so the assistant can chase it. */
  nextEnrollmentTier: EnrollmentTier | null;
  nextCcTier: CcTier | null;
};

/** Commission for one assistant inside one 10-day cycle. */
export function cycleEarnings(input: CycleInput, settings: GrowthSettings): CycleEarnings {
  const rate = input.leads > 0 ? (input.enrolled / input.leads) * 100 : 0;
  const enrollmentRate = pickRate(settings.enrollmentTiers, rate);
  const ccRate = pickCc(settings.ccTiers, input.ccDone);
  const nextEnrollmentTier =
    [...settings.enrollmentTiers].sort((a, b) => a.minRate - b.minRate).find((t) => rate < t.minRate) ?? null;
  const nextCcTier =
    [...settings.ccTiers].sort((a, b) => a.minCount - b.minCount).find((t) => input.ccDone < t.minCount) ?? null;
  const enrollmentAmount = input.enrolled * enrollmentRate;
  const ccAmount = input.ccDone * ccRate;
  return {
    leads: input.leads,
    enrolled: input.enrolled,
    ccDone: input.ccDone,
    conversionRate: Math.round(rate * 10) / 10,
    enrollmentRate,
    enrollmentAmount,
    ccRate,
    ccAmount,
    total: enrollmentAmount + ccAmount,
    nextEnrollmentTier,
    nextCcTier,
  };
}

export const money = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-PK")}`;
