export const SESSION_MAX_SCORE: Record<number, number> = {
  1: 15,
  2: 15,
  3: 14,
  4: 14,
  5: 14,
  6: 14,
  7: 14,
};

export const JOURNEY_MAX_SCORE = 100;

export function maxScoreForSession(sessionNumber: number) {
  return SESSION_MAX_SCORE[sessionNumber] ?? 0;
}

export type PerformanceCategory = {
  label: string;
  detail: string;
  tone: "excellent" | "good" | "developing" | "needs-attention";
};

export function performanceCategory(score: number, completedSessions: number): PerformanceCategory {
  if (completedSessions < 7) {
    return {
      label: "Training in progress",
      detail: `${completedSessions} of 7 sessions scored`,
      tone: "developing",
    };
  }
  if (score >= 85) {
    return {
      label: "Best performance",
      detail: "Excellent reviews and training discipline",
      tone: "excellent",
    };
  }
  if (score >= 70) {
    return {
      label: "Strong performance",
      detail: "Good understanding with consistent participation",
      tone: "good",
    };
  }
  if (score >= 50) {
    return {
      label: "Developing performance",
      detail: "Progress is visible; further guidance will help",
      tone: "developing",
    };
  }
  return {
    label: "Needs attention",
    detail: "More revision, punctuality and upline support are recommended",
    tone: "needs-attention",
  };
}

export function attendanceCategory(joinLateMinutes: number | null, opened: boolean) {
  if (!opened) return "Not attended";
  const minutes = Math.max(0, joinLateMinutes ?? 0);
  if (minutes <= 10) return "On time";
  if (minutes <= 30) return "Slightly late";
  if (minutes <= 60) return "Late";
  return "Very late";
}