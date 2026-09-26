import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Commission & rule settings for the Job Assistant system (admin editable). */
export type AssistantSettings = {
  minSampleLeads: number;
  maxAssistantsPerFbo: number;
  serviceFeePercent: number;
  enrollmentTiers: { minRate: number; perEnrollment: number }[];
  ccTiers: { minCount: number; perCc: number }[];
};

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  minSampleLeads: 10,
  maxAssistantsPerFbo: 10,
  serviceFeePercent: 5,
  enrollmentTiers: [
    { minRate: 0, perEnrollment: 70 },
    { minRate: 20, perEnrollment: 100 },
    { minRate: 30, perEnrollment: 130 },
  ],
  ccTiers: [
    { minCount: 1, perCc: 2999 },
    { minCount: 2, perCc: 4999 },
  ],
};

const settingsSchema = z.object({
  minSampleLeads: z.number().int().min(1).max(1000),
  maxAssistantsPerFbo: z.number().int().min(1).max(200),
  serviceFeePercent: z.number().min(0).max(100),
  enrollmentTiers: z
    .array(z.object({ minRate: z.number().min(0).max(100), perEnrollment: z.number().min(0).max(100000) }))
    .min(1)
    .max(20),
  ccTiers: z
    .array(z.object({ minCount: z.number().int().min(1).max(1000), perCc: z.number().min(0).max(1000000) }))
    .min(1)
    .max(20),
});

const KEY = "job_assistant_settings";

async function readSettings(): Promise<AssistantSettings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("platform_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  const parsed = settingsSchema.safeParse(data?.value);
  return parsed.success ? parsed.data : DEFAULT_ASSISTANT_SETTINGS;
}

async function requireFbo(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("member_profiles")
    .select("id, status, levels:level_id (rank_order)")
    .eq("id", userId)
    .maybeSingle();
  const rank = (data as any)?.levels?.rank_order ?? 0;
  if (!data || data.status !== "active" || rank < 2) {
    throw new Error("Job Assistants sirf FBO (Assistant Supervisor aur upar) ke liye hain.");
  }
  return supabaseAdmin;
}

/* ---------- Admin ---------- */

export const adminGetAssistantSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const settings = await readSettings();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("job_assistants")
    .select("id, full_name, phone, role, status, created_at, fbo:fbo_id (member_id, full_name)")
    .neq("status", "removed")
    .order("created_at", { ascending: false })
    .limit(500);
  return { settings, assistants: (data ?? []) as any[] };
});

export const adminSaveAssistantSettings = createServerFn({ method: "POST" })
  .inputValidator((data: AssistantSettings) => settingsSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sorted = {
      ...data,
      enrollmentTiers: [...data.enrollmentTiers].sort((a, b) => a.minRate - b.minRate),
      ccTiers: [...data.ccTiers].sort((a, b) => a.minCount - b.minCount),
    };
    const { error } = await (supabaseAdmin as any)
      .from("platform_settings")
      .upsert({ key: KEY, value: sorted, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------- FBO ---------- */

export const getMyAssistants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireFbo(context.userId);
    const settings = await readSettings();
    const { data, error } = await admin
      .from("job_assistants")
      .select("id, full_name, phone, email, role, status, daily_lead_limit, notes, created_at")
      .eq("fbo_id", context.userId)
      .neq("status", "removed")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { computeEarnings } = await import("./commission.server");
    const ids = (data ?? []).map((a) => a.id);
    const { data: leads } = ids.length
      ? await admin
          .from("job_leads")
          .select("assistant_id, call_count, enroll_verified_at, cc_verified_at")
          .in("assistant_id", ids)
          .limit(20000)
      : { data: [] as any[] };
    const assistants = (data ?? []).map((a) => ({
      ...a,
      earnings: computeEarnings((leads ?? []).filter((l: any) => l.assistant_id === a.id), a.role, settings),
    }));
    return { assistants, settings };
  });

const addSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email().max(120).optional().nullable().or(z.literal("")),
  role: z.enum(["calling", "full_funnel"]),
  dailyLeadLimit: z.number().int().min(1).max(500),
  notes: z.string().trim().max(300).optional().nullable(),
});

export const addAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof addSchema>) => addSchema.parse(data))
  .handler(async ({ data, context }) => {
    const admin = await requireFbo(context.userId);
    const settings = await readSettings();
    const { count } = await admin
      .from("job_assistants")
      .select("id", { count: "exact", head: true })
      .eq("fbo_id", context.userId)
      .neq("status", "removed");
    if ((count ?? 0) >= settings.maxAssistantsPerFbo) {
      throw new Error(`Aap zyada se zyada ${settings.maxAssistantsPerFbo} assistants rakh sakte hain.`);
    }
    const phone = data.phone.replace(/\D/g, "");
    const { assertPhoneEmailFree } = await import("./identity-unique.server");
    await assertPhoneEmailFree({ phone, email: data.email || null });
    const { error } = await admin.from("job_assistants").insert({
      fbo_id: context.userId,
      full_name: data.fullName,
      phone,
      email: data.email || null,
      role: data.role,
      daily_lead_limit: data.dailyLeadLimit,
      notes: data.notes || null,
    });
    if (error) {
      throw new Error(
        error.code === "23505"
          ? "Ye mobile number pehle se kisi aur FBO ke assistant par registered hai."
          : error.message,
      );
    }
    return { ok: true as const };
  });

export const updateAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    id: string;
    status?: "active" | "paused" | "removed";
    role?: "calling" | "full_funnel";
    dailyLeadLimit?: number;
  }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["active", "paused", "removed"]).optional(),
        role: z.enum(["calling", "full_funnel"]).optional(),
        dailyLeadLimit: z.number().int().min(1).max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireFbo(context.userId);
    const patch: Record<string, unknown> = {};
    if (data.status) patch["status"] = data.status;
    if (data.role) patch["role"] = data.role;
    if (data.dailyLeadLimit) patch["daily_lead_limit"] = data.dailyLeadLimit;
    const { error } = await admin
      .from("job_assistants")
      .update(patch as any)
      .eq("id", data.id)
      .eq("fbo_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
