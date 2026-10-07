import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { JourneySession, JourneyStage, ReviewStatus } from "./journey";

const uuid = z.string().uuid();
const optionalPath = z.string().trim().min(3).max(300).nullish();

async function activeMember(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("member_profiles")
    .select("id, member_id, full_name, status, avatar_path, phone")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") throw new Error("Your membership is not active.");
  return data as any;
}

async function activeTrainee(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("trainees")
    .select(
      "id, trainee_code, full_name, phone, age, status, avatar_path, upline_id, created_at, member_profiles:upline_id (id, member_id, full_name, phone, avatar_path)",
    )
    .eq("id", userId)
    .maybeSingle();
  if (!data || (data as any).status !== "active") throw new Error("Your account is not active.");
  const { ensureSchedule } = await import("./journey.server");
  await ensureSchedule(data as any);
  return data as any;
}

/** Builds the full journey view for one trainee id (used by trainee + upline + admin). */
async function buildJourney(traineeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const {
    ensureJourney,
    ensureSchedule,
    loadJourneySessions,
    loadLedger,
    loadPolicy,
    signProof,
    signThumb,
  } = await import("./journey.server");
  const admin = supabaseAdmin as any;

  // Apply the upline's master schedule when this trainee has no timings yet.
  const { data: traineeRow } = await admin
    .from("trainees")
    .select("id, upline_id, created_at")
    .eq("id", traineeId)
    .maybeSingle();
  if (traineeRow) {
    await ensureSchedule(traineeRow);
    const { rollMissedSessions } = await import("./journey.server");
    await rollMissedSessions(traineeId);
  }

  const [journeyRow, sessionSet, policy, ledger] = await Promise.all([
    ensureJourney(traineeId),
    loadJourneySessions(),
    loadPolicy(),
    loadLedger(traineeId),
  ]);

  const [{ data: schedule }, { data: reviews }, { data: unlocks }] = await Promise.all([
    admin
      .from("trainee_session_schedule")
      .select("session_number, day_number, scheduled_at, session_id")
      .eq("trainee_id", traineeId),
    admin
      .from("trainee_session_reviews")
      .select(
        "id, session_number, body, image_path, image_paths, voice_path, status, score, upline_note, upline_voice_path, reviewed_at, created_at, submitted_at, source",
      )
      .eq("trainee_id", traineeId)
      .order("created_at", { ascending: false }),
    admin
      .from("trainee_session_unlocks")
      .select("session_id, created_at")
      .eq("trainee_id", traineeId),
  ]);

  const scheduleBy = new Map<number, any>(
    ((schedule ?? []) as any[]).map((row) => [Number(row.session_number), row]),
  );
  const openedBy = new Map<string, string>();
  for (const row of (unlocks ?? []) as any[]) {
    if (row.session_id) openedBy.set(row.session_id as string, row.created_at as string);
  }
  const reviewBy = new Map<number, any>();
  for (const row of (reviews ?? []) as any[]) {
    if (!reviewBy.has(Number(row.session_number))) reviewBy.set(Number(row.session_number), row);
  }

  const sessions: JourneySession[] = [];
  for (let index = 0; index < sessionSet.basic.length; index += 1) {
    const row = sessionSet.basic[index] as any;
    const number = Number(row.session_number ?? index + 1);
    const planned = scheduleBy.get(number);
    const review = reviewBy.get(number);
    sessions.push({
      sessionNumber: number,
      dayNumber: Number(planned?.day_number ?? row.day_number ?? 1),
      sessionId: row.id as string,
      title: row.title as string,
      thumbnailUrl: await signThumb(row.thumbnail_path),
      scheduledAt: (planned?.scheduled_at ?? null) as string | null,
      review: (review?.status ?? "none") as ReviewStatus,
      reviewId: (review?.id ?? null) as string | null,
      reviewBody: (review?.body ?? null) as string | null,
      reviewImageUrl: await signProof(review?.image_path),
      reviewImageUrls: (
        await Promise.all(
          ((review?.image_paths?.length ? review.image_paths : review?.image_path ? [review.image_path] : []) as string[]).map((path) => signProof(path)),
        )
      ).filter((url): url is string => Boolean(url)),
      reviewVoiceUrl: await signProof(review?.voice_path),
      reviewedAt: (review?.reviewed_at ?? null) as string | null,
      uplineNote: (review?.upline_note ?? null) as string | null,
      uplineVoiceUrl: await signProof(review?.upline_voice_path),
      openedAt: openedBy.get(row.id as string) ?? null,
      reviewSubmittedAt: (review?.submitted_at ?? review?.created_at ?? null) as string | null,
      reviewSource: (review?.source ?? null) as string | null,
      score: review?.score == null ? null : Number(review.score),
    });
  }


  const special = async (row: any) =>
    row
      ? {
          id: row.id as string,
          title: row.title as string,
          description: (row.description ?? null) as string | null,
          thumbnailUrl: await signThumb(row.thumbnail_path),
        }
      : null;

  const mentorshipRemaining = Math.max(0, policy.mentorshipFeePkr - ledger.mentorshipPaid);
  const ccTarget =
    mentorshipRemaining === 0 && ledger.mentorshipPaid >= policy.mentorshipFeePkr
      ? policy.ccTargetFullPayment
      : policy.ccTargetPartial;

  return {
    trainee: { id: traineeId },
    stage: (journeyRow?.stage ?? "sessions") as JourneyStage,
    interviewGuideWatchedAt: (journeyRow?.interview_guide_watched_at ?? null) as string | null,
    interviewResult: (journeyRow?.interview_result ?? null) as string | null,
    interviewNote: (journeyRow?.interview_note ?? null) as string | null,
    interviewMarks: ((journeyRow as any)?.interview_marks ?? null) as number | null,
    interviewMaxMarks: Number((journeyRow as any)?.interview_max_marks ?? 25),
    interviewTakenBy: ((journeyRow as any)?.interview_taken_by ?? null) as string | null,
    interviewRequestedAt: (journeyRow?.interview_requested_at ?? null) as string | null,
    interviewAvailabilityNote: (journeyRow?.interview_availability_note ?? null) as string | null,
    interviewScheduledAt: (journeyRow?.interview_scheduled_at ?? null) as string | null,
    webinarWatchedAt: (journeyRow?.webinar_watched_at ?? null) as string | null,
    mentorshipDueAt: (journeyRow?.mentorship_due_at ?? null) as string | null,
    sessions,
    interviewGuide: await special(sessionSet.interviewGuide),
    businessPlan: await special(sessionSet.businessPlan),
    webinar: await special(sessionSet.webinar),
    policy,
    wallet: {
      required: policy.mentorshipFeePkr,
      verified: ledger.mentorshipPaid,
      remaining: mentorshipRemaining,
      ccTarget,
      ccVerified: ledger.ccPaid,
      ccRemaining: Math.max(0, ccTarget - ledger.ccPaid),
      pendingCount: ledger.pendingCount,
      history: ledger.rows,
    },
  };
}

/** ---------- Trainee side ---------- */

export const getTraineeJourney = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const trainee = await activeTrainee(context.userId);
    const journey = await buildJourney(trainee.id);
    const { signPath, AVATAR_BUCKET } = await import("./storage.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: methods }, { data: jrow }] = await Promise.all([
      (supabaseAdmin as any)
        .from("course_payment_methods")
        .select("id, label, account_name, account_number, instructions, qr_url")
        .eq("is_active", true)
        .order("sort_order"),
      (supabaseAdmin as any)
        .from("trainee_journey")
        .select("mentorship_account_code")
        .eq("trainee_id", trainee.id)
        .maybeSingle(),
    ]);
    return {
      ...journey,
      mentorshipAccountCode: (jrow?.mentorship_account_code ?? null) as string | null,
      paymentMethods: ((methods ?? []) as any[]).map((m) => ({
        id: m.id as string,
        label: m.label as string,
        accountName: (m.account_name ?? null) as string | null,
        accountNumber: (m.account_number ?? null) as string | null,
        instructions: (m.instructions ?? null) as string | null,
        qrUrl: (m.qr_url ?? null) as string | null,
      })),
      profile: {
        id: trainee.id as string,
        code: trainee.trainee_code as string,
        fullName: trainee.full_name as string,
        phone: (trainee.phone ?? null) as string | null,
        age: (trainee.age ?? null) as number | null,
        avatarUrl: await signPath(AVATAR_BUCKET, trainee.avatar_path ?? null, 3600),
        upline: trainee.member_profiles
          ? {
              id: trainee.member_profiles.id as string,
              name: trainee.member_profiles.full_name as string,
              code: trainee.member_profiles.member_id as string,
              phone: (trainee.member_profiles.phone ?? null) as string | null,
            }
          : null,
      },
    };
  });

/** Signed upload slot for a session review image or voice note. */
export const getReviewUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { extension: string }) =>
    z
      .object({
        extension: z.enum(["png", "jpg", "jpeg", "webp", "webm", "mp3", "m4a", "ogg", "wav"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { RESOURCE_BUCKET } = await import("./storage.server");
    const path = `journey/${context.userId}/${crypto.randomUUID()}.${data.extension}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(RESOURCE_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not prepare the upload.");
    return { path: signed.path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const submitSessionReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sessionNumber: number;
      body: string;
      imagePath?: string | null;
      imagePaths?: string[];
      voicePath?: string | null;
      anyTime?: boolean;
    }) =>
      z
        .object({
          sessionNumber: z.number().int().min(1).max(7),
          body: z.string().trim().max(4000),
          imagePath: optionalPath,
          imagePaths: z.array(z.string().min(1).max(500)).max(10).optional(),
          voicePath: optionalPath,
          anyTime: z.boolean().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const trainee = await activeTrainee(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadJourneySessions } = await import("./journey.server");
    const admin = supabaseAdmin as any;

    const { basic } = await loadJourneySessions();
    const session = basic.find(
      (row: any, index: number) => Number(row.session_number ?? index + 1) === data.sessionNumber,
    );
    if (!session) throw new Error("That session is not available yet.");

    // Missed sessions roll forward to the next day, so nothing is ever closed.
    const { rollMissedSessions } = await import("./journey.server");
    await rollMissedSessions(trainee.id);

    // Scheduled sessions: the start time must have arrived. Sessions opened
    // from a session code link can be reviewed at any time.
    if (false) {
      const { data: slot } = await admin
        .from("trainee_session_schedule")
        .select("scheduled_at")
        .eq("trainee_id", trainee.id)
        .eq("session_number", data.sessionNumber)
        .maybeSingle();
      if (!slot?.scheduled_at) throw new Error("Your upline has not scheduled this session yet.");
      if (new Date(slot.scheduled_at).getTime() > Date.now()) {
        throw new Error("This session opens at its scheduled time.");
      }
    }


    const images = [...(data.imagePaths ?? []), ...(data.imagePath ? [data.imagePath] : [])];
    if (!data.body && images.length === 0 && !data.voicePath) {
      throw new Error("Add a text, a picture or a voice note to send your review.");
    }
    const { error } = await admin.from("trainee_session_reviews").insert({
      trainee_id: trainee.id,
      session_id: (session as any).id,
      session_number: data.sessionNumber,
      body: data.body,
      image_path: images[0] ?? null,
      image_paths: images,
      voice_path: data.voicePath ?? null,
      status: "pending",
      submitted_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);

    // Background alert for the upline, even when their app is closed.
    if (trainee.upline_id) {
      const { pushToUsers } = await import("./push.server");
      await pushToUsers([trainee.upline_id], {
        title: "New review to check",
        body: `${trainee.full_name} ne Session ${String(data.sessionNumber).padStart(2, "0")} ka review bhej diya hai! Abhi check karein.`,
        path: "/dashboard",
        tag: `review-${trainee.id}`,
      });
    }
    return { ok: true as const };
  });

export const markInterviewGuideWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const trainee = await activeTrainee(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureJourney } = await import("./journey.server");
    const journey = await ensureJourney(trainee.id);
    // Stage guard: the guide can only be marked watched from the guide stage
    // (or the reassess loop). Everything else keeps its current stage.
    const stage = (journey as any)?.stage ?? "sessions";
    if (stage !== "interview_guide" && stage !== "reassess") {
      throw new Error("Complete all 7 sessions first — your upline must approve every review.");
    }
    const { error } = await (supabaseAdmin as any)
      .from("trainee_journey")
      .update({
        interview_guide_watched_at: new Date().toISOString(),
        stage: "ready_for_interview",
      })
      .eq("trainee_id", trainee.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Trainee confirms they are ready for the final interview. The upline gets a
 * push + dashboard alert and then decides the interview date/time.
 */
export const requestFinalInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { availabilityNote?: string | null }) =>
    z
      .object({ availabilityNote: z.string().trim().max(500).nullish() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const trainee = await activeTrainee(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureJourney } = await import("./journey.server");
    const journey = await ensureJourney(trainee.id);
    const stage = (journey as any)?.stage ?? "sessions";
    if (stage !== "ready_for_interview" && stage !== "reassess") {
      throw new Error("Pehle Final Interview Guide poori dekhein — phir ready button milega.");
    }
    const { error } = await (supabaseAdmin as any)
      .from("trainee_journey")
      .update({
        interview_requested_at: new Date().toISOString(),
        interview_availability_note: data.availabilityNote ?? null,
      })
      .eq("trainee_id", trainee.id);
    if (error) throw new Error(error.message);
    if (trainee.upline_id) {
      const { pushToUsers } = await import("./push.server");
      await pushToUsers([trainee.upline_id], {
        title: "Final Interview request 🎓",
        body: `${trainee.full_name} Final Interview ke liye ready hai. Dashboard se interview ka time set karein.`,
        path: "/dashboard",
        tag: `interview-request-${trainee.id}`,
      });
    }
    return { ok: true as const };
  });

/** Upline sets (or changes) the final interview date/time for a trainee. */
export const scheduleFinalInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string; scheduledAt: string }) =>
    z
      .object({ traineeId: uuid, scheduledAt: z.string().min(10).max(40) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const trainee = await interviewTrainee(member.id, data.traineeId);
    const when = new Date(data.scheduledAt);
    if (Number.isNaN(when.getTime())) throw new Error("Sahi date aur time choose karein.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureJourney } = await import("./journey.server");
    const journey = await ensureJourney(trainee.id);
    const stage = (journey as any)?.stage ?? "sessions";
    if (stage !== "ready_for_interview" && stage !== "reassess") {
      throw new Error("Ye person abhi final interview ke liye ready nahi hai.");
    }
    const { error } = await (supabaseAdmin as any)
      .from("trainee_journey")
      .update({ interview_scheduled_at: when.toISOString() })
      .eq("trainee_id", trainee.id);
    if (error) throw new Error(error.message);
    const { pushToUsers } = await import("./push.server");
    await pushToUsers([trainee.id], {
      title: "Final Interview scheduled ⏰",
      body: `Aap ka Final Interview ${when.toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" })} (PKT) par hai. 10 minute pehle ready rahen!`,
      path: "/beginners",
      tag: `interview-time-${trainee.id}`,
    });
    return { ok: true as const };
  });

export const markWebinarWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const trainee = await activeTrainee(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureJourney } = await import("./journey.server");
    await ensureJourney(trainee.id);
    const { error } = await (supabaseAdmin as any)
      .from("trainee_journey")
      .update({ webinar_watched_at: new Date().toISOString() })
      .eq("trainee_id", trainee.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * A payment claim. The screenshot is evidence only — nothing is ever added to
 * the wallet here; an admin enters the verified amount separately.
 */
export const submitPaymentClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      purpose: "mentorship" | "two_cc";
      fullName?: string | null;
      method?: string | null;
      claimedAmount: number;
      proofPath: string;
      phone?: string | null;
      email?: string | null;
      age?: number | null;
      note?: string | null;
    }) =>
      z
        .object({
          purpose: z.enum(["mentorship", "two_cc"]),
          fullName: z.string().trim().min(2).max(120).nullish(),
          method: z.string().trim().max(120).nullish(),
          claimedAmount: z.number().min(1, "Enter the amount you paid").max(100_000_000),
          proofPath: z.string().trim().min(3).max(300),
          phone: z.string().trim().max(20).nullish(),
          email: z.string().trim().email().max(120).nullish(),
          age: z.number().int().min(18).max(90).nullish(),
          note: z.string().trim().max(1000).nullish(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const trainee = await activeTrainee(context.userId);
    if (data.purpose === "mentorship" && (!data.phone || !data.email || !data.age || !data.fullName)) {
      throw new Error("Full name, age, active phone number and active email are all required.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Keep the trainee record in step so the new account gets the right details.
    if (data.purpose === "mentorship") {
      // The trainee's own number/email is fine; somebody else's is not.
      const { assertPhoneEmailFree } = await import("./identity-unique.server");
      await assertPhoneEmailFree(
        { phone: data.phone ?? null, email: data.email ?? null },
        { allowTraineeId: trainee.id },
      );
      await (supabaseAdmin as any)
        .from("trainees")
        .update({ full_name: data.fullName, age: data.age, phone: data.phone })
        .eq("id", trainee.id);
    }

    const { error } = await (supabaseAdmin as any).from("payment_submissions").insert({
      payer_id: trainee.id,
      payer_kind: "trainee",
      method: data.method ?? null,
      payer_name: data.fullName ?? trainee.full_name,
      payer_code: trainee.trainee_code,
      upline_id: trainee.upline_id,
      purpose: data.purpose,
      claimed_amount_pkr: data.claimedAmount,
      proof_path: data.proofPath,
      phone: data.phone ?? trainee.phone ?? null,
      email: data.email ?? null,
      age: data.age ?? trainee.age ?? null,
      note: data.note ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    if (trainee.upline_id) {
      const { pushToUsers } = await import("./push.server");
      await pushToUsers([trainee.upline_id], {
        title: "Payment proof received",
        body: `${trainee.full_name} uploaded a payment proof for verification.`,
        path: "/dashboard",
        tag: `payment-${trainee.id}`,
      });
    }
    {
      const { pushToAdmin } = await import("./push.server");
      await pushToAdmin({ title: "New payment proof", body: `${trainee.full_name} submitted a payment proof to verify.`, tag: "admin-payment", path: "/admin?tab=journey" });
    }
    return { ok: true as const };
  });

/** Real remaining seats — no invented scarcity. */
export const getMentorshipSeats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { loadPolicy } = await import("./journey.server");
  const policy = await loadPolicy();
  const { count } = await (supabaseAdmin as any)
    .from("payment_submissions")
    .select("id", { count: "exact", head: true })
    .eq("purpose", "mentorship")
    .in("status", ["pending", "verified"]);
  const taken = Number(count ?? 0);
  return { total: policy.mentorshipSeats, taken, available: Math.max(0, policy.mentorshipSeats - taken) };
});

/** ---------- Upline side ---------- */

/**
 * The trainee sent the session review on WhatsApp instead of the website.
 * The upline records it here and approves it in one step; the record shows
 * "Review shared on WhatsApp".
 */
export const approveWhatsappReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string; sessionNumber: number; score: number; note?: string | null }) =>
    z
      .object({
        traineeId: uuid,
        sessionNumber: z.number().int().min(1).max(7),
        score: z.number().int().min(0).max(15),
        note: z.string().trim().max(2000).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    await ownTrainee(member.id, data.traineeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadJourneySessions } = await import("./journey.server");
    const admin = supabaseAdmin as any;
    const now = new Date().toISOString();
    const { maxScoreForSession } = await import("./journey-scoring");
    const maximum = maxScoreForSession(data.sessionNumber);
    if (data.score > maximum) throw new Error(`Session ${data.sessionNumber} allows up to ${maximum} marks.`);

    const { basic } = await loadJourneySessions();
    const session = basic.find(
      (row: any, index: number) => Number(row.session_number ?? index + 1) === data.sessionNumber,
    ) as any;

    const { data: existing } = await admin
      .from("trainee_session_reviews")
      .select("id, status")
      .eq("trainee_id", data.traineeId)
      .eq("session_number", data.sessionNumber)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.status === "approved") throw new Error("This session is already approved.");

    const decision = {
      status: "approved",
      upline_note: data.note ?? "Review shared on WhatsApp",
      reviewed_at: now,
      reviewed_by: member.id,
      source: "whatsapp",
      score: data.score,
    };
    const { error } = existing
      ? await admin.from("trainee_session_reviews").update(decision).eq("id", existing.id)
      : await admin.from("trainee_session_reviews").insert({
          ...decision,
          trainee_id: data.traineeId,
          session_id: session?.id ?? null,
          session_number: data.sessionNumber,
          body: "Review shared on WhatsApp",
          submitted_at: now,
        });
    if (error) throw new Error(error.message);

    const journey = await buildJourney(data.traineeId);
    const { allSessionsApproved } = await import("./journey");
    if (allSessionsApproved(journey.sessions) && journey.stage === "sessions") {
      await admin
        .from("trainee_journey")
        .update({ stage: "interview_guide" })
        .eq("trainee_id", data.traineeId);
    }

    const { pushToUsers } = await import("./push.server");
    await pushToUsers([data.traineeId], {
      title: "Review approved",
      body: `Your WhatsApp review for Session ${String(data.sessionNumber).padStart(2, "0")} is approved. Your next session is ready.`,
      path: "/beginners",
      tag: `review-decision-${data.traineeId}`,
    });
    return { ok: true as const };
  });

async function ownTrainee(uplineId: string, traineeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("trainees")
    .select("id, full_name, trainee_code, phone, avatar_path, upline_id")
    .eq("id", traineeId)
    .maybeSingle();
  if (!data || data.upline_id !== uplineId) throw new Error("That person is not in your team.");
  return data;
}

/** Upline OR the senior assigned by admin may run this trainee's Final Interview. */
async function interviewTrainee(memberId: string, traineeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("trainees")
    .select("id, full_name, trainee_code, phone, avatar_path, upline_id")
    .eq("id", traineeId)
    .maybeSingle();
  if (!data) throw new Error("Trainee not found.");
  if (data.upline_id === memberId) return data;
  const { data: j } = await (supabaseAdmin as any)
    .from("trainee_journey")
    .select("interview_senior_id")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (j?.interview_senior_id !== memberId) throw new Error("This interview is not assigned to you.");
  return data;
}

export const getTraineeJourneyForUpline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string }) => z.object({ traineeId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const trainee = await ownTrainee(member.id, data.traineeId);
    const { signPath, AVATAR_BUCKET } = await import("./storage.server");
    const journey = await buildJourney(trainee.id);
    return {
      ...journey,
      profile: {
        id: trainee.id as string,
        code: trainee.trainee_code as string,
        fullName: trainee.full_name as string,
        phone: (trainee.phone ?? null) as string | null,
        avatarUrl: await signPath(AVATAR_BUCKET, trainee.avatar_path ?? null, 3600),
      },
    };
  });

/** The upline saves the real date/time for each of the 7 sessions. */
export const saveTraineeSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { traineeId: string; slots: { sessionNumber: number; dayNumber: number; scheduledAt: string }[] }) =>
      z
        .object({
          traineeId: uuid,
          slots: z
            .array(
              z.object({
                sessionNumber: z.number().int().min(1).max(7),
                dayNumber: z.number().int().min(1).max(30),
                scheduledAt: z.string().min(10).max(40),
              }),
            )
            .min(1)
            .max(7),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const trainee = await ownTrainee(member.id, data.traineeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadJourneySessions } = await import("./journey.server");
    const { basic } = await loadJourneySessions();

    const rows = data.slots.map((slot) => {
      const session = basic.find(
        (row: any, index: number) => Number(row.session_number ?? index + 1) === slot.sessionNumber,
      ) as any;
      return {
        trainee_id: trainee.id,
        session_id: session?.id ?? null,
        session_number: slot.sessionNumber,
        day_number: slot.dayNumber,
        scheduled_at: new Date(slot.scheduledAt).toISOString(),
        created_by: member.id,
      };
    });

    const { error } = await (supabaseAdmin as any)
      .from("trainee_session_schedule")
      .upsert(rows, { onConflict: "trainee_id,session_number" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const reviewSessionSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      reviewId: string;
      decision: "approved" | "rejected";
      score?: number | null;
      note?: string | null;
      voicePath?: string | null;
    }) =>
      z
        .object({
          reviewId: uuid,
          decision: z.enum(["approved", "rejected"]),
          score: z.number().int().min(0).max(15).nullish(),
          note: z.string().trim().max(2000).nullish(),
          voicePath: optionalPath,
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: review } = await admin
      .from("trainee_session_reviews")
      .select("id, trainee_id, session_number, status")
      .eq("id", data.reviewId)
      .maybeSingle();
    if (!review) throw new Error("That review no longer exists.");
    await ownTrainee(member.id, review.trainee_id);

    if (data.decision === "approved") {
      if (data.score == null) throw new Error("Add marks before approving this review.");
      const { maxScoreForSession } = await import("./journey-scoring");
      const maximum = maxScoreForSession(Number(review.session_number));
      if (data.score > maximum) throw new Error(`This session allows up to ${maximum} marks.`);
    }


    const scoreOnly = review.status === "approved" && data.decision === "approved";
    const update = scoreOnly
      ? { score: data.score }
      : {
          status: data.decision,
          score: data.decision === "approved" ? data.score : null,
          upline_note: data.note ?? null,
          upline_voice_path: data.voicePath ?? null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: member.id,
        };
    const { error } = await admin
      .from("trainee_session_reviews")
      .update(update)
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);

    // All 7 approved moves the trainee on to the Final Interview Guide.
    const journey = await buildJourney(review.trainee_id);
    const { allSessionsApproved } = await import("./journey");
    if (allSessionsApproved(journey.sessions) && journey.stage === "sessions") {
      await admin
        .from("trainee_journey")
        .update({ stage: "interview_guide" })
        .eq("trainee_id", review.trainee_id);
    }

    if (!scoreOnly) {
      const { pushToUsers } = await import("./push.server");
      await pushToUsers([review.trainee_id], {
        title: data.decision === "approved" ? "Review approved" : "Review needs changes",
        body:
          data.decision === "approved"
            ? "Your upline approved your session review. Your next session is ready."
            : "Your upline asked for changes. Open the session to read the note.",
        path: "/beginners",
        tag: `review-decision-${review.trainee_id}`,
      });
    }
    return { ok: true as const };
  });

export const recordInterviewResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string; result: "pass" | "reassess"; note?: string | null }) =>
    z
      .object({
        traineeId: uuid,
        result: z.enum(["pass", "reassess"]),
        note: z.string().trim().max(2000).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const trainee = await interviewTrainee(member.id, data.traineeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureJourney } = await import("./journey.server");
    const journey = await ensureJourney(trainee.id);
    // Stage guard: an interview result is only valid once the trainee is ready.
    const stage = (journey as any)?.stage ?? "sessions";
    if (stage !== "ready_for_interview" && stage !== "reassess") {
      throw new Error("This trainee is not ready for the final interview yet.");
    }
    const { error } = await (supabaseAdmin as any)
      .from("trainee_journey")
      .update({
        interview_result: data.result,
        interview_note: data.note ?? null,
        interview_reviewed_at: new Date().toISOString(),
        stage: data.result === "pass" ? "interview_passed" : "reassess",
      })
      .eq("trainee_id", trainee.id);
    if (error) throw new Error(error.message);
    const { pushToUsers } = await import("./push.server");
    await pushToUsers([trainee.id], {
      title: data.result === "pass" ? "Final interview passed" : "Final interview: reassess",
      body:
        data.result === "pass"
          ? "Congratulations! Session 08 and the Forever Business Plan are unlocked."
          : "Your upline asked you to revise before the next interview.",
      path: "/beginners",
      tag: `interview-${trainee.id}`,
    });
    return { ok: true as const };
  });

/** One queue with everything waiting on the upline right now. */
export const getUplineActionQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath, AVATAR_BUCKET } = await import("./storage.server");
    const { nextAction, allSessionsApproved } = await import("./journey");
    const admin = supabaseAdmin as any;

    const { data: trainees } = await admin
      .from("trainees")
      .select("id, full_name, trainee_code, phone, avatar_path, created_at")
      .eq("upline_id", member.id)
      .eq("status", "active")
      .limit(100);

    const items = [];
    for (const trainee of [...((trainees ?? []) as any[]), ...((assignedTrainees ?? []) as any[])]) {
      const journey = await buildJourney(trainee.id);
      const assignedOnly = assignedSet.has(trainee.id);
      const pendingReview = journey.sessions.find((session) => session.review === "pending");
      const action = nextAction({
        stage: journey.stage,
        sessions: journey.sessions,
        mentorshipRemaining: journey.wallet.remaining,
        mentorshipDueAt: journey.mentorshipDueAt,
        webinarWatched: Boolean(journey.webinarWatchedAt),
      });
      const approvedCount = journey.sessions.filter(
        (session) => session.sessionNumber <= 7 && session.review === "approved",
      ).length;
      items.push({
        currentDay:
          journey.stage === "sessions"
            ? (journey.sessions.find((s) => s.sessionNumber <= 7 && s.review !== "approved")?.dayNumber ?? 99)
            : 99,
        trainingDays: Math.max(4, ...journey.sessions.filter((s) => s.sessionNumber <= 7).map((s) => s.dayNumber)),
        joinedAt: (trainee.created_at ?? null) as string | null,
        traineeId: trainee.id as string,
        name: trainee.full_name as string,
        code: trainee.trainee_code as string,
        phone: (trainee.phone ?? null) as string | null,
        avatarUrl: await signPath(AVATAR_BUCKET, trainee.avatar_path ?? null, 3600),
        stage: journey.stage,
        scheduled: journey.sessions.some((session) => session.scheduledAt),
        pendingReviewSession: pendingReview?.sessionNumber ?? null,
        allApproved: allSessionsApproved(journey.sessions),
        interviewGuideWatched: Boolean(journey.interviewGuideWatchedAt),
        interviewResult: journey.interviewResult,
        action,
      });
    }
    return { items };
  });

/**
 * Plays a journey video. Basic sessions open only once their scheduled time has
 * arrived; the guide, business plan and webinar open when their stage is reached.
 */
export const playJourneyVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) => z.object({ sessionId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const trainee = await activeTrainee(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { signPath, VIDEO_BUCKET, THUMBNAIL_BUCKET } = await import("./storage.server");

    const { data: row } = await admin
      .from("beginner_sessions")
      .select(
        "id, title, description, video_source, video_path, video_url, thumbnail_path, aspect_ratio, session_kind, session_number, is_published",
      )
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!row || !row.is_published) return { status: "invalid" as const };

    const kind = (row.session_kind ?? "basic") as string;

    // A basic session opens at its scheduled time (PKT), not before. Once its
    // review is approved it stays open permanently. A missing or invalid
    // schedule remains locked instead of silently granting early access.
    if (kind === "basic") {
      const sessionNumber = Number(row.session_number ?? 0);
      if (sessionNumber > 0) {
        const [{ data: slot }, { data: approvedReview }] = await Promise.all([
          admin
            .from("trainee_session_schedule")
            .select("scheduled_at")
            .eq("trainee_id", trainee.id)
            .eq("session_number", sessionNumber)
            .maybeSingle(),
          admin
            .from("trainee_session_reviews")
            .select("id")
            .eq("trainee_id", trainee.id)
            .eq("session_number", sessionNumber)
            .eq("status", "approved")
            .maybeSingle(),
        ]);
        const opensAt = slot?.scheduled_at ? new Date(slot.scheduled_at).getTime() : Number.NaN;
        if (!approvedReview && (!Number.isFinite(opensAt) || Date.now() < opensAt)) {
          return {
            status: "locked" as const,
            opensAt: (slot?.scheduled_at ?? null) as string | null,
          };
        }
      }
    }




    // The Forever Business Plan opens only after the final interview is passed.
    const { loadJourneySessions: _lss } = await import("./journey.server");
    const _set: any = await _lss();
    if (kind === "business_plan" || _set?.businessPlan?.id === row.id) {
      const { ensureJourney } = await import("./journey.server");
      const journey: any = await ensureJourney(trainee.id);
      const stage = journey?.stage ?? "sessions";
      if (stage !== "interview_passed" && stage !== "mentorship") {
        return { status: "locked" as const };
      }
    }

    const videoUrl =
      row.video_source === "external" && row.video_url
        ? row.video_url
        : await signPath(VIDEO_BUCKET, row.video_path, 60 * 60 * 4);

    return {
      status: "ok" as const,
      session: {
        id: row.id as string,
        title: row.title as string,
        description: (row.description ?? null) as string | null,
        aspectRatio: (row.aspect_ratio ?? "16:9") as string,
        videoUrl: videoUrl as string | null,
        thumbnailUrl: await signPath(THUMBNAIL_BUCKET, row.thumbnail_path, 60 * 60 * 4),
      },
    };
  });

/** The upline's one master schedule that every new trainee starts with. */
export const getUplineSessionSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const member = await activeMember(context.userId);
    const { loadUplineSchedule, loadJourneySessions } = await import("./journey.server");
    const [slots, sessionSet] = await Promise.all([
      loadUplineSchedule(member.id),
      loadJourneySessions(),
    ]);
    const { signThumb } = await import("./journey.server");
    const titles = await Promise.all(
      (sessionSet.basic as any[]).slice(0, 7).map(async (row, index) => ({
        session: Number(row.session_number ?? index + 1),
        title: row.title as string,
        thumbnailUrl: await signThumb(row.thumbnail_path),
      })),
    );
    return {
      slots,
      sessions: titles,
      upline: { name: member.full_name as string, code: member.member_id as string },
    };
  });

export const saveUplineSessionSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slots: { session: number; day: number; time: string }[] }) =>
    z
      .object({
        slots: z
          .array(
            z.object({
              session: z.number().int().min(1).max(7),
              day: z.number().int().min(1).max(30),
              time: z.string().regex(/^\d{1,2}:\d{2}$/),
            }),
          )
          .min(1)
          .max(7),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { saveUplineSchedule, syncTraineesToSchedule } = await import("./journey.server");
    const slots = await saveUplineSchedule(member.id, data.slots);
    await syncTraineesToSchedule(member.id);
    return { ok: true as const, slots };
  });

/** ---------- Upline requests panel ---------- */

/**
 * Every session review waiting for this upline's decision, newest first, with
 * the trainee's words, picture and voice note ready to open, plus the trainees
 * whose final interview result is due.
 */
export const getUplineReviewRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath, AVATAR_BUCKET } = await import("./storage.server");
    const admin = supabaseAdmin as any;

    const { data: trainees } = await admin
      .from("trainees")
      .select("id, full_name, trainee_code, phone, avatar_path")
      .eq("upline_id", member.id)
      .eq("status", "active")
      .limit(100);
    const { data: assignedRows } = await admin
      .from("trainee_journey")
      .select("trainee_id")
      .eq("interview_senior_id", member.id)
      .limit(100);
    const ownIds = new Set(((trainees ?? []) as any[]).map((t) => t.id));
    const assignedIds = ((assignedRows ?? []) as any[]).map((r) => r.trainee_id).filter((id) => !ownIds.has(id));
    const { data: assignedTrainees } = assignedIds.length
      ? await admin.from("trainees").select("id, full_name, trainee_code, phone, avatar_path").in("id", assignedIds).eq("status", "active")
      : { data: [] };
    const assignedSet = new Set(assignedIds);

    const reviews: any[] = [];
    const interviews: any[] = [];
    for (const trainee of [...((trainees ?? []) as any[]), ...((assignedTrainees ?? []) as any[])]) {
      const journey = await buildJourney(trainee.id);
      const assignedOnly = assignedSet.has(trainee.id);
      const avatarUrl = await signPath(AVATAR_BUCKET, trainee.avatar_path ?? null, 3600);
      const person = {
        traineeId: trainee.id as string,
        name: trainee.full_name as string,
        code: trainee.trainee_code as string,
        avatarUrl,
      };
      const pending = journey.sessions.find((session) => session.review === "pending");
      if (pending && !assignedOnly) {
        reviews.push({
          ...person,
          reviewId: pending.reviewId,
          sessionNumber: pending.sessionNumber,
          title: pending.title,
          scheduledAt: pending.scheduledAt,
          openedAt: pending.openedAt ?? null,
          submittedAt: pending.reviewSubmittedAt ?? null,
          body: pending.reviewBody,
          imageUrl: pending.reviewImageUrl,
          imageUrls: pending.reviewImageUrls ?? [],
          voiceUrl: pending.reviewVoiceUrl,
        });
      }
      if (journey.stage === "ready_for_interview" || journey.stage === "reassess") {
        interviews.push({
          ...person,
          stage: journey.stage,
          note: journey.interviewNote,
          requestedAt: journey.interviewRequestedAt ?? null,
          availabilityNote: journey.interviewAvailabilityNote ?? null,
          scheduledAt: journey.interviewScheduledAt ?? null,
          assignedSenior: assignedOnly,
        });
      }
    }
    reviews.sort((a, b) => String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? "")));
    return { reviews, interviews };
  });

/** ---------- Shared progress report link ---------- */

function reportToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

export const getTraineeReportLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string }) => z.object({ traineeId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    await ownTrainee(member.id, data.traineeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await (supabaseAdmin as any)
      .from("trainee_report_links")
      .select("id, token, revoked, created_at")
      .eq("trainee_id", data.traineeId)
      .eq("created_by", member.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return {
      links: ((rows ?? []) as any[]).map((row) => ({
        id: row.id as string,
        token: row.token as string,
        revoked: row.revoked === true,
        createdAt: row.created_at as string,
      })),
    };
  });

export const createTraineeReportLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string }) => z.object({ traineeId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    await ownTrainee(member.id, data.traineeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = reportToken();
    const { error } = await (supabaseAdmin as any).from("trainee_report_links").insert({
      token,
      trainee_id: data.traineeId,
      created_by: member.id,
    });
    if (error) throw new Error(error.message);
    return { token };
  });

export const setTraineeReportLinkRevoked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { linkId: string; revoked: boolean }) =>
    z.object({ linkId: uuid, revoked: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("trainee_report_links")
      .update({ revoked: data.revoked })
      .eq("id", data.linkId)
      .eq("created_by", member.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Read-only progress record behind a private link. Business information only:
 * training timings, reviews and decisions — no phone numbers or private data.
 */
export const getSharedTraineeReport = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) =>
    z.object({ token: z.string().trim().min(10).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: link } = await admin
      .from("trainee_report_links")
      .select("trainee_id, revoked, created_at, created_by")
      .eq("token", data.token)
      .maybeSingle();
    if (!link || link.revoked === true) return { status: "invalid" as const };

    const { data: trainee } = await admin
      .from("trainees")
      .select("id, full_name, trainee_code, status, created_at, upline_id")
      .eq("id", link.trainee_id)
      .maybeSingle();
    if (!trainee) return { status: "invalid" as const };

    const { data: upline } = await admin
      .from("member_profiles")
      .select("full_name, member_id")
      .eq("id", trainee.upline_id)
      .maybeSingle();

    const journey = await buildJourney(trainee.id);
    const { sessionWindowEndMs } = await import("./journey");
    const { data: jrow } = await admin
      .from("trainee_journey")
      .select(
        "interview_marks, interview_max_marks, interview_taken_by, interview_reviewed_at, interview_scheduled_at, interview_requested_at, interview_attempts",
      )
      .eq("trainee_id", trainee.id)
      .maybeSingle();

    return {
      status: "ok" as const,
      generatedAt: link.created_at as string,
      trainee: {
        name: trainee.full_name as string,
        code: trainee.trainee_code as string,
        joinedAt: trainee.created_at as string,
        status: trainee.status as string,
      },
      upline: upline
        ? { name: upline.full_name as string, code: upline.member_id as string }
        : null,
      stage: journey.stage,
      interviewResult: journey.interviewResult,
      interviewNote: journey.interviewNote,
      interview: {
        marks: (jrow?.interview_marks ?? null) as number | null,
        maxMarks: Number(jrow?.interview_max_marks ?? 25),
        takenBy: (jrow?.interview_taken_by ?? null) as string | null,
        decidedAt: (jrow?.interview_reviewed_at ?? null) as string | null,
        scheduledAt: (jrow?.interview_scheduled_at ?? null) as string | null,
        requestedAt: (jrow?.interview_requested_at ?? null) as string | null,
        attempts: Number(jrow?.interview_attempts ?? 0),
        canEvaluate: journey.stage === "ready_for_interview" || journey.stage === "reassess",
      },
      wallet: {
        required: journey.wallet.required,
        verified: journey.wallet.verified,
        remaining: journey.wallet.remaining,
        ccTarget: journey.wallet.ccTarget,
        ccVerified: journey.wallet.ccVerified,
      },
      sessions: journey.sessions.map((session) => {
        const submitted = session.reviewSubmittedAt ?? null;
        const late =
          session.scheduledAt && submitted
            ? new Date(submitted).getTime() > sessionWindowEndMs(session.scheduledAt)
            : false;
        const joinLate =
          session.scheduledAt && session.openedAt
            ? Math.max(
                0,
                Math.round(
                  (new Date(session.openedAt).getTime() -
                    new Date(session.scheduledAt).getTime()) /
                    60000,
                ),
              )
            : null;
        return {
          sessionNumber: session.sessionNumber,
          title: session.title,
          scheduledAt: session.scheduledAt,
          openedAt: session.openedAt ?? null,
          joinLateMinutes: joinLate,
          submittedAt: submitted,
          late,
          review: session.review,
          reviewBody: session.reviewBody,
          reviewImageUrls: session.reviewImageUrls ?? [],
          reviewVoiceUrl: session.reviewVoiceUrl,
          uplineVoiceUrl: session.uplineVoiceUrl,
          score: session.score ?? null,
          reviewedAt: session.reviewedAt,
          uplineNote: session.uplineNote,
          reviewSource: session.reviewSource ?? null,
        };
      }),
    };
  });

/** Upline grants Session 08 (Forever Business Plan) once all seven sessions are approved. */
export const grantForeverAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string }) => z.object({ traineeId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const trainee = await ownTrainee(member.id, data.traineeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureJourney } = await import("./journey.server");
    const journey = await ensureJourney(trainee.id);
    const stage = (journey as any)?.stage ?? "sessions";
    if (stage === "interview_passed" || stage === "mentorship") return { ok: true as const };
    const { data: rows } = await (supabaseAdmin as any)
      .from("trainee_session_reviews")
      .select("session_number")
      .eq("trainee_id", trainee.id)
      .eq("status", "approved")
      .lte("session_number", 7);
    const approved = new Set(((rows ?? []) as any[]).map((r) => Number(r.session_number)));
    if (approved.size < 7) throw new Error("Pehle saare 7 sessions ke reviews approve karein.");
    const now = new Date().toISOString();
    const { error } = await (supabaseAdmin as any)
      .from("trainee_journey")
      .update({
        interview_result: "pass",
        interview_reviewed_at: now,
        interview_guide_watched_at: (journey as any)?.interview_guide_watched_at ?? now,
        stage: "interview_passed",
      })
      .eq("trainee_id", trainee.id);
    if (error) throw new Error(error.message);
    const { pushToUsers } = await import("./push.server");
    await pushToUsers([trainee.id], {
      title: "Congratulations! 🎉",
      body: "Aap ne training complete kar li aur Final Interview pass kar liya. Session 08 ab open hai.",
      path: "/beginners",
      tag: `interview-${trainee.id}`,
    });
    return { ok: true as const };
  });

/**
 * The senior conducting the Final Interview submits the result from the private
 * report link: pass or fail, marks and remarks, stamped with the senior's name.
 * A pass unlocks Session 08 straight away; a fail sends the trainee back to
 * "try again" and lets the upline schedule a fresh interview time.
 */
export const submitSharedInterviewResult = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      token: string;
      seniorName: string;
      result: "pass" | "fail";
      marks: number;
      note?: string | null;
    }) =>
      z
        .object({
          token: z.string().trim().min(10).max(64),
          seniorName: z.string().trim().min(3).max(120),
          result: z.enum(["pass", "fail"]),
          marks: z.number().int().min(0).max(100),
          note: z.string().trim().max(2000).nullish(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: link } = await admin
      .from("trainee_report_links")
      .select("trainee_id, revoked")
      .eq("token", data.token)
      .maybeSingle();
    if (!link || link.revoked === true) throw new Error("This report link is closed.");

    const { ensureJourney } = await import("./journey.server");
    const journey: any = await ensureJourney(link.trainee_id);
    const stage = journey?.stage ?? "sessions";
    if (stage !== "ready_for_interview" && stage !== "reassess") {
      throw new Error("This person is not at the Final Interview step right now.");
    }
    const maximum = Number(journey?.interview_max_marks ?? 25);
    if (data.marks > maximum) throw new Error(`Interview marks can be at most ${maximum}.`);

    const now = new Date().toISOString();
    const passed = data.result === "pass";
    const { error } = await admin
      .from("trainee_journey")
      .update({
        interview_result: passed ? "pass" : "fail",
        interview_marks: data.marks,
        interview_taken_by: data.seniorName,
        interview_note: data.note ?? null,
        interview_reviewed_at: now,
        interview_attempts: Number(journey?.interview_attempts ?? 0) + 1,
        interview_guide_watched_at: journey?.interview_guide_watched_at ?? now,
        stage: passed ? "interview_passed" : "reassess",
        // A fail clears the old request/time so the upline can set a new one.
        interview_requested_at: passed ? journey?.interview_requested_at ?? now : null,
        interview_scheduled_at: null,
      })
      .eq("trainee_id", link.trainee_id);
    if (error) throw new Error(error.message);

    try {
      const { pushToUsers } = await import("./push.server");
      await pushToUsers([link.trainee_id], {
        title: passed ? "Congratulations! 🎉 Final Interview pass" : "Final Interview: try again",
        body: passed
          ? `Aap ne Final Interview pass kar liya (${data.marks}/${maximum}). Session 08 — Forever Business Plan ab open hai!`
          : "Is bar interview clear nahi hua. Apne upline se rabta karein, tayari karein — naya interview time set kiya jayega.",
        path: "/beginners",
        tag: `interview-${link.trainee_id}`,
      });
    } catch {
      // push is best-effort
    }

    // The upline also needs to know, so they can unlock or reschedule.
    try {
      const { data: trainee } = await admin
        .from("trainees")
        .select("full_name, upline_id")
        .eq("id", link.trainee_id)
        .maybeSingle();
      if (trainee?.upline_id) {
        const { pushToUsers } = await import("./push.server");
        await pushToUsers([trainee.upline_id], {
          title: passed ? "Final Interview passed ✅" : "Final Interview failed ❌",
          body: `${trainee.full_name}: ${data.marks}/${maximum} — ${data.seniorName} ne interview liya.${passed ? " Session 08 unlock ho gaya." : " Naya interview time set karein."}`,
          path: "/seats",
          tag: `interview-result-${link.trainee_id}`,
        });
      }
    } catch {
      // push is best-effort
    }

    return { ok: true as const, result: passed ? ("pass" as const) : ("fail" as const) };
  });
