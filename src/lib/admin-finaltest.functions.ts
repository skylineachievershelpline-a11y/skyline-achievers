import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Admin-only management of the Final Test module. */

const uuid = z.string().uuid();

async function admin() {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const adminGetFinalTestRules = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db
    .from("final_test_rules")
    .select("rules_en, rules_ur, voice_path, voice_url, show_result_to_candidate")
    .eq("id", "default")
    .maybeSingle();
  return { rules: data ?? null };
});

export const adminSaveFinalTestRules = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      rulesEn: string | null;
      rulesUr: string | null;
      voicePath?: string | null;
      voiceUrl?: string | null;
      showResult: boolean;
    }) =>
      z
        .object({
          rulesEn: z.string().trim().max(8000).nullable(),
          rulesUr: z.string().trim().max(8000).nullable(),
          voicePath: z.string().trim().max(400).nullable().optional(),
          voiceUrl: z.string().trim().max(600).nullable().optional(),
          showResult: z.boolean(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const patch: Record<string, unknown> = {
      rules_en: data.rulesEn,
      rules_ur: data.rulesUr,
      show_result_to_candidate: data.showResult,
      updated_at: new Date().toISOString(),
    };
    if (data.voicePath) patch["voice_path"] = data.voicePath;
    if (data.voiceUrl !== undefined) patch["voice_url"] = data.voiceUrl || null;
    const { error } = await db.from("final_test_rules").update(patch).eq("id", "default");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminGetFinalTestQuestions = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db.from("final_test_questions").select("*").order("sort_order");
  return { questions: data ?? [] };
});

export const adminSaveFinalTestQuestion = createServerFn({ method: "POST" })
  .inputValidator((data: any) =>
    z
      .object({
        id: uuid.optional(),
        sortOrder: z.number().int().min(0).max(999),
        questionEn: z.string().trim().min(1).max(4000),
        questionUr: z.string().trim().max(4000).nullable(),
        voicePath: z.string().trim().max(400).nullable().optional(),
        voiceUrl: z.string().trim().max(600).nullable().optional(),
        questionType: z.enum(["mcq", "written"]),
        optionsEn: z.array(z.string().trim().max(600)).max(8),
        optionsUr: z.array(z.string().trim().max(600)).max(8),
        correctOption: z.number().int().min(0).max(7).nullable(),
        marks: z.number().int().min(0).max(1000),
        timeLimitSeconds: z.number().int().min(5).max(3600),
        isPublished: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const payload: Record<string, unknown> = {
      sort_order: data.sortOrder,
      question_en: data.questionEn,
      question_ur: data.questionUr,
      question_type: data.questionType,
      options_en: data.questionType === "mcq" ? data.optionsEn.filter(Boolean) : [],
      options_ur: data.questionType === "mcq" ? data.optionsUr.filter(Boolean) : [],
      correct_option: data.questionType === "mcq" ? data.correctOption : null,
      marks: data.marks,
      time_limit_seconds: data.timeLimitSeconds,
      is_published: data.isPublished,
    };
    if (data.voicePath) payload["voice_path"] = data.voicePath;
    if (data.voiceUrl !== undefined) payload["voice_url"] = data.voiceUrl || null;

    const query = data.id
      ? db.from("final_test_questions").update(payload).eq("id", data.id)
      : db.from("final_test_questions").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteFinalTestQuestion = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("final_test_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminGetFinalTests = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data } = await db
    .from("final_tests")
    .select("id, person_name, mobile, upline_name, status, marks, result, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  return { tests: data ?? [] };
});

export const adminGetFinalTestDetail = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: test } = await db
      .from("final_tests")
      .select("id, person_name, mobile, upline_name, language, status, marks, result")
      .eq("id", data.id)
      .maybeSingle();
    if (!test) throw new Error("Test record not found.");

    const { data: questions } = await db
      .from("final_test_questions")
      .select("id, sort_order, question_en, question_ur, question_type, options_en, correct_option, marks")
      .order("sort_order");
    const { data: answers } = await db
      .from("final_test_answers")
      .select("id, question_id, answer_text, selected_option, awarded_marks")
      .eq("test_id", data.id);

    const byQuestion = new Map<string, any>();
    for (const a of answers ?? []) byQuestion.set(a.question_id, a);

    return {
      test,
      rows: (questions ?? []).map((q: any) => ({
        question: q,
        answer: byQuestion.get(q.id) ?? null,
      })),
    };
  });

export const adminSetAnswerMarks = createServerFn({ method: "POST" })
  .inputValidator((data: { answerId: string; marks: number }) =>
    z.object({ answerId: uuid, marks: z.number().int().min(0).max(1000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("final_test_answers")
      .update({ awarded_marks: data.marks })
      .eq("id", data.answerId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSetFinalTestResult = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; result: string }) =>
    z.object({ id: uuid, result: z.enum(["pending", "pass", "fail"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: answers } = await db
      .from("final_test_answers")
      .select("awarded_marks")
      .eq("test_id", data.id);
    const total = (answers ?? []).reduce(
      (sum: number, a: any) => sum + (a.awarded_marks ?? 0),
      0,
    );
    const { error } = await db
      .from("final_tests")
      .update({ marks: total, result: data.result })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, marks: total };
  });
