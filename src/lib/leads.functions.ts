import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireFbo(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("member_profiles")
    .select("id, status, levels:level_id (rank_order)")
    .eq("id", userId)
    .maybeSingle();
  const rank = (data as any)?.levels?.rank_order ?? 0;
  if (!data || data.status !== "active" || rank < 2) {
    throw new Error("Leads sirf FBO (Assistant Supervisor aur upar) ke liye hain.");
  }
  return supabaseAdmin;
}

const tail = (v: string) => v.replace(/\D/g, "").slice(-10);

const uploadSchema = z.object({
  batchLabel: z.string().trim().max(60).optional().nullable(),
  rows: z
    .array(
      z.object({
        name: z.string().trim().max(100).optional().nullable(),
        phone: z.string().trim().max(30),
        city: z.string().trim().max(60).optional().nullable(),
      }),
    )
    .min(1)
    .max(5000),
  mode: z.enum(["equal", "custom", "none"]),
  custom: z.array(z.object({ assistantId: z.string().uuid(), count: z.number().int().min(0) })).optional(),
});

/** Uploads leads, removes duplicates, and hands them out to assistants. */
export const uploadLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof uploadSchema>) => uploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const admin = await requireFbo(context.userId);
    const fbo = context.userId;

    // Clean + dedupe inside the file.
    const seen = new Set<string>();
    let invalid = 0;
    let dupInFile = 0;
    const clean: { name: string | null; phone: string; city: string | null; t: string }[] = [];
    for (const r of data.rows) {
      const t = tail(r.phone);
      if (t.length < 10) { invalid++; continue; }
      if (seen.has(t)) { dupInFile++; continue; }
      seen.add(t);
      clean.push({ name: r.name || null, phone: r.phone.replace(/\D/g, ""), city: r.city || null, t });
    }

    // Dedupe against leads already owned by this FBO.
    const existing = new Set<string>();
    for (let i = 0; i < clean.length; i += 500) {
      const { data: rows } = await admin
        .from("job_leads")
        .select("phone_tail")
        .eq("fbo_id", fbo)
        .in("phone_tail", clean.slice(i, i + 500).map((c) => c.t));
      for (const r of rows ?? []) existing.add(r.phone_tail);
    }
    const fresh = clean.filter((c) => !existing.has(c.t));

    // Work out who gets each lead.
    const { data: team } = await admin
      .from("job_assistants")
      .select("id")
      .eq("fbo_id", fbo)
      .eq("status", "active")
      .order("created_at");
    const activeIds = (team ?? []).map((a) => a.id);
    const plan: (string | null)[] = [];
    if (data.mode === "equal" && activeIds.length > 0) {
      fresh.forEach((_, i) => plan.push(activeIds[i % activeIds.length]!));
    } else if (data.mode === "custom") {
      for (const c of data.custom ?? []) {
        if (!activeIds.includes(c.assistantId)) continue;
        for (let k = 0; k < c.count && plan.length < fresh.length; k++) plan.push(c.assistantId);
      }
    }
    const now = new Date().toISOString();
    const insert = fresh.map((c, i) => ({
      fbo_id: fbo,
      assistant_id: plan[i] ?? null,
      assigned_at: plan[i] ? now : null,
      batch_label: data.batchLabel || null,
      full_name: c.name,
      phone: c.phone,
      phone_tail: c.t,
      city: c.city,
    }));
    for (let i = 0; i < insert.length; i += 500) {
      const { error } = await admin.from("job_leads").insert(insert.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    return {
      added: insert.length,
      assigned: insert.filter((r) => r.assistant_id).length,
      duplicates: dupInFile + (clean.length - fresh.length),
      invalid,
    };
  });

export const getMyLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { filter?: string }) => z.object({ filter: z.string().max(60).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const admin = await requireFbo(context.userId);
    let q = admin
      .from("job_leads")
      .select("id, full_name, phone, city, status, assistant_id, batch_label, created_at")
      .eq("fbo_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.filter === "unassigned") q = q.is("assistant_id", null);
    else if (data.filter && data.filter !== "all") q = q.eq("assistant_id", data.filter);
    const { data: leads, error } = await q;
    if (error) throw new Error(error.message);

    const { data: all } = await admin
      .from("job_leads")
      .select("assistant_id, status")
      .eq("fbo_id", context.userId)
      .limit(20000);
    const counts: Record<string, number> = {};
    let unassigned = 0;
    for (const r of all ?? []) {
      if (!r.assistant_id) unassigned++;
      else counts[r.assistant_id] = (counts[r.assistant_id] ?? 0) + 1;
    }
    return { leads: leads ?? [], counts, unassigned, total: (all ?? []).length };
  });

/** Moves leads to another assistant (or back to unassigned). */
export const reassignLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leadIds?: string[]; fromUnassigned?: boolean; assistantId: string | null }) =>
    z
      .object({
        leadIds: z.array(z.string().uuid()).max(1000).optional(),
        fromUnassigned: z.boolean().optional(),
        assistantId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await requireFbo(context.userId);
    if (data.assistantId) {
      const { data: a } = await admin
        .from("job_assistants")
        .select("id")
        .eq("id", data.assistantId)
        .eq("fbo_id", context.userId)
        .eq("status", "active")
        .maybeSingle();
      if (!a) throw new Error("Assistant active nahi hai.");
    }
    let q = admin
      .from("job_leads")
      .update({ assistant_id: data.assistantId, assigned_at: data.assistantId ? new Date().toISOString() : null })
      .eq("fbo_id", context.userId);
    if (data.fromUnassigned) q = q.is("assistant_id", null);
    else q = q.in("id", data.leadIds ?? []);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
