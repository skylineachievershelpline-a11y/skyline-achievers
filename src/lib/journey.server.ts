/** Server-only helpers for the Basic Training journey. */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_POLICY, normalizePaymentMethods, type JourneyPolicy } from "./journey";
import { RESOURCE_BUCKET, THUMBNAIL_BUCKET, signPath } from "./storage.server";

const admin = supabaseAdmin as any;

/** Admin-configurable policy values, with safe fallbacks. */
export async function loadPolicy(): Promise<JourneyPolicy> {
  const { data } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "journey_policy")
    .maybeSingle();
  const value = (data?.value ?? {}) as Partial<JourneyPolicy>;
  return {
    mentorshipFeePkr: Number(value.mentorshipFeePkr ?? DEFAULT_POLICY.mentorshipFeePkr),
    mentorshipDays: Number(value.mentorshipDays ?? DEFAULT_POLICY.mentorshipDays),
    ccTargetFullPayment: Number(value.ccTargetFullPayment ?? DEFAULT_POLICY.ccTargetFullPayment),
    ccTargetPartial: Number(value.ccTargetPartial ?? DEFAULT_POLICY.ccTargetPartial),
    mentorshipSeats: Number(value.mentorshipSeats ?? DEFAULT_POLICY.mentorshipSeats),
    ccDays: Number(value.ccDays ?? DEFAULT_POLICY.ccDays),
    paymentMethods: normalizePaymentMethods(value.paymentMethods),
  };
}

/** One upline's master session schedule, or the system default. */
export async function loadUplineSchedule(uplineId: string | null | undefined) {
  const { DEFAULT_MASTER_SLOTS, normalizeMasterSlots } = await import("./journey");
  if (!uplineId) return DEFAULT_MASTER_SLOTS;
  const { data } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", `upline_schedule:${uplineId}`)
    .maybeSingle();
  const value = (data?.value ?? null) as any;
  if (!value) return DEFAULT_MASTER_SLOTS;
  return normalizeMasterSlots(value.slots ?? value);
}

export async function saveUplineSchedule(uplineId: string, slots: unknown) {
  const { normalizeMasterSlots } = await import("./journey");
  const rows = normalizeMasterSlots(slots);
  const { error } = await admin
    .from("platform_settings")
    .upsert({ key: `upline_schedule:${uplineId}`, value: { slots: rows } }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return rows;
}

/**
 * Every trainee needs real session timings. When the upline has not set them
 * for this trainee yet, the upline's master schedule (or the system default) is
 * applied automatically from the trainee's joining day.
 */
export async function ensureSchedule(trainee: {
  id: string;
  upline_id?: string | null;
  created_at?: string | null;
}) {
  const { count } = await admin
    .from("trainee_session_schedule")
    .select("session_number", { count: "exact", head: true })
    .eq("trainee_id", trainee.id);
  if ((count ?? 0) > 0) return false;

  const { scheduleFromMaster } = await import("./journey");
  const slots = await loadUplineSchedule(trainee.upline_id ?? null);
  const joinedAt = trainee.created_at ? new Date(trainee.created_at).getTime() : Date.now();
  const planned = scheduleFromMaster(slots, joinedAt);
  const { basic } = await loadJourneySessions();

  const rows = planned.map((slot) => {
    const session = basic.find(
      (row: any, index: number) => Number(row.session_number ?? index + 1) === slot.session,
    ) as any;
    return {
      trainee_id: trainee.id,
      session_id: session?.id ?? null,
      session_number: slot.session,
      day_number: slot.day,
      scheduled_at: slot.atIso,
      created_by: trainee.upline_id ?? null,
    };
  });
  if (rows.length === 0) return false;
  await admin
    .from("trainee_session_schedule")
    .upsert(rows, { onConflict: "trainee_id,session_number" });
  return true;
}

/**
 * No fixed dates: when the current session's 3-hour window passes without a
 * review, that session and every later session without a review move forward
 * by whole days (same clock times) until the next live slot. Returns true when
 * anything moved.
 */
export async function rollMissedSessions(traineeId: string, nowMs = Date.now()) {
  const { SESSION_WINDOW_HOURS } = await import("./journey");
  const [{ data: schedule }, { data: reviews }] = await Promise.all([
    admin
      .from("trainee_session_schedule")
      .select("id, session_number, scheduled_at")
      .eq("trainee_id", traineeId)
      .order("session_number", { ascending: true }),
    admin
      .from("trainee_session_reviews")
      .select("session_number, status, created_at")
      .eq("trainee_id", traineeId)
      .order("created_at", { ascending: true }),
  ]);
  // Latest review per session; a rejected review counts as "not reviewed" so
  // the session rolls to the next day and is watched again.
  const latest = new Map<number, string>();
  for (const row of (reviews ?? []) as any[]) latest.set(Number(row.session_number), row.status);
  const reviewed = new Set(
    [...latest.entries()].filter(([, status]) => status !== "rejected").map(([n]) => n),
  );
  const rows = ((schedule ?? []) as any[]).filter((row) => row.scheduled_at);
  const current = rows.find((row) => !reviewed.has(Number(row.session_number)));
  if (!current) return false;

  const windowMs = SESSION_WINDOW_HOURS * 3_600_000;
  const start = new Date(current.scheduled_at).getTime();
  const day = 86_400_000;

  // Sequential pull-forward: when every earlier session is approved, the next
  // session is not held back for its calendar date — it moves to the earliest
  // upcoming occurrence of its own clock time (whole days, same time).
  const earlierApproved = rows
    .filter((row) => Number(row.session_number) < Number(current.session_number))
    .every((row) => latest.get(Number(row.session_number)) === "approved");
  if (earlierApproved && start - nowMs >= day) {
    const pull = Math.floor((start - nowMs) / day) * day;
    const later = rows.filter(
      (row) =>
        Number(row.session_number) >= Number(current.session_number) &&
        !reviewed.has(Number(row.session_number)),
    );
    await Promise.all(
      later.map((row) =>
        admin
          .from("trainee_session_schedule")
          .update({ scheduled_at: new Date(new Date(row.scheduled_at).getTime() - pull).toISOString() })
          .eq("id", row.id),
      ),
    );
    return true;
  }

  if (nowMs <= start + windowMs) return false;

  const shiftDays = Math.ceil((nowMs - (start + windowMs)) / day);
  const shift = shiftDays * day;
  const later = rows.filter(
    (row) =>
      Number(row.session_number) >= Number(current.session_number) &&
      !reviewed.has(Number(row.session_number)),
  );
  await Promise.all(
    later.map((row) =>
      admin
        .from("trainee_session_schedule")
        .update({ scheduled_at: new Date(new Date(row.scheduled_at).getTime() + shift).toISOString() })
        .eq("id", row.id),
    ),
  );
  return true;
}

export async function ensureJourney(traineeId: string) {
  const { data } = await admin
    .from("trainee_journey")
    .select("*")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (data) return data;
  await admin.from("trainee_journey").insert({ trainee_id: traineeId }).select();
  const { data: created } = await admin
    .from("trainee_journey")
    .select("*")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  return created;
}

/** The published basic sessions in journey order, plus the special sessions. */
export async function loadJourneySessions() {
  const { data } = await admin
    .from("beginner_sessions")
    .select(
      "id, title, description, thumbnail_path, session_number, day_number, session_kind, sort_order",
    )
    .eq("is_published", true)
    .order("session_number", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as any[];
  const basic = rows
    .filter((row) => (row.session_kind ?? "basic") === "basic")
    .sort((a, b) => (a.session_number ?? 99) - (b.session_number ?? 99));
  let businessPlan = rows.find((row) => row.session_kind === "business_plan") ?? null;
  // No session marked as the business plan yet: the 8th basic session is Session 08.
  if (!businessPlan && basic.length > 7) {
    businessPlan = basic[7];
    basic.splice(7);
  }
  return {
    basic,
    businessPlan,
    interviewGuide: rows.find((row) => row.session_kind === "interview_guide") ?? null,
    webinar: rows.find((row) => row.session_kind === "mentorship_webinar") ?? null,
  };
}

export async function signThumb(path: string | null | undefined) {
  return signPath(THUMBNAIL_BUCKET, path ?? null, 60 * 60 * 6);
}

export async function signProof(path: string | null | undefined) {
  return signPath(RESOURCE_BUCKET, path ?? null, 60 * 60 * 6);
}

/** Member payment screenshots live separately from training review media. */
export async function signMemberPaymentProof(path: string | null | undefined) {
  return signPath("payment-proofs", path ?? null, 60 * 60 * 6);
}

/** Verified mentorship / 2CC totals from the ledger. */
export async function loadLedger(payerId: string) {
  const { data } = await admin
    .from("payment_submissions")
    .select(
      "id, purpose, claimed_amount_pkr, verified_amount_pkr, status, method, proof_path, admin_note, created_at, verified_at",
    )
    .eq("payer_id", payerId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as any[];
  const total = (purpose: string) =>
    rows
      .filter((row) => row.purpose === purpose && row.status === "verified")
      .reduce((sum, row) => sum + Number(row.verified_amount_pkr ?? 0), 0);

  return {
    rows: rows.map((row) => ({
      id: row.id as string,
      purpose: row.purpose as string,
      claimed: Number(row.claimed_amount_pkr ?? 0),
      verified: Number(row.verified_amount_pkr ?? 0),
      status: row.status as string,
      method: (row.method ?? null) as string | null,
      proofPath: (row.proof_path ?? null) as string | null,
      adminNote: (row.admin_note ?? null) as string | null,
      createdAt: row.created_at as string,
      verifiedAt: (row.verified_at ?? null) as string | null,
    })),
    mentorshipPaid: total("mentorship"),
    ccPaid: total("two_cc"),
    pendingCount: rows.filter((row) => row.status === "pending").length,
  };
}

/**
 * After an upline changes the master schedule, every one of their trainees gets
 * the new clock times for sessions that have no review yet. Missed sessions
 * then roll forward to the next live slot.
 */
export async function syncTraineesToSchedule(uplineId: string) {
  const { scheduleFromMaster } = await import("./journey");
  const slots = await loadUplineSchedule(uplineId);
  const { data: trainees } = await admin
    .from("trainees")
    .select("id, upline_id, created_at")
    .eq("upline_id", uplineId);
  for (const trainee of (trainees ?? []) as any[]) {
    await ensureSchedule(trainee);
    const { data: reviews } = await admin
      .from("trainee_session_reviews")
      .select("session_number")
      .eq("trainee_id", trainee.id);
    const reviewed = new Set(((reviews ?? []) as any[]).map((r) => Number(r.session_number)));
    const joinedAt = trainee.created_at ? new Date(trainee.created_at).getTime() : Date.now();
    const planned = scheduleFromMaster(slots, joinedAt);
    await Promise.all(
      planned
        .filter((slot) => !reviewed.has(slot.session))
        .map((slot) =>
          admin
            .from("trainee_session_schedule")
            .update({ scheduled_at: slot.atIso, day_number: slot.day })
            .eq("trainee_id", trainee.id)
            .eq("session_number", slot.session),
        ),
    );
    await rollMissedSessions(trainee.id);
  }
}
