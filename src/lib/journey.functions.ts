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
      "id, trainee_code, full_name, phone, age, status, avatar_path, upline_id, member_profiles:upline_id (id, member_id, full_name, phone, avatar_path)",
    )
    .eq("id", userId)
    .maybeSingle();
  if (!data || (data as any).status !== "active") throw new Error("Your account is not active.");
  return data as any;
}

/** Builds the full journey view for one trainee id (used by trainee + upline + admin). */
async function buildJourney(traineeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const {
    ensureJourney,
    loadJourneySessions,
    loadLedger,
    loadPolicy,
    signProof,
    signThumb,
  } = await import("./journey.server");
  const admin = supabaseAdmin as any;

  const [journeyRow, sessionSet, policy, ledger] = await Promise.all([
    ensureJourney(traineeId),
    loadJourneySessions(),
    loadPolicy(),
    loadLedger(traineeId),
  ]);

  const [{ data: schedule }, { data: reviews }] = await Promise.all([
    admin
      .from("trainee_session_schedule")
      .select("session_number, day_number, scheduled_at, session_id")
      .eq("trainee_id", traineeId),
    admin
      .from("trainee_session_reviews")
      .select(
        "id, session_number, body, image_path, voice_path, status, upline_note, upline_voice_path, reviewed_at, created_at",
      )
      .eq("trainee_id", traineeId)
      .order("created_at", { ascending: false }),
  ]);

  const scheduleBy = new Map<number, any>(
    ((schedule ?? []) as any[]).map((row) => [Number(row.session_number), row]),
  );
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
      uplineNote: (review?.upline_note ?? null) as string | null,
      uplineVoiceUrl: await signProof(review?.upline_voice_path),
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
    return {
      ...journey,
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
      voicePath?: string | null;
    }) =>
      z
        .object({
          sessionNumber: z.number().int().min(1).max(7),
          body: z.string().trim().min(10, "Write a short review of the session").max(4000),
          imagePath: optionalPath,
          voicePath: optionalPath,
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

    // The scheduled time must have arrived before a review can be sent.
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

    const { error } = await admin.from("trainee_session_reviews").insert({
      trainee_id: trainee.id,
      session_id: (session as any).id,
      session_number: data.sessionNumber,
      body: data.body,
      image_path: data.imagePath ?? null,
      voice_path: data.voicePath ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const markInterviewGuideWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const trainee = await activeTrainee(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureJourney } = await import("./journey.server");
    await ensureJourney(trainee.id);
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("payment_submissions").insert({
      payer_id: trainee.id,
      payer_kind: "trainee",
      payer_name: trainee.full_name,
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
      note?: string | null;
      voicePath?: string | null;
    }) =>
      z
        .object({
          reviewId: uuid,
          decision: z.enum(["approved", "rejected"]),
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
      .select("id, trainee_id")
      .eq("id", data.reviewId)
      .maybeSingle();
    if (!review) throw new Error("That review no longer exists.");
    await ownTrainee(member.id, review.trainee_id);

    if (data.decision === "rejected" && !data.note && !data.voicePath) {
      throw new Error("Add a written note or a voice note so the trainee knows what to improve.");
    }

    const { error } = await admin
      .from("trainee_session_reviews")
      .update({
        status: data.decision,
        upline_note: data.note ?? null,
        upline_voice_path: data.voicePath ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: member.id,
      })
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
    const trainee = await ownTrainee(member.id, data.traineeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureJourney } = await import("./journey.server");
    await ensureJourney(trainee.id);
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
      .select("id, full_name, trainee_code, phone, avatar_path")
      .eq("upline_id", member.id)
      .eq("status", "active")
      .limit(100);

    const items = [];
    for (const trainee of (trainees ?? []) as any[]) {
      const journey = await buildJourney(trainee.id);
      const pendingReview = journey.sessions.find((session) => session.review === "pending");
      const action = nextAction({
        stage: journey.stage,
        sessions: journey.sessions,
        mentorshipRemaining: journey.wallet.remaining,
        mentorshipDueAt: journey.mentorshipDueAt,
        webinarWatched: Boolean(journey.webinarWatchedAt),
      });
      items.push({
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

    if ((row.session_kind ?? "basic") === "basic") {
      const { data: slot } = await admin
        .from("trainee_session_schedule")
        .select("scheduled_at")
        .eq("trainee_id", trainee.id)
        .eq("session_number", row.session_number)
        .maybeSingle();
      if (!slot?.scheduled_at || new Date(slot.scheduled_at).getTime() > Date.now()) {
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
