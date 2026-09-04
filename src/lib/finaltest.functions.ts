import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Final Test module. Every table involved is unreachable from the browser:
 * candidates only reach their own record through the unique link token, and
 * uplines only through their signed-in account.
 */

const LANGUAGES = ["english", "urdu", "voice"] as const;
type Language = (typeof LANGUAGES)[number];

function makeToken() {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `${raw.slice(0, 12)}${Math.random().toString(36).slice(2, 8)}`;
}

async function signVoice(path: string | null, url: string | null) {
  if (url) return url;
  if (!path) return null;
  const { signPath, RESOURCE_BUCKET } = await import("./storage.server");
  return signPath(RESOURCE_BUCKET, path, 60 * 60 * 4);
}

/* ------------------------------------------------------------------ upline */

export const uplineCreateFinalTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { personName: string; mobile: string }) =>
    z
      .object({
        personName: z.string().trim().min(2, "Enter the person's name").max(120),
        mobile: z
          .string()
          .trim()
          .min(7, "Enter a valid mobile number")
          .max(20)
          .regex(/^[0-9+\-\s]+$/, "Digits only"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadMemberContext } = await import("./member.server");
    const member = await loadMemberContext(context.supabase as never, context.userId);
    if (!member || member.status !== "active") throw new Error("Your account is not active.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = makeToken();
    const { data: row, error } = await (supabaseAdmin as any)
      .from("final_tests")
      .insert({
        token,
        person_name: data.personName,
        mobile: data.mobile,
        upline_account_id: context.userId,
        upline_name: member.fullName,
      })
      .select("id, token, person_name, mobile, upline_name, status, marks, result")
      .single();
    if (error) throw new Error(error.message);
    return { test: row };
  });

export const uplineFinalTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("final_tests")
      .select("id, token, person_name, mobile, upline_name, status, marks, result, created_at")
      .eq("upline_account_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    return { tests: data ?? [] };
  });

/* --------------------------------------------------------------- candidate */

export const getFinalTestByToken = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) =>
    z.object({ token: z.string().trim().min(8).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: test } = await (supabaseAdmin as any)
      .from("final_tests")
      .select("id, token, person_name, mobile, upline_name, language, status, marks, result")
      .eq("token", data.token)
      .maybeSingle();
    if (!test) return { status: "invalid" as const };

    const { data: rules } = await (supabaseAdmin as any)
      .from("final_test_rules")
      .select("rules_en, rules_ur, voice_path, voice_url, show_result_to_candidate")
      .eq("id", "default")
      .maybeSingle();

    return {
      status: "ok" as const,
      test: {
        personName: test.person_name as string,
        mobile: test.mobile as string,
        uplineName: test.upline_name as string,
        language: (test.language ?? null) as Language | null,
        testStatus: test.status as string,
        marks: (test.marks ?? null) as number | null,
        result: test.result as string,
      },
      rules: {
        english: (rules?.rules_en ?? null) as string | null,
        urdu: (rules?.rules_ur ?? null) as string | null,
        voiceUrl: await signVoice(rules?.voice_path ?? null, rules?.voice_url ?? null),
        showResult: Boolean(rules?.show_result_to_candidate),
      },
    };
  });

export const startFinalTest = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; language: string }) =>
    z
      .object({
        token: z.string().trim().min(8).max(64),
        language: z.enum(LANGUAGES),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: test } = await (supabaseAdmin as any)
      .from("final_tests")
      .select("id, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!test) return { status: "invalid" as const };
    if (test.status === "completed") return { status: "completed" as const };

    await (supabaseAdmin as any)
      .from("final_tests")
      .update({
        language: data.language,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", test.id);

    const { data: questions } = await (supabaseAdmin as any)
      .from("final_test_questions")
      .select(
        "id, sort_order, question_en, question_ur, voice_path, voice_url, question_type, options_en, options_ur, marks, time_limit_seconds",
      )
      .eq("is_published", true)
      .order("sort_order");

    const list = await Promise.all(
      (questions ?? []).map(async (q: any) => ({
        id: q.id as string,
        type: q.question_type as "mcq" | "written",
        marks: q.marks as number,
        timeLimitSeconds: q.time_limit_seconds as number,
        text:
          data.language === "urdu"
            ? ((q.question_ur || q.question_en) as string)
            : (q.question_en as string),
        voiceUrl:
          data.language === "voice" ? await signVoice(q.voice_path, q.voice_url) : null,
        options:
          q.question_type === "mcq"
            ? (data.language === "urdu" && (q.options_ur ?? []).length > 0
                ? (q.options_ur as string[])
                : ((q.options_en ?? []) as string[]))
            : [],
      })),
    );

    // Answers already saved (e.g. after a page refresh) can never be reopened.
    const { data: answered } = await (supabaseAdmin as any)
      .from("final_test_answers")
      .select("question_id")
      .eq("test_id", test.id);
    const done = new Set((answered ?? []).map((a: any) => a.question_id as string));

    return {
      status: "ok" as const,
      questions: list.filter((q) => !done.has(q.id)),
    };
  });

export const submitFinalAnswer = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      token: string;
      questionId: string;
      answerText?: string | null;
      selectedOption?: number | null;
    }) =>
      z
        .object({
          token: z.string().trim().min(8).max(64),
          questionId: z.string().uuid(),
          answerText: z.string().trim().max(4000).nullable().optional(),
          selectedOption: z.number().int().min(0).max(20).nullable().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: test } = await (supabaseAdmin as any)
      .from("final_tests")
      .select("id, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!test || test.status === "completed") return { status: "invalid" as const };

    // Unique (test_id, question_id) means a submitted answer can never change.
    await (supabaseAdmin as any).from("final_test_answers").insert({
      test_id: test.id,
      question_id: data.questionId,
      answer_text: data.answerText ?? null,
      selected_option: data.selectedOption ?? null,
    });
    return { status: "ok" as const };
  });

export const finishFinalTest = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) =>
    z.object({ token: z.string().trim().min(8).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("final_tests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("token", data.token);
    if (error) throw new Error(error.message);
    return { status: "ok" as const };
  });
