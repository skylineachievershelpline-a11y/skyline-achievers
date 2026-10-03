import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ transcript: z.string().trim().min(1).max(16_000) });

export type CallSummary = { covered: string[]; questions: number; unclear: string[]; next: string };

/** Short end-of-call summary from this call's own captions (not stored, not shared). */
export const summarizeLiveCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof input>) => input.parse(data))
  .handler(async ({ data }): Promise<CallSummary> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Skyline AI is not configured.");
    const { createLovableAiGatewayRunIdFetch } = await import("@/lib/ai-gateway.server");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: createLovableAiGatewayRunIdFetch().fetch,
    });
    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      system:
        'Summarise a Skyline Achievers teaching call from its captions. Use only what was said. Short Roman Urdu/English topic names. Return ONLY JSON: {"covered":["..."],"questions":<number of questions the caller asked>,"unclear":["topics still unclear"],"next":"one suggested next step"}.',
      prompt: data.transcript,
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const text = (await result.text).trim();
    const match = text.match(/\{[\s\S]*\}/);
    try {
      const parsed = JSON.parse(match?.[0] ?? text) as Partial<CallSummary>;
      return {
        covered: Array.isArray(parsed.covered) ? parsed.covered.slice(0, 8).map(String) : [],
        questions: Number.isFinite(Number(parsed.questions)) ? Number(parsed.questions) : 0,
        unclear: Array.isArray(parsed.unclear) ? parsed.unclear.slice(0, 6).map(String) : [],
        next: typeof parsed.next === "string" ? parsed.next : "",
      };
    } catch {
      return { covered: [], questions: 0, unclear: [], next: "" };
    }
  });
