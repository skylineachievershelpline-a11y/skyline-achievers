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
    paymentMethods: normalizePaymentMethods(value.paymentMethods),
  };
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
  return {
    basic,
    interviewGuide: rows.find((row) => row.session_kind === "interview_guide") ?? null,
    businessPlan: rows.find((row) => row.session_kind === "business_plan") ?? null,
    webinar: rows.find((row) => row.session_kind === "mentorship_webinar") ?? null,
  };
}

export async function signThumb(path: string | null | undefined) {
  return signPath(THUMBNAIL_BUCKET, path ?? null, 60 * 60 * 6);
}

export async function signProof(path: string | null | undefined) {
  return signPath(RESOURCE_BUCKET, path ?? null, 60 * 60 * 6);
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
