import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  mode: z.enum(["ask", "check"]),
  stepTitle: z.string().min(1).max(160),
  stepContext: z.string().min(1).max(4000),
  question: z.string().max(400).optional(),
  text: z.string().trim().min(1).max(1000),
});

/** Website Guide help: answers a doubt or checks an understanding answer. */
export const guideAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof input>) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: trainee }, { data: member }] = await Promise.all([
      supabaseAdmin.from("trainees").select("status").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("member_profiles").select("status, levels:level_id(name)").eq("id", context.userId).maybeSingle(),
    ]);
    const access = trainee?.status === "active" ? "Beginners Training"
      : member?.status === "active" ? ((member.levels as { name?: string } | null)?.name ?? "member") : null;
    if (!access) throw new Error("Your account is not active.");

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Skyline AI is not configured.");
    const { SKYLINE_KNOWLEDGE } = await import("@/lib/skyline-knowledge");
    const { FLP_KNOWLEDGE } = await import("@/lib/flp-knowledge");
    const { loadVideoKnowledgeContext } = await import("@/lib/video-knowledge.server");
    const { createLovableAiGatewayRunIdFetch } = await import("@/lib/ai-gateway.server");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { generateText } = await import("ai");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: createLovableAiGatewayRunIdFetch().fetch,
    });
    const videoContext = await loadVideoKnowledgeContext(20);

    const system = `You are Skyline Achievers AI in WEBSITE GUIDE mode, explaining the Skyline website to a new person like a kind senior. Their access: ${access}.
Use very simple Roman Urdu with common English words; no technical words. Keep replies under 90 words.
Only use the CURRENT STEP facts and references below. Never invent features. Never state fees, prices, salaries or income; send those questions to their senior/upline. Never reveal admin areas, codes, passwords or other people's data.

CURRENT STEP: ${data.stepTitle}
${data.stepContext}

SKYLINE REFERENCE:
${SKYLINE_KNOWLEDGE}

FLP REFERENCE:
${FLP_KNOWLEDGE}${videoContext}`;

    const prompt = data.mode === "check"
      ? `The guide asked: "${data.question ?? ""}". The user answered: "${data.text}".
Judge generously: the answer is correct if the main idea matches the CURRENT STEP. Return ONLY JSON: {"correct":true|false,"reply":"..."}.
If correct: reply is one short confirmation. If not: explain again simply with one everyday example, then ask the same question again.`
      : `User's doubt about this step: "${data.text}". Answer it simply.`;

    const result = await generateText({ model: lovable.responses("openai/gpt-6-astra"), system, prompt, providerOptions: { openai: { store: false } } });
    if (data.mode === "ask") return { reply: result.text.trim(), correct: null as boolean | null };
    try {
      const parsed = JSON.parse(result.text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as { correct?: boolean; reply?: string };
      return { reply: parsed.reply ?? "", correct: Boolean(parsed.correct) };
    } catch {
      return { reply: result.text.trim(), correct: false };
    }
  });
