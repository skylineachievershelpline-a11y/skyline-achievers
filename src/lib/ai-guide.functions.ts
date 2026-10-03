import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Verified account access text for the signed-in person, or throws. */
async function accessFor(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: trainee }, { data: member }] = await Promise.all([
    supabaseAdmin.from("trainees").select("status").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("member_profiles").select("status, levels:level_id(name)").eq("id", userId).maybeSingle(),
  ]);
  const access = trainee?.status === "active" ? "Beginners Training"
    : member?.status === "active" ? ((member.levels as { name?: string } | null)?.name ?? "member") : null;
  if (!access) throw new Error("Your account is not active.");
  return access;
}

/** One knowledge-grounded model call shared by the guide modes. */
async function runGuideModel(system: string, prompt: string) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Skyline AI is not configured.");
  const { createLovableAiGatewayRunIdFetch } = await import("@/lib/ai-gateway.server");
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { generateText } = await import("ai");
  const lovable = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createLovableAiGatewayRunIdFetch().fetch,
  });
  const result = await generateText({ model: lovable.responses("openai/gpt-6-astra"), system, prompt, providerOptions: { openai: { store: false } } });
  return result.text.trim();
}

async function references() {
  const { SKYLINE_KNOWLEDGE } = await import("@/lib/skyline-knowledge");
  const { FLP_KNOWLEDGE } = await import("@/lib/flp-knowledge");
  const { loadVideoKnowledgeContext } = await import("@/lib/video-knowledge.server");
  const videoContext = await loadVideoKnowledgeContext(20);
  return `SKYLINE REFERENCE:\n${SKYLINE_KNOWLEDGE}\n\nFLP REFERENCE:\n${FLP_KNOWLEDGE}${videoContext}`;
}

const STRICT = `STRICT TRUTH RULES: Use only the CURRENT STEP facts and the references. Never invent features, fees, prices, income, policies, rank requirements, unlock conditions, product claims or payment rules. If verified information is missing say: "Mere paas is point ki verified information nahi hai. Iske liye Skyline senior/Upline se confirm karna better hoga." Never reveal admin areas, codes, passwords or other people's data.`;

function parseJson<T>(text: string): T | null {
  try { return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as T; }
  catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]) as T; } catch { return null; }
  }
}

const input = z.object({
  mode: z.enum(["ask", "check"]),
  stepTitle: z.string().min(1).max(160),
  stepContext: z.string().min(1).max(4000),
  question: z.string().max(400).optional(),
  text: z.string().trim().min(1).max(1000),
});

/** Phase 1 helper: answers a doubt or checks an understanding answer. */
export const guideAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof input>) => input.parse(data))
  .handler(async ({ data, context }) => {
    const access = await accessFor(context.userId);
    const system = `You are Skyline Achievers AI in WEBSITE GUIDE mode, explaining the Skyline website to a new person like a kind senior. Their access: ${access}.
Use very simple Roman Urdu with common English words; no technical words. Keep replies under 90 words.
${STRICT}

CURRENT STEP: ${data.stepTitle}
${data.stepContext}

${await references()}`;
    const prompt = data.mode === "check"
      ? `The guide asked: "${data.question ?? ""}". The user answered: "${data.text}".
Judge meaning, not keywords. Return ONLY JSON: {"correct":true|false,"reply":"..."}.`
      : `User's doubt about this step: "${data.text}". Answer it simply.`;
    const text = await runGuideModel(system, prompt);
    if (data.mode === "ask") return { reply: text, correct: null as boolean | null };
    const parsed = parseJson<{ correct?: boolean; reply?: string }>(text);
    return { reply: parsed?.reply ?? text, correct: Boolean(parsed?.correct) };
  });

const teachInput = z.object({
  mode: z.enum(["teach", "turn"]),
  stepTitle: z.string().min(1).max(160),
  stepContext: z.string().min(1).max(4000),
  question: z.string().max(400).optional(),
  actionSay: z.string().max(300).optional(),
  locked: z.boolean(),
  level: z.enum(["beginner", "standard", "advanced"]),
  stepNumber: z.number().int().min(1).max(100),
  totalSteps: z.number().int().min(1).max(100),
  welcome: z.enum(["first", "resume", "none"]),
  expectingAnswer: z.boolean(),
  confusion: z.number().int().min(0).max(20),
  utterance: z.string().trim().max(1000).optional(),
  history: z.array(z.object({ role: z.enum(["ai", "user"]), text: z.string().max(1200) })).max(12),
});

export type GuideIntent = "answer" | "question" | "confused" | "next" | "previous" | "repeat" | "pause" | "chat";

/** Website Teacher: conversational teaching and turn-taking for one step. */
export const guideTeach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof teachInput>) => teachInput.parse(data))
  .handler(async ({ data, context }) => {
    const access = await accessFor(context.userId);
    const levelRule = {
      beginner: "The user is a complete beginner: explain from zero with one tiny everyday example.",
      standard: "The user knows basics: explain clearly and briefly.",
      advanced: "The user is experienced: say they already know this section, then focus on its important workflow and overlooked features that are in the step facts.",
    }[data.level];
    const confusionRule = data.confusion <= 0 ? "" : `The user has been confused ${data.confusion} time(s) on this step. Do NOT repeat earlier wording. Use step ${Math.min(data.confusion, 4)} of this ladder: 1 simpler words, 2 real-world example, 3 analogy, 4 short practical example. Then ask a simple understanding question.`;
    const system = `You are the Skyline Website Teacher: a warm Skyline trainer sitting next to the user and teaching the website by voice. Account access: ${access}.
Speak naturally like a person, not like a document: short spoken sentences, no lists, no markdown, no emojis, under 70 words. Match the user's language style (Roman Urdu, Urdu script, English, or mixed); default to simple Roman Urdu.
${levelRule}
${confusionRule}
${data.locked ? `This section is NOT available on the user's current access. Say: "Ye feature aapke current level par available nahi hai. Jab aap required stage par pohanchein ge to ye option unlock hoga." Do not invent the requirement.` : ""}
${STRICT}

CURRENT STEP (${data.stepNumber} of ${data.totalSteps}): ${data.stepTitle}
${data.stepContext}
${data.question ? `UNDERSTANDING QUESTION FOR THIS STEP: ${data.question}` : ""}
${data.actionSay ? `GUIDED CLICK FOR THIS STEP (user must click it themselves): ${data.actionSay}` : ""}

${await references()}`;

    const history = data.history.map((h) => `${h.role === "ai" ? "Teacher" : "User"}: ${h.text}`).join("\n");

    if (data.mode === "teach") {
      const welcome = data.welcome === "first"
        ? `Start with: "Assalam-o-Alaikum. Main aapka Skyline Website Teacher hoon. Aaj hum website ko step by step explore karenge. Aap mujhe beech mein kabhi bhi rok kar sawal pooch sakte hain." then begin.`
        : data.welcome === "resume" ? `Start with a short welcome back saying last time you reached "${data.stepTitle}" and you continue from there.` : "";
      const reply = await runGuideModel(system, `${welcome}
Teach this step conversationally: say where we are, what it is and why it matters. ${data.actionSay && !data.locked ? "End by asking the user to click the highlighted element." : data.question ? "End by asking the understanding question in your own natural words." : "End by asking if it is clear or if they have a question."}`);
      return { reply, intent: "chat" as GuideIntent, correct: null as boolean | null };
    }

    const text = await runGuideModel(system, `Conversation so far:
${history || "(none)"}

User just said: "${data.utterance ?? ""}"
${data.expectingAnswer ? "The teacher is waiting for the answer to the understanding question." : ""}
Classify intent: "answer" (answer to the understanding question), "question" (a doubt — words like "ye", "is" refer to the CURRENT STEP), "confused" (does not understand), "next", "previous", "repeat", "pause", or "chat".
For "answer": judge MEANING not keywords, be generous ("Is se pata chalta hai main roz kya kaam kar raha hoon" is correct for Daily Report). If correct, confirm in one short line. If wrong, correct gently with an example and ask again.
For "question": answer it about the current step, then briefly bring them back to the step.
For "confused": re-explain using the ladder rule.
Return ONLY JSON: {"intent":"...","correct":true|false|null,"reply":"spoken reply"}`);
    const parsed = parseJson<{ intent?: GuideIntent; correct?: boolean | null; reply?: string }>(text);
    return {
      reply: parsed?.reply ?? text,
      intent: (parsed?.intent ?? "chat") as GuideIntent,
      correct: typeof parsed?.correct === "boolean" ? parsed.correct : null,
    };
  });

/** Speech to text for the Website Teacher (Roman Urdu, Urdu, English, mixed). */
export const guideTranscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { audio: string; mime: string }) =>
    z.object({ audio: z.string().min(100).max(4_000_000), mime: z.string().max(80) }).parse(data))
  .handler(async ({ data, context }) => {
    await accessFor(context.userId);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Skyline AI is not configured.");
    const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
    const ext = data.mime.includes("mp4") ? "mp4" : data.mime.includes("ogg") ? "ogg" : data.mime.includes("wav") ? "wav" : "webm";
    const form = new FormData();
    form.append("model", "openai/gpt-4o-transcribe");
    form.append("response_format", "json");
    form.append("prompt", "Pakistani speaker using Roman Urdu, Urdu and English mixed. Skyline Achievers website: Dashboard, Daily Report, To-do List, Team Tree, Training.");
    form.append("file", new File([bytes], `voice.${ext}`, { type: data.mime.split(";")[0] || "audio/webm" }));
    const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form,
    });
    if (!response.ok) throw new Error("Mujhe aapki baat clear nahi mili. Dobara bol dein.");
    const raw = await response.text();
    let text = "";
    try { text = (JSON.parse(raw) as { text?: string }).text ?? ""; }
    catch {
      for (const line of raw.split("\n")) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(t.slice(5)) as { type?: string; delta?: string; text?: string };
          if (ev.type?.endsWith("delta") && ev.delta) text += ev.delta;
          else if (ev.text) text = ev.text;
        } catch { /* partial frame */ }
      }
    }
    return { text: text.replace(/\s+/g, " ").trim() };
  });

/**
 * Voice-provider adapter for an authorized Skyline voice.
 * SKYLINE_AI_VOICE_PROFILE = "<voice id>" enables it; SKYLINE_AI_VOICE_MODEL
 * picks the speech model. Unset → the app uses the device's generic voice.
 */
export const guideSpeak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string }) => z.object({ text: z.string().trim().min(1).max(1500) }).parse(data))
  .handler(async ({ data }) => {
    const profile = process.env["SKYLINE_AI_VOICE_PROFILE"];
    const key = process.env["LOVABLE_API_KEY"];
    if (!profile || !key) return { available: false as const };
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env["SKYLINE_AI_VOICE_MODEL"] ?? "openai/gpt-4o-mini-tts", voice: profile, input: data.text, response_format: "mp3" }),
      });
      if (!response.ok) return { available: false as const };
      const buf = new Uint8Array(await response.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { available: true as const, audio: btoa(bin), mime: "audio/mpeg" };
    } catch {
      return { available: false as const };
    }
  });
