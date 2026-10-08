import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Final Test rules (fixed by owner request). */
export const EXAM_PASS_PERCENT = 70;
export const EXAM_MAX_ATTEMPTS = 3;
export const EXAM_COOLDOWN_DAYS = 4;
/** After the scheduled time the trainee has this long to start, otherwise the attempt is missed. */
const START_WINDOW_MS = 2 * 60 * 60 * 1000;

const uuid = z.string().uuid();
const OPEN = ["requested", "scheduled", "in_progress", "submitted"];

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function push(ids: string[], title: string, body: string, path: string, tag: string) {
  try {
    const { pushToUsers } = await import("./push.server");
    await pushToUsers(ids, { title, body, path, tag });
  } catch {
    /* notifications are best-effort */
  }
}

async function loadQuestions(withAnswers: boolean) {
  const admin = await db();
  const { data } = await admin
    .from("final_test_questions")
    .select("*")
    .eq("is_published", true)
    .order("sort_order")
    .order("created_at");
  return ((data ?? []) as any[]).map((q) => ({
    id: q.id as string,
    type: q.question_type as "mcq" | "mindset" | "notes",
    en: q.question_en as string,
    ur: (q.question_ur ?? "") as string,
    voiceUrl: (q.voice_url ?? null) as string | null,
    optionsEn: (q.options_en ?? []) as string[],
    optionsUr: (q.options_ur ?? []) as string[],
    marks: Number(q.marks ?? 1),
    seconds: Number(q.time_limit_seconds ?? 60),
    ...(withAnswers
      ? { correct: q.correct_option as number | null, reference: (q.reference_answer ?? "") as string }
      : {}),
  }));
}

function attemptDto(a: any) {
  if (!a) return null;
  return {
    id: a.id as string,
    attemptNo: a.attempt_no as number,
    occupation: a.occupation as string,
    occupationDetail: (a.occupation_detail ?? "") as string,
    slotOne: a.slot_one as string,
    slotTwo: a.slot_two as string,
    scheduledAt: (a.scheduled_at ?? null) as string | null,
    status: a.status as string,
    mcqScore: a.mcq_score as number,
    mcqMax: a.mcq_max as number,
    percent: a.percent == null ? null : Number(a.percent),
    result: (a.result ?? null) as string | null,
    gradedAt: (a.graded_at ?? null) as string | null,
    submittedAt: (a.submitted_at ?? null) as string | null,
  };
}

async function traineeCtx(userId: string) {
  const admin = await db();
  const { data: t } = await admin
    .from("trainees")
    .select("id, full_name, trainee_code, status, upline_id, member_profiles:upline_id (full_name, member_id)")
    .eq("id", userId)
    .maybeSingle();
  if (!t || t.status !== "active") throw new Error("Your account is not active.");
  const { data: j } = await admin.from("trainee_journey").select("stage").eq("trainee_id", t.id).maybeSingle();
  const { data: attempts } = await admin
    .from("final_exam_attempts")
    .select("*")
    .eq("trainee_id", t.id)
    .order("attempt_no", { ascending: false });
  let list = (attempts ?? []) as any[];
  // Auto-mark a scheduled test as missed when the start window has passed.
  const latest = list[0];
  if (
    latest &&
    latest.status === "scheduled" &&
    latest.scheduled_at &&
    Date.now() > new Date(latest.scheduled_at).getTime() + START_WINDOW_MS
  ) {
    await admin
      .from("final_exam_attempts")
      .update({ status: "missed", result: "fail", graded_at: new Date().toISOString() })
      .eq("id", latest.id);
    latest.status = "missed";
    latest.result = "fail";
    latest.graded_at = new Date().toISOString();
    list = [latest, ...list.slice(1)];
  }
  return { admin, t, stage: (j?.stage ?? "sessions") as string, attempts: list };
}

function cooldownUntil(attempts: any[]): string | null {
  const last = attempts[0];
  if (!last || last.result !== "fail" || !last.graded_at) return null;
  const until = new Date(last.graded_at).getTime() + EXAM_COOLDOWN_DAYS * 86400000;
  return until > Date.now() ? new Date(until).toISOString() : null;
}

/** Trainee: current Final Test state (+ questions once the test is live). */
export const getMyFinalExam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { t, stage, attempts } = await traineeCtx(context.userId);
    const latest = attempts[0] ?? null;
    const live = latest?.status === "in_progress";
    return {
      stage,
      traineeName: t.full_name as string,
      traineeCode: t.trainee_code as string,
      uplineName: ((t as any).member_profiles?.full_name ?? "Your upline") as string,
      attemptsUsed: attempts.length,
      maxAttempts: EXAM_MAX_ATTEMPTS,
      passPercent: EXAM_PASS_PERCENT,
      cooldownUntil: cooldownUntil(attempts),
      latest: attemptDto(latest),
      questions: live ? await loadQuestions(false) : [],
    };
  });

export const requestFinalExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { occupation: string; detail: string; slotOne: string; slotTwo: string }) =>
    z
      .object({
        occupation: z.enum(["housewife", "student", "job_holder", "other"]),
        detail: z.string().trim().min(2).max(200),
        slotOne: z.string().min(10).max(40),
        slotTwo: z.string().min(10).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, t, stage, attempts } = await traineeCtx(context.userId);
    if (!["interview_guide", "ready_for_interview", "reassess"].includes(stage))
      throw new Error("Final Test abhi available nahi hai.");
    if (attempts[0] && OPEN.includes(attempts[0].status)) throw new Error("Aap ki request pehle se chal rahi hai.");
    if (attempts.length >= EXAM_MAX_ATTEMPTS) throw new Error("Aap ke teeno attempts khatam ho chuke hain.");
    if (cooldownUntil(attempts)) throw new Error("4 din ka waiting time abhi khatam nahi hua.");
    const a = new Date(data.slotOne);
    const b = new Date(data.slotTwo);
    if ([a, b].some((d) => Number.isNaN(d.getTime()) || d.getTime() < Date.now()))
      throw new Error("Dono timings future ki honi chahiye.");
    const { error } = await admin.from("final_exam_attempts").insert({
      trainee_id: t.id,
      attempt_no: attempts.length + 1,
      occupation: data.occupation,
      occupation_detail: data.detail,
      slot_one: a.toISOString(),
      slot_two: b.toISOString(),
    });
    if (error) throw new Error(error.message);
    if (stage === "interview_guide")
      await admin.from("trainee_journey").update({ stage: "ready_for_interview" }).eq("trainee_id", t.id);
    if (t.upline_id)
      await push([t.upline_id], "Final Test request 🎓", `${t.full_name} Final Test ke liye ready hai. Ek time accept karein.`, "/dashboard", `exam-req-${t.id}`);
    return { ok: true as const };
  });

export const startFinalExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, attempts } = await traineeCtx(context.userId);
    const a = attempts[0];
    if (!a || a.status !== "scheduled" || !a.scheduled_at) throw new Error("Test abhi schedule nahi hua.");
    if (Date.now() < new Date(a.scheduled_at).getTime()) throw new Error("Test ka time abhi nahi hua.");
    await admin
      .from("final_exam_attempts")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", a.id);
    return { ok: true as const };
  });

export const submitFinalExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { answers: Record<string, { option?: number | null; text?: string | null }> }) =>
    z
      .object({
        answers: z.record(
          z.string().uuid(),
          z.object({ option: z.number().int().min(0).max(9).nullish(), text: z.string().max(20000).nullish() }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, t, attempts } = await traineeCtx(context.userId);
    const a = attempts[0];
    if (!a || a.status !== "in_progress") throw new Error("Koi live test nahi mila.");
    const qs = await loadQuestions(true);
    let mcqScore = 0;
    let mcqMax = 0;
    let writtenMax = 0;
    for (const q of qs) {
      if (q.type === "mcq") {
        mcqMax += q.marks;
        if (data.answers[q.id]?.option != null && data.answers[q.id]?.option === (q as any).correct) mcqScore += q.marks;
      } else writtenMax += q.marks;
    }
    await admin
      .from("final_exam_attempts")
      .update({
        status: "submitted",
        answers: data.answers,
        mcq_score: mcqScore,
        mcq_max: mcqMax,
        written_max: writtenMax,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", a.id);
    if (t.upline_id)
      await push([t.upline_id], "Final Test submitted 📝", `${t.full_name} ne Final Test submit kar diya. Marks lagayein.`, "/dashboard", `exam-sub-${t.id}`);
    return { ok: true as const };
  });

/* ----------------------------- upline ----------------------------- */

async function activeMemberId(userId: string) {
  const admin = await db();
  const { data } = await admin.from("member_profiles").select("id, status").eq("id", userId).maybeSingle();
  if (!data || data.status !== "active") throw new Error("Your membership is not active.");
  return { admin, memberId: data.id as string };
}

async function teamTraineeIds(admin: any, memberId: string) {
  const { data: own } = await admin.from("trainees").select("id").eq("upline_id", memberId);
  const { data: senior } = await admin.from("trainee_journey").select("trainee_id").eq("interview_senior_id", memberId);
  return [...new Set([...(own ?? []).map((r: any) => r.id), ...(senior ?? []).map((r: any) => r.trainee_id)])] as string[];
}

export const getUplineFinalExams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, memberId } = await activeMemberId(context.userId);
    const ids = await teamTraineeIds(admin, memberId);
    if (!ids.length) return { items: [] as any[], questions: [] as any[] };
    const { data: rows } = await admin
      .from("final_exam_attempts")
      .select("*")
      .in("trainee_id", ids)
      .in("status", ["requested", "scheduled", "in_progress", "submitted"])
      .order("created_at", { ascending: false });
    const list = (rows ?? []) as any[];
    const { data: ts } = list.length
      ? await admin.from("trainees").select("id, full_name, trainee_code").in("id", list.map((r) => r.trainee_id))
      : { data: [] };
    const tMap = new Map(((ts ?? []) as any[]).map((t) => [t.id, t]));
    const needQuestions = list.some((r) => r.status === "submitted");
    return {
      items: list.map((r) => ({
        ...attemptDto(r)!,
        traineeName: (tMap.get(r.trainee_id)?.full_name ?? "Trainee") as string,
        traineeCode: (tMap.get(r.trainee_id)?.trainee_code ?? "") as string,
        answers: r.status === "submitted" ? (r.answers as Record<string, { option?: number; text?: string }>) : {},
      })),
      questions: needQuestions ? await loadQuestions(true) : [],
    };
  });

async function ownedAttempt(userId: string, attemptId: string) {
  const { admin, memberId } = await activeMemberId(userId);
  const { data: a } = await admin.from("final_exam_attempts").select("*").eq("id", attemptId).maybeSingle();
  if (!a) throw new Error("Test not found.");
  const ids = await teamTraineeIds(admin, memberId);
  if (!ids.includes(a.trainee_id)) throw new Error("This trainee is not in your team.");
  return { admin, a };
}

export const acceptFinalExamSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { attemptId: string; slot: 1 | 2 }) =>
    z.object({ attemptId: uuid, slot: z.union([z.literal(1), z.literal(2)]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, a } = await ownedAttempt(context.userId, data.attemptId);
    if (a.status !== "requested" && a.status !== "scheduled") throw new Error("Time ab change nahi ho sakta.");
    const when = data.slot === 1 ? a.slot_one : a.slot_two;
    await admin.from("final_exam_attempts").update({ status: "scheduled", scheduled_at: when }).eq("id", a.id);
    await admin.from("trainee_journey").update({ interview_scheduled_at: when }).eq("trainee_id", a.trainee_id);
    const label = new Date(when).toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" });
    await push([a.trainee_id], "Final Test scheduled ⏰", `Aap ka Final Test ${label} (PKT) par hai. Time par ready rahen!`, "/beginners", `exam-time-${a.trainee_id}`);
    return { ok: true as const };
  });

export const gradeFinalExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { attemptId: string; marks: Record<string, number> }) =>
    z.object({ attemptId: uuid, marks: z.record(z.string().uuid(), z.number().min(0).max(1000)) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, a } = await ownedAttempt(context.userId, data.attemptId);
    if (a.status !== "submitted") throw new Error("Ye test abhi submit nahi hua.");
    const qs = await loadQuestions(true);
    let written = 0;
    for (const q of qs) if (q.type !== "mcq") written += Math.min(q.marks, Number(data.marks[q.id] ?? 0));
    const total = a.mcq_max + a.written_max;
    const got = a.mcq_score + written;
    const percent = total > 0 ? Math.round((got / total) * 1000) / 10 : 0;
    const pass = percent >= EXAM_PASS_PERCENT;
    const now = new Date().toISOString();
    await admin
      .from("final_exam_attempts")
      .update({ status: "graded", written_marks: data.marks, percent, result: pass ? "pass" : "fail", graded_at: now })
      .eq("id", a.id);
    await admin
      .from("trainee_journey")
      .update({
        interview_result: pass ? "pass" : "reassess",
        interview_marks: got,
        interview_max_marks: total,
        interview_reviewed_at: now,
        interview_attempts: a.attempt_no,
        stage: pass ? "interview_passed" : "reassess",
      })
      .eq("trainee_id", a.trainee_id);
    await push(
      [a.trainee_id],
      pass ? "Congratulations! Final Test passed 🎉" : "Final Test result",
      pass
        ? `Aap ne ${percent}% marks ke sath Final Test pass kar liya! Forever Business Plan unlock ho gaya.`
        : `Aap ke ${percent}% marks aaye. ${EXAM_COOLDOWN_DAYS} din baad dobara try karein.`,
      "/beginners",
      `exam-result-${a.trainee_id}`,
    );
    return { ok: true as const, percent, pass };
  });

/* ----------------------------- admin ----------------------------- */

async function adminDb() {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  return db();
}

export const adminListExamQuestions = createServerFn({ method: "GET" }).handler(async () => {
  await adminDb();
  const admin = await db();
  const { data } = await admin.from("final_test_questions").select("*").order("sort_order").order("created_at");
  return ((data ?? []) as any[]).map((q) => ({
    id: q.id as string,
    type: q.question_type as string,
    en: q.question_en as string,
    ur: (q.question_ur ?? "") as string,
    voiceUrl: (q.voice_url ?? "") as string,
    optionsEn: (q.options_en ?? []) as string[],
    optionsUr: (q.options_ur ?? []) as string[],
    correct: (q.correct_option ?? null) as number | null,
    reference: (q.reference_answer ?? "") as string,
    marks: Number(q.marks ?? 1),
    seconds: Number(q.time_limit_seconds ?? 60),
    sortOrder: Number(q.sort_order ?? 0),
    published: Boolean(q.is_published),
  }));
});

export const adminSaveExamQuestion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: uuid.nullish(),
        type: z.enum(["mcq", "mindset", "notes"]),
        en: z.string().trim().min(2).max(4000),
        ur: z.string().trim().max(4000).default(""),
        voiceUrl: z.string().trim().max(1000).default(""),
        optionsEn: z.array(z.string().trim().max(500)).max(6).default([]),
        optionsUr: z.array(z.string().trim().max(500)).max(6).default([]),
        correct: z.number().int().min(0).max(5).nullish(),
        reference: z.string().trim().max(8000).default(""),
        marks: z.number().int().min(1).max(100),
        seconds: z.number().int().min(15).max(3600),
        sortOrder: z.number().int().min(0).max(9999).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await adminDb();
    const row = {
      question_type: data.type,
      question_en: data.en,
      question_ur: data.ur || null,
      voice_url: data.voiceUrl || null,
      options_en: data.type === "mcq" ? data.optionsEn : [],
      options_ur: data.type === "mcq" ? data.optionsUr : [],
      correct_option: data.type === "mcq" ? (data.correct ?? 0) : null,
      reference_answer: data.reference || null,
      marks: data.marks,
      time_limit_seconds: data.seconds,
      sort_order: data.sortOrder,
      is_published: true,
    };
    const res = data.id
      ? await admin.from("final_test_questions").update(row).eq("id", data.id)
      : await admin.from("final_test_questions").insert(row);
    if (res.error) throw new Error(res.error.message);
    return { ok: true as const };
  });

export const adminDeleteExamQuestion = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data }) => {
    const admin = await adminDb();
    await admin.from("final_test_questions").delete().eq("id", data.id);
    return { ok: true as const };
  });
