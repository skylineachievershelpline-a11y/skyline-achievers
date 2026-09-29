/**
 * Skyline Growth Executive — paid unlock, 10-day cycle earnings and admin control.
 *
 * Strict isolation: every read is scoped to the signed-in FBO, and assistant
 * money is always computed from that FBO's own leads.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_GROWTH_SETTINGS,
  cycleEarnings,
  cycleOf,
  inCycle,
  type GrowthSettings,
} from "./growth-cycle";

const SETTINGS_KEY = "growth_executive_settings";
const PROOF_BUCKET = "payment-proofs";

const settingsSchema = z.object({
  unlockFee: z.number().min(0).max(1_000_000),
  unlockDays: z.number().int().min(0).max(3650),
  enrollmentTiers: z
    .array(z.object({ minRate: z.number().min(0).max(100), perEnrollment: z.number().min(0).max(100_000) }))
    .min(1)
    .max(20),
  ccTiers: z
    .array(z.object({ minCount: z.number().int().min(1).max(1000), perCc: z.number().min(0).max(1_000_000) }))
    .min(1)
    .max(20),
});

async function readSettings(): Promise<GrowthSettings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("platform_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  const parsed = settingsSchema.safeParse(data?.value);
  return parsed.success ? parsed.data : DEFAULT_GROWTH_SETTINGS;
}

async function fboRow(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("member_profiles")
    .select("id, member_id, full_name, status, phone, levels:level_id (rank_order)")
    .eq("id", userId)
    .maybeSingle();
  const rank = data?.levels?.rank_order ?? 0;
  if (!data || data.status !== "active" || rank < 2) {
    throw new Error("Skyline Growth Executive sirf FBO (Assistant Supervisor aur upar) ke liye hai.");
  }
  return { admin: supabaseAdmin, member: data as any };
}

type AccessRow = {
  status: string;
  amount: number;
  requested_at: string;
  approved_at: string | null;
  expires_at: string | null;
  note: string | null;
} | null;

function liveAccess(row: AccessRow) {
  if (!row) return { state: "locked" as const, row: null };
  if (row.status === "active" && row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { state: "expired" as const, row };
  }
  if (row.status === "active") return { state: "active" as const, row };
  if (row.status === "pending") return { state: "pending" as const, row };
  return { state: "rejected" as const, row };
}

/** Unlock state + the payment accounts the office shared. */
export const getGrowthStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, member } = await fboRow(context.userId);
    const settings = await readSettings();
    const [{ data: access }, { data: methods }] = await Promise.all([
      (admin as any)
        .from("growth_access")
        .select("status, amount, requested_at, approved_at, expires_at, note")
        .eq("fbo_id", member.id)
        .maybeSingle(),
      (admin as any)
        .from("course_payment_methods")
        .select("id, label, account_name, account_number, instructions, qr_url")
        .eq("is_active", true)
        .order("sort_order"),
    ]);
    const live = liveAccess(access as AccessRow);
    return {
      state: live.state,
      access: live.row,
      unlockFee: settings.unlockFee,
      unlockDays: settings.unlockDays,
      methods: (methods ?? []) as any[],
    };
  });

/** Upload slot for the unlock payment screenshot. */
export const createGrowthProofUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileName: string }) => z.object({ fileName: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, member } = await fboRow(context.userId);
    const dot = data.fileName.lastIndexOf(".");
    const ext = dot > 0 ? data.fileName.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").toLowerCase() : "jpg";
    if (!["png", "jpg", "jpeg", "webp"].includes(ext)) {
      throw new Error("PNG, JPG ya WebP screenshot chunein.");
    }
    const { data: signed, error } = await admin.storage
      .from(PROOF_BUCKET)
      .createSignedUploadUrl(`${member.id}/growth-${crypto.randomUUID()}.${ext}`);
    if (error || !signed) throw new Error(error?.message ?? "Screenshot upload tayar nahi ho saka.");
    return { path: signed.path, signedUrl: signed.signedUrl };
  });

const requestSchema = z.object({
  method: z.string().trim().min(1).max(60),
  senderName: z.string().trim().min(2).max(80),
  referenceNo: z.string().trim().max(60).optional().nullable(),
  amount: z.number().min(1).max(1_000_000),
  proofPath: z.string().trim().min(3).max(300),
});

/** FBO asks for the feature; stays pending until the office verifies. */
export const requestGrowthAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof requestSchema>) => requestSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin, member } = await fboRow(context.userId);
    if (!data.proofPath.startsWith(`${member.id}/`)) throw new Error("Ye screenshot is account ka nahi hai.");
    const { data: existing } = await (admin as any)
      .from("growth_access")
      .select("status, expires_at")
      .eq("fbo_id", member.id)
      .maybeSingle();
    if (existing && liveAccess(existing as AccessRow).state === "active") {
      throw new Error("Ye feature aapke account par pehle se unlocked hai.");
    }
    const { error } = await (admin as any).from("growth_access").upsert(
      {
        fbo_id: member.id,
        status: "pending",
        amount: data.amount,
        method: data.method,
        sender_name: data.senderName,
        reference_no: data.referenceNo || null,
        proof_path: data.proofPath,
        requested_at: new Date().toISOString(),
        approved_at: null,
        expires_at: null,
        note: null,
      },
      { onConflict: "fbo_id" },
    );
    if (error) throw new Error(error.message);
    const { pushToAdmin } = await import("./push.server");
    await pushToAdmin({
      title: "Growth Executive request",
      body: `${member.full_name} (${member.member_id}) ne Growth Executive unlock ki payment bheji hai.`,
      tag: "admin-growth",
    });
    return { ok: true as const };
  });

type LeadRow = {
  id: string;
  assistant_id: string | null;
  status: string;
  created_at: string;
  assigned_at: string | null;
  enrolled_at: string | null;
  cc_done_at: string | null;
  enroll_verified_at: string | null;
  cc_verified_at: string | null;
};

function statsFor(rows: LeadRow[], cycle: ReturnType<typeof cycleOf>) {
  const worked = rows.filter((r) => inCycle(cycle, r.assigned_at ?? r.created_at));
  const enrolled = rows.filter((r) => inCycle(cycle, r.enrolled_at ?? r.enroll_verified_at)).length;
  const ccDone = rows.filter((r) => inCycle(cycle, r.cc_done_at ?? r.cc_verified_at)).length;
  return { leads: worked.length, enrolled, ccDone };
}

/** FBO view: every assistant's current-cycle performance and money. */
export const getGrowthOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, member } = await fboRow(context.userId);
    const settings = await readSettings();
    const cycle = cycleOf();
    const [{ data: assistants }, { data: leads }] = await Promise.all([
      (admin as any)
        .from("job_assistants")
        .select("id, full_name, role, status")
        .eq("fbo_id", member.id)
        .neq("status", "removed")
        .order("created_at"),
      (admin as any)
        .from("job_leads")
        .select(
          "id, assistant_id, status, created_at, assigned_at, enrolled_at, cc_done_at, enroll_verified_at, cc_verified_at",
        )
        .eq("fbo_id", member.id)
        .limit(20000),
    ]);
    const all = (leads ?? []) as LeadRow[];
    const rows = ((assistants ?? []) as any[]).map((a) => {
      const mine = all.filter((l) => l.assistant_id === a.id);
      const earn = cycleEarnings(statsFor(mine, cycle), settings);
      return {
        id: a.id as string,
        name: a.full_name as string,
        role: a.role as "calling" | "full_funnel",
        status: a.status as string,
        totalLeads: mine.length,
        ...earn,
      };
    });
    return {
      cycle,
      settings,
      rows,
      totals: {
        leads: rows.reduce((s, r) => s + r.leads, 0),
        enrolled: rows.reduce((s, r) => s + r.enrolled, 0),
        ccDone: rows.reduce((s, r) => s + r.ccDone, 0),
        amount: rows.reduce((s, r) => s + r.total, 0),
      },
      unassigned: all.filter((l) => !l.assistant_id).length,
    };
  });

/* ---------- Assistant portal ---------- */

/** One assistant's own earnings, opened with their private link. */
export const getAssistantEarnings = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) =>
    z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assistant } = await (supabaseAdmin as any)
      .from("job_assistants")
      .select("id, fbo_id, status")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!assistant || assistant.status === "removed") throw new Error("Ye link ab valid nahi hai.");
    const settings = await readSettings();
    const cycle = cycleOf();
    const { data: leads } = await (supabaseAdmin as any)
      .from("job_leads")
      .select(
        "id, assistant_id, status, created_at, assigned_at, enrolled_at, cc_done_at, enroll_verified_at, cc_verified_at",
      )
      .eq("assistant_id", assistant.id)
      .limit(20000);
    const mine = (leads ?? []) as LeadRow[];
    const { data: paidRows } = await (supabaseAdmin as any)
      .from("growth_commissions")
      .select("amount, status")
      .eq("assistant_id", assistant.id);
    const sum = (s: string) =>
      ((paidRows ?? []) as any[]).filter((r) => r.status === s).reduce((t, r) => t + Number(r.amount), 0);
    return {
      cycle,
      settings,
      earnings: cycleEarnings(statsFor(mine, cycle), settings),
      totalLeads: mine.length,
      ledger: { verified: sum("verified"), payable: sum("payable"), paid: sum("paid") },
    };
  });

/* ---------- Admin ---------- */

export const adminGetGrowth = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const settings = await readSettings();
  const { data } = await (supabaseAdmin as any)
    .from("growth_access")
    .select(
      "id, fbo_id, status, amount, method, sender_name, reference_no, proof_path, requested_at, approved_at, expires_at, note, fbo:fbo_id (full_name, member_id)",
    )
    .order("requested_at", { ascending: false })
    .limit(500);
  const rows = await Promise.all(
    ((data ?? []) as any[]).map(async (row) => ({
      ...row,
      proofUrl: row.proof_path
        ? (
            await supabaseAdmin.storage.from(PROOF_BUCKET).createSignedUrl(row.proof_path, 3600)
          ).data?.signedUrl ?? null
        : null,
    })),
  );
  return { settings, rows };
});

export const adminSaveGrowthSettings = createServerFn({ method: "POST" })
  .inputValidator((d: GrowthSettings) => settingsSchema.parse(d))
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
      .upsert({ key: SETTINGS_KEY, value: sorted, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDecideGrowthAccess = createServerFn({ method: "POST" })
  .inputValidator((d: { fboId: string; decision: "approve" | "reject"; note?: string | null }) =>
    z
      .object({
        fboId: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        note: z.string().trim().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settings = await readSettings();
    const expires =
      data.decision === "approve" && settings.unlockDays > 0
        ? new Date(Date.now() + settings.unlockDays * 86_400_000).toISOString()
        : null;
    const { error } = await (supabaseAdmin as any)
      .from("growth_access")
      .update({
        status: data.decision === "approve" ? "active" : "rejected",
        approved_at: data.decision === "approve" ? new Date().toISOString() : null,
        approved_by: "admin",
        expires_at: expires,
        note: data.note || null,
      })
      .eq("fbo_id", data.fboId);
    if (error) throw new Error(error.message);
    const { pushToMember } = await import("./push.server");
    await pushToMember({
      memberId: data.fboId,
      title: data.decision === "approve" ? "Growth Executive unlocked" : "Growth Executive request",
      body:
        data.decision === "approve"
          ? "Mubarak ho! Skyline Growth Executive aapke dashboard par unlock ho gaya hai."
          : `Aapki request confirm nahi ho saki. ${data.note ?? "Office se rabta karein."}`,
      tag: "growth-access",
    });
    return { ok: true as const };
  });

/** Admin: grant the feature without a payment claim (promo / manual). */
export const adminGrantGrowthAccess = createServerFn({ method: "POST" })
  .inputValidator((d: { memberCode: string }) =>
    z.object({ memberCode: z.string().trim().min(3).max(20) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await (supabaseAdmin as any)
      .from("member_profiles")
      .select("id")
      .eq("member_id", data.memberCode)
      .maybeSingle();
    if (!member) throw new Error("Ye member ID nahi mili.");
    const settings = await readSettings();
    const { error } = await (supabaseAdmin as any).from("growth_access").upsert(
      {
        fbo_id: member.id,
        status: "active",
        amount: 0,
        method: "manual",
        approved_at: new Date().toISOString(),
        approved_by: "admin",
        expires_at:
          settings.unlockDays > 0 ? new Date(Date.now() + settings.unlockDays * 86_400_000).toISOString() : null,
        note: "Admin granted",
      },
      { onConflict: "fbo_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
