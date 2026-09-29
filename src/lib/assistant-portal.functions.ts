import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenSchema = z.string().regex(/^[a-f0-9]{48}$/);

async function assistantByToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("job_assistants")
    .select("id, fbo_id, full_name, role, status, daily_lead_limit, fbo:fbo_id (full_name, member_id)")
    .eq("access_token", tokenSchema.parse(token))
    .maybeSingle();
  if (!data || data.status === "removed") throw new Error("Ye link ab valid nahi hai.");
  if (data.status === "paused") throw new Error("Aapka account abhi FBO ne pause kiya hua hai.");
  return { admin: supabaseAdmin, assistant: data as any };
}

/** Assistant's private workspace, opened with their personal link. */
export const getAssistantPortal = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { admin, assistant } = await assistantByToken(data.token);
    const { data: leads } = await admin
      .from("job_leads")
      .select("id, full_name, phone, city, status, follow_up_at, last_called_at, call_count, notes")
      .eq("assistant_id", assistant.id)
      .order("created_at")
      .limit(2000);
    const startOfDay = new Date();
    startOfDay.setUTCHours(-5, 0, 0, 0); // PKT midnight
    if (startOfDay.getTime() > Date.now()) startOfDay.setUTCDate(startOfDay.getUTCDate() - 1);
    const { count: todayCalls } = await admin
      .from("job_lead_activities")
      .select("id", { count: "exact", head: true })
      .eq("assistant_id", assistant.id)
      .gte("created_at", startOfDay.toISOString());
    return {
      assistant: {
        name: assistant.full_name,
        role: assistant.role as "calling" | "full_funnel",
        dailyLimit: assistant.daily_lead_limit,
        fboName: assistant.fbo?.full_name ?? "",
        fboCode: assistant.fbo?.member_id ?? "",
      },
      todayCalls: todayCalls ?? 0,
      leads: leads ?? [],
    };
  });

const OUTCOMES = ["contacted", "follow_up", "not_interested", "invalid", "enrolled", "cc_done", "no_answer"] as const;

export const logLeadCall = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; leadId: string; outcome: string; note?: string; followUpAt?: string | null }) =>
    z
      .object({
        token: tokenSchema,
        leadId: z.string().uuid(),
        outcome: z.enum(OUTCOMES),
        note: z.string().trim().max(500).optional(),
        followUpAt: z.string().datetime().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { admin, assistant } = await assistantByToken(data.token);
    if (data.outcome === "cc_done" && assistant.role !== "full_funnel") {
      throw new Error("2CC sirf Full Funnel Assistant mark kar sakta hai.");
    }
    const { data: lead } = await admin
      .from("job_leads")
      .select("id, call_count, notes")
      .eq("id", data.leadId)
      .eq("assistant_id", assistant.id)
      .maybeSingle();
    if (!lead) throw new Error("Ye lead aapko assign nahi hai.");
    const now = new Date().toISOString();
    const status = data.outcome === "no_answer" ? "follow_up" : data.outcome;
    const { error } = await admin
      .from("job_leads")
      .update({
        status,
        last_called_at: now,
        call_count: (lead.call_count ?? 0) + 1,
        follow_up_at: status === "follow_up" ? data.followUpAt ?? null : null,
        // The 10-day cycle maths needs the exact moment of conversion.
        ...(status === "enrolled" ? { enrolled_at: now } : {}),
        ...(status === "cc_done" ? { cc_done_at: now } : {}),
        ...(data.note ? { notes: data.note } : {}),
      } as any)
      .eq("id", lead.id);
    if (error) throw new Error(error.message);
    await admin.from("job_lead_activities").insert({
      lead_id: lead.id,
      assistant_id: assistant.id,
      fbo_id: assistant.fbo_id,
      outcome: data.outcome,
      note: data.note || null,
    });
    return { ok: true as const };
  });

/** FBO: fetch (or reset) an assistant's private portal link. */
export const getAssistantLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reset?: boolean }) =>
    z.object({ id: z.string().uuid(), reset: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin
      .from("member_profiles")
      .select("status, levels:level_id (rank_order)")
      .eq("id", context.userId)
      .maybeSingle();
    if (!me || me.status !== "active" || ((me as any).levels?.rank_order ?? 0) < 2) throw new Error("Not allowed");
    if (data.reset) {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      await supabaseAdmin
        .from("job_assistants")
        .update({ access_token: token })
        .eq("id", data.id)
        .eq("fbo_id", context.userId);
    }
    const { data: row } = await supabaseAdmin
      .from("job_assistants")
      .select("access_token")
      .eq("id", data.id)
      .eq("fbo_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("Assistant nahi mila.");
    return { token: row.access_token };
  });
