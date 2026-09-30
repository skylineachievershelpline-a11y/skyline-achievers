import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ccRateForCount, cycleOf, enrollmentRateForCount } from "./growth-cycle";

const IMAGE_BUCKET = "payment-proofs";
const DEFAULT_PASSWORD = "00000000";
const roleSchema = z.enum(["calling", "full_funnel"]);

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const tail = digits.slice(-10);
  if (tail.length !== 10 || !tail.startsWith("3")) throw new Error("Enter a valid Pakistani mobile number.");
  return { phone: `92${tail}`, tail };
};
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeCnic = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 13) throw new Error("Enter a valid 13-digit CNIC.");
  return digits;
};

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function requireFbo(userId: string) {
  const admin = await adminClient();
  const { data } = await admin.from("member_profiles").select("id, member_id, full_name, status, levels:level_id(rank_order)").eq("id", userId).maybeSingle();
  if (!data || data.status !== "active" || Number(data.levels?.rank_order ?? 0) < 2) throw new Error("This feature is available to Assistant Supervisors and above.");
  const { data: access } = await admin.from("growth_access").select("status, expires_at").eq("fbo_id", userId).maybeSingle();
  if (!access || access.status !== "active" || (access.expires_at && new Date(access.expires_at).getTime() < Date.now())) throw new Error("Skyline Growth Executive access is not active.");
  return { admin, member: data };
}

async function requireExecutive(userId: string) {
  const admin = await adminClient();
  const { data } = await admin.from("job_assistants").select("id, fbo_id, executive_id, full_name, phone, email, role, status, daily_lead_limit, city, qualification, experience, payout_method, payout_account_title, payout_account_number, avatar_path, fbo:fbo_id(full_name,member_id)").eq("auth_user_id", userId).maybeSingle();
  if (!data) throw new Error("No Growth Executive account is linked to this login.");
  if (data.status !== "active") throw new Error(data.status === "paused" ? "Your account is paused. Contact your FBO." : "This account is no longer active.");
  return { admin, executive: data };
}

export const createExecutiveInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { label?: string }) => z.object({ label: z.string().trim().max(80).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { admin, member } = await requireFbo(context.userId);
    const { data: invite, error } = await admin.from("growth_executive_invites").insert({ fbo_id: member.id, label: data.label || null }).select("token").single();
    if (error || !invite) throw new Error(error?.message ?? "Application link could not be created.");
    return { token: invite.token as string };
  });

export const getExecutiveTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, member } = await requireFbo(context.userId);
    const [{ data: executives }, { data: applications }, { data: invites }] = await Promise.all([
      admin.from("job_assistants").select("id, executive_id, full_name, phone, email, role, status, daily_lead_limit, created_at").eq("fbo_id", member.id).neq("status", "removed").order("created_at", { ascending: false }),
      admin.from("growth_executive_applications").select("id, full_name, phone, email, requested_role, status, admin_note, created_at").eq("fbo_id", member.id).order("created_at", { ascending: false }),
      admin.from("growth_executive_invites").select("id, token, label, is_active, created_at").eq("fbo_id", member.id).order("created_at", { ascending: false }),
    ]);
    return { executives: executives ?? [], applications: applications ?? [], invites: invites ?? [] };
  });

export const getExecutiveApplication = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).parse(d))
  .handler(async ({ data }) => {
    const admin = await adminClient();
    const { data: invite } = await admin.from("growth_executive_invites").select("id, is_active, expires_at, fbo:fbo_id(full_name,member_id)").eq("token", data.token).maybeSingle();
    if (!invite || !invite.is_active || (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())) throw new Error("This application link is no longer active.");
    return { fboName: invite.fbo?.full_name ?? "Skyline FBO", fboId: invite.fbo?.member_id ?? "" };
  });

export const createExecutiveApplicationUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; kind: "cnic" | "avatar"; fileName: string }) => z.object({ token: z.string().regex(/^[a-f0-9]{48}$/), kind: z.enum(["cnic", "avatar"]), fileName: z.string().trim().min(1).max(250) }).parse(d))
  .handler(async ({ data }) => {
    const admin = await adminClient();
    const { data: invite } = await admin.from("growth_executive_invites").select("id, is_active").eq("token", data.token).maybeSingle();
    if (!invite?.is_active) throw new Error("This application link is no longer active.");
    const ext = data.fileName.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() ?? "jpg";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) throw new Error("Upload a JPG, PNG, or WebP image.");
    const path = `growth-applications/${invite.id}/${data.kind}-${crypto.randomUUID()}.${ext}`;
    const { data: signed, error } = await admin.storage.from(IMAGE_BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Image upload could not be prepared.");
    return { path: signed.path, signedUrl: signed.signedUrl };
  });

const applicationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{48}$/), fullName: z.string().trim().min(3).max(100), phone: z.string().trim().min(10).max(25), email: z.string().trim().email().max(150), cnic: z.string().trim().min(13).max(20), cnicFrontPath: z.string().min(10).max(400), avatarPath: z.string().min(10).max(400), experience: z.string().trim().min(2).max(1000), qualification: z.string().trim().min(2).max(200), city: z.string().trim().min(2).max(100), requestedRole: roleSchema, payoutMethod: z.string().trim().min(2).max(80), payoutAccountTitle: z.string().trim().min(2).max(100), payoutAccountNumber: z.string().trim().min(5).max(80),
});

export const submitExecutiveApplication = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof applicationSchema>) => applicationSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await adminClient();
    const { data: invite } = await admin.from("growth_executive_invites").select("id, fbo_id, is_active").eq("token", data.token).maybeSingle();
    if (!invite?.is_active) throw new Error("This application link is no longer active.");
    if (!data.cnicFrontPath.startsWith(`growth-applications/${invite.id}/`) || !data.avatarPath.startsWith(`growth-applications/${invite.id}/`)) throw new Error("Uploaded images do not belong to this application.");
    const phone = normalizePhone(data.phone); const email = normalizeEmail(data.email); const cnic = normalizeCnic(data.cnic);
    const { assertPhoneEmailFree } = await import("./identity-unique.server");
    await assertPhoneEmailFree({ phone: phone.phone, email });
    const { error } = await admin.from("growth_executive_applications").insert({ invite_id: invite.id, fbo_id: invite.fbo_id, full_name: data.fullName, phone: phone.phone, phone_tail: phone.tail, email, email_normalized: email, cnic: data.cnic, cnic_normalized: cnic, cnic_front_path: data.cnicFrontPath, avatar_path: data.avatarPath, experience: data.experience, qualification: data.qualification, city: data.city, requested_role: data.requestedRole, payout_method: data.payoutMethod, payout_account_title: data.payoutAccountTitle, payout_account_number: data.payoutAccountNumber });
    if (error) throw new Error(error.code === "23505" ? "This phone, email, or CNIC already has an active application." : error.message);
    const { pushToAdmin } = await import("./push.server");
    await pushToAdmin({ title: "Growth Executive application", body: `${data.fullName} submitted a new application.`, tag: "growth-application" });
    return { ok: true as const };
  });

export const adminGetExecutiveOperations = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server"); await requireAdmin();
  const admin = await adminClient();
  const [{ data: applications }, { data: executives }, { data: verification }, { data: withdrawals }, { data: settlements }] = await Promise.all([
    admin.from("growth_executive_applications").select("*, fbo:fbo_id(full_name,member_id)").order("created_at", { ascending: false }).limit(500),
    admin.from("job_assistants").select("id,executive_id,full_name,phone,email,role,status,created_at,fbo:fbo_id(full_name,member_id)").order("created_at", { ascending: false }).limit(500),
    admin.from("growth_verification_events").select("id,kind,status,reported_at,note,lead:lead_id(full_name,phone,batch_id),assistant:assistant_id(full_name,executive_id),fbo:fbo_id(full_name,member_id)").in("status", ["reported","data_check"]).order("created_at").limit(500),
    admin.from("growth_withdrawals").select("*,assistant:assistant_id(full_name,executive_id),fbo:fbo_id(full_name,member_id)").order("requested_at", { ascending: false }).limit(500),
    admin.from("growth_settlements").select("*,fbo:fbo_id(full_name,member_id)").order("created_at", { ascending: false }).limit(500),
  ]);
  const signed = await Promise.all((applications ?? []).map(async (row: any) => ({ ...row, cnicUrl: row.cnic_front_path ? (await admin.storage.from(IMAGE_BUCKET).createSignedUrl(row.cnic_front_path, 3600)).data?.signedUrl ?? null : null, avatarUrl: row.avatar_path ? (await admin.storage.from(IMAGE_BUCKET).createSignedUrl(row.avatar_path, 3600)).data?.signedUrl ?? null : null })));
  const signedSettlements = await Promise.all((settlements ?? []).map(async (row: any) => ({ ...row, proofUrl: row.proof_path ? (await admin.storage.from(IMAGE_BUCKET).createSignedUrl(row.proof_path, 3600)).data?.signedUrl ?? null : null })));
  return { applications: signed, executives: executives ?? [], verification: verification ?? [], withdrawals: withdrawals ?? [], settlements: signedSettlements };
});

export const adminDecideExecutiveApplication = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; decision: "approve" | "reject" | "changes_requested"; note?: string }) => z.object({ id: z.string().uuid(), decision: z.enum(["approve","reject","changes_requested"]), note: z.string().trim().max(500).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server"); await requireAdmin();
    const admin = await adminClient();
    const { data: app } = await admin.from("growth_executive_applications").select("*").eq("id", data.id).maybeSingle();
    if (!app || app.status === "approved") throw new Error("This application is not available for review.");
    if (data.decision !== "approve") {
      await admin.from("growth_executive_applications").update({ status: data.decision, admin_note: data.note || null, reviewed_at: new Date().toISOString(), reviewed_by: "admin" }).eq("id", app.id);
      return { ok: true as const, executiveId: null, password: null };
    }
    const { data: settingRow } = await admin.from("platform_settings").select("value").eq("key", "growth_executive_settings").maybeSingle();
    const maxExecutives = Math.max(1, Number(settingRow?.value?.maxExecutivesPerFbo ?? 10));
    const { count: executiveCount } = await admin.from("job_assistants").select("id", { count: "exact", head: true }).eq("fbo_id", app.fbo_id).neq("status", "removed");
    if (Number(executiveCount ?? 0) >= maxExecutives) throw new Error(`This FBO already has the maximum ${maxExecutives} Growth Executives.`);
    const { data: executiveId, error: idError } = await admin.rpc("generate_growth_executive_id");
    if (idError || !executiveId) throw new Error("Executive ID could not be generated.");
    const { executiveIdToAuthEmail } = await import("./brand");
    const { data: auth, error: authError } = await admin.auth.admin.createUser({ email: executiveIdToAuthEmail(executiveId), password: DEFAULT_PASSWORD, email_confirm: true, user_metadata: { executive_id: executiveId, full_name: app.full_name, account_kind: "growth_executive" } });
    if (authError || !auth.user) throw new Error(authError?.message ?? "Executive login could not be created.");
    const { data: executive, error } = await admin.from("job_assistants").insert({ fbo_id: app.fbo_id, auth_user_id: auth.user.id, executive_id: executiveId, full_name: app.full_name, phone: app.phone, email: app.email, role: app.requested_role, status: "active", daily_lead_limit: Math.max(10, Number(settingRow?.value?.dailyLeadTarget ?? 10)), cnic: app.cnic, cnic_front_path: app.cnic_front_path, avatar_path: app.avatar_path, experience: app.experience, qualification: app.qualification, city: app.city, payout_method: app.payout_method, payout_account_title: app.payout_account_title, payout_account_number: app.payout_account_number, approved_at: new Date().toISOString(), approved_by: "admin" }).select("id").single();
    if (error || !executive) { await admin.auth.admin.deleteUser(auth.user.id); throw new Error(error?.message ?? "Executive profile could not be created."); }
    await admin.from("growth_executive_applications").update({ status: "approved", assistant_id: executive.id, reviewed_at: new Date().toISOString(), reviewed_by: "admin", admin_note: data.note || null }).eq("id", app.id);
    return { ok: true as const, executiveId: executiveId as string, password: DEFAULT_PASSWORD };
  });

export const resolveExecutiveLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { identifier: string }) => z.object({ identifier: z.string().trim().min(7).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const admin = await adminClient(); const digits = data.identifier.replace(/\D/g, "");
    let query = admin.from("job_assistants").select("executive_id,status");
    query = /^22\d{10}$/.test(digits) ? query.eq("executive_id", digits) : query.eq("phone", normalizePhone(digits).phone);
    const { data: row } = await query.maybeSingle();
    if (!row || row.status !== "active" || !row.executive_id) throw new Error("Executive ID or mobile number is not recognised.");
    const { executiveIdToAuthEmail } = await import("./brand"); return { email: executiveIdToAuthEmail(row.executive_id) };
  });

export const getExecutiveDashboard = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { admin, executive } = await requireExecutive(context.userId);
  const [{ data: leads }, { data: ledger }, { data: withdrawals }] = await Promise.all([
    admin.from("job_leads").select("id,full_name,phone,city,age,qualification,status,follow_up_at,last_called_at,call_count,notes,batch_id,batch_position,enrollment_verification_status,cc_verification_status,created_at").eq("assistant_id", executive.id).order("created_at").limit(3000),
    admin.from("growth_commissions").select("id,kind,amount,status,created_at,note").eq("assistant_id", executive.id).order("created_at", { ascending: false }).limit(1000),
    admin.from("growth_withdrawals").select("id,amount,status,requested_at,payment_reference").eq("assistant_id", executive.id).order("requested_at", { ascending: false }).limit(100),
  ]);
  const sums = { pending: 0, verified: 0, payable: 0, paid: 0 } as Record<string, number>;
  for (const row of ledger ?? []) sums[row.status] = (sums[row.status] ?? 0) + Number(row.amount);
  const withdrawn = (withdrawals ?? []).filter((r: any) => r.status === "paid").reduce((n: number, r: any) => n + Number(r.amount), 0);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
  const todayCalls = (leads ?? []).filter((r: any) => r.last_called_at && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date(r.last_called_at)) === today).length;
  let avatarUrl: string | null = null; if (executive.avatar_path) avatarUrl = (await admin.storage.from(IMAGE_BUCKET).createSignedUrl(executive.avatar_path, 3600)).data?.signedUrl ?? null;
  return { executive: { ...executive, avatarUrl }, leads: leads ?? [], ledger: ledger ?? [], withdrawals: withdrawals ?? [], summary: { pending: sums["pending"] ?? 0, verified: sums["verified"] ?? 0, payable: sums["payable"] ?? 0, paid: sums["paid"] ?? 0, withdrawn, available: Math.max(0, (sums["payable"] ?? 0) - withdrawn), todayCalls } };
});

const outcomes = z.enum(["contacted","follow_up","not_interested","invalid","enrolled","cc_done","no_answer"]);
export const executiveLogLead = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { leadId: string; outcome: z.infer<typeof outcomes>; note?: string; followUpAt?: string | null }) => z.object({ leadId: z.string().uuid(), outcome: outcomes, note: z.string().trim().max(500).optional(), followUpAt: z.string().datetime().nullable().optional() }).parse(d)).handler(async ({ data, context }) => {
  const { admin, executive } = await requireExecutive(context.userId);
  if (data.outcome === "cc_done" && executive.role !== "full_funnel") throw new Error("Only Full Funnel Executives can report 2CC completion.");
  const { data: lead } = await admin.from("job_leads").select("id,call_count,notes,attribution_assistant_id").eq("id", data.leadId).eq("assistant_id", executive.id).maybeSingle();
  if (!lead) throw new Error("This lead is not assigned to you.");
  const now = new Date().toISOString(); const status = data.outcome === "no_answer" ? "follow_up" : data.outcome;
  const patch: Record<string, unknown> = { status, last_called_at: now, call_count: Number(lead.call_count ?? 0) + 1, follow_up_at: status === "follow_up" ? data.followUpAt ?? null : null, ...(data.note ? { notes: data.note } : {}) };
  if (status === "enrolled") Object.assign(patch, { enrolled_at: now, enrollment_reported_at: now, enrollment_verification_status: "reported" });
  if (status === "cc_done") Object.assign(patch, { cc_done_at: now, cc_reported_at: now, cc_verification_status: "reported" });
  await admin.from("job_leads").update(patch).eq("id", lead.id);
  await admin.from("job_lead_activities").insert({ lead_id: lead.id, assistant_id: executive.id, fbo_id: executive.fbo_id, outcome: data.outcome, note: data.note || null, actor_type: "executive" });
  if (status === "enrolled" || status === "cc_done") await admin.from("growth_verification_events").upsert({ fbo_id: executive.fbo_id, assistant_id: lead.attribution_assistant_id ?? executive.id, lead_id: lead.id, kind: status === "enrolled" ? "enrollment" : "two_cc", status: "reported", reported_at: now }, { onConflict: "lead_id,kind" });
  return { ok: true as const };
});

export const requestExecutiveWithdrawal = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { amount: number }) => z.object({ amount: z.number().min(100).max(1_000_000) }).parse(d)).handler(async ({ data, context }) => {
  const { admin, executive } = await requireExecutive(context.userId);
  const [{ data: ledger }, { data: prior }] = await Promise.all([admin.from("growth_commissions").select("amount").eq("assistant_id", executive.id).eq("status", "payable"), admin.from("growth_withdrawals").select("amount,status").eq("assistant_id", executive.id).in("status", ["requested","approved","paid"])]);
  const available = (ledger ?? []).reduce((n: number, r: any) => n + Number(r.amount), 0) - (prior ?? []).reduce((n: number, r: any) => n + Number(r.amount), 0);
  if (data.amount > available) throw new Error(`Available balance is Rs. ${Math.max(0, available).toLocaleString("en-PK")}.`);
  const { error } = await admin.from("growth_withdrawals").insert({ assistant_id: executive.id, fbo_id: executive.fbo_id, amount: data.amount, payout_method: executive.payout_method, payout_account_title: executive.payout_account_title, payout_account_number: executive.payout_account_number });
  if (error) throw new Error(error.message); return { ok: true as const };
});

export const getFboGrowthFunding = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { admin, member } = await requireFbo(context.userId);
  const [{ data: commissions }, { data: settlements }, { data: settingRow }, { data: methods }] = await Promise.all([
    admin.from("growth_commissions").select("id,kind,amount,status,service_fee,created_at").eq("fbo_id", member.id).eq("status", "verified").is("settlement_id", null),
    admin.from("growth_settlements").select("id,kind,commission_amount,service_fee,total_due,status,due_at,created_at").eq("fbo_id", member.id).order("created_at", { ascending: false }).limit(30),
    admin.from("platform_settings").select("value").eq("key", "growth_executive_settings").maybeSingle(),
    admin.from("course_payment_methods").select("id,label,account_name,account_number,instructions,qr_url").eq("is_active", true).order("sort_order"),
  ]);
  const settings = settingRow?.value ?? {}; const rows = commissions ?? [];
  const summary = (["enrollment", "two_cc"] as const).map((kind) => { const matched = rows.filter((r: any) => r.kind === kind); const commission = matched.reduce((n: number, r: any) => n + Number(r.amount), 0); const feeEach = kind === "enrollment" ? Number(settings.enrollmentServiceFee ?? 10) : Number(settings.ccServiceFee ?? 500); return { kind, count: matched.length, commission, serviceFee: matched.length * feeEach, total: commission + matched.length * feeEach }; });
  return { summary, settlements: settlements ?? [], methods: methods ?? [] };
});

export const createGrowthSettlementUploadUrl = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { fileName: string }) => z.object({ fileName: z.string().trim().min(1).max(250) }).parse(d)).handler(async ({ data, context }) => {
  const { admin, member } = await requireFbo(context.userId); const ext = data.fileName.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() ?? "jpg"; if (!["jpg","jpeg","png","webp"].includes(ext)) throw new Error("Upload a JPG, PNG, or WebP image."); const path = `${member.id}/growth-settlement-${crypto.randomUUID()}.${ext}`; const { data: signed, error } = await admin.storage.from(IMAGE_BUCKET).createSignedUploadUrl(path); if (error || !signed) throw new Error("Payment proof upload could not be prepared."); return { path: signed.path, signedUrl: signed.signedUrl };
});

export const submitGrowthSettlement = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { kind: "enrollment" | "two_cc"; method: string; senderName: string; referenceNo?: string; proofPath: string }) => z.object({ kind: z.enum(["enrollment","two_cc"]), method: z.string().trim().min(1).max(80), senderName: z.string().trim().min(2).max(100), referenceNo: z.string().trim().max(100).optional(), proofPath: z.string().trim().min(5).max(400) }).parse(d)).handler(async ({ data, context }) => {
  const { admin, member } = await requireFbo(context.userId); if (!data.proofPath.startsWith(`${member.id}/`)) throw new Error("This proof does not belong to your account."); const { data: commissions } = await admin.from("growth_commissions").select("id,amount").eq("fbo_id", member.id).eq("kind", data.kind).eq("status", "verified").is("settlement_id", null); if (!commissions?.length) throw new Error("There is no verified unfunded commission in this category."); const { data: settingRow } = await admin.from("platform_settings").select("value").eq("key", "growth_executive_settings").maybeSingle(); const feeEach = data.kind === "enrollment" ? Number(settingRow?.value?.enrollmentServiceFee ?? 10) : Number(settingRow?.value?.ccServiceFee ?? 500); const commission = commissions.reduce((n: number, row: any) => n + Number(row.amount), 0); const now = new Date(); let due: Date; if (data.kind === "enrollment") due = now.getDate() <= 15 ? new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59) : new Date(now.getFullYear(), now.getMonth() + 1, 1, 23, 59, 59); else due = now.getDate() <= 10 ? new Date(now.getFullYear(), now.getMonth(), Math.max(5, now.getDate()), 23, 59, 59) : new Date(now.getFullYear(), now.getMonth() + 1, 5, 23, 59, 59); const start = cycleOf(now).start; const end = cycleOf(now).end; const { data: settlement, error } = await admin.from("growth_settlements").insert({ fbo_id: member.id, kind: data.kind, period_start: start, period_end: end, commission_amount: commission, service_fee: commissions.length * feeEach, total_due: commission + commissions.length * feeEach, status: "submitted", due_at: due.toISOString(), method: data.method, sender_name: data.senderName, reference_no: data.referenceNo || null, proof_path: data.proofPath, submitted_at: now.toISOString() }).select("id").single(); if (error || !settlement) throw new Error(error?.message ?? "Settlement could not be submitted."); await admin.from("growth_commissions").update({ settlement_id: settlement.id }).in("id", commissions.map((row: any) => row.id)); return { ok: true as const };
});

export const adminDecideVerification = createServerFn({ method: "POST" }).inputValidator((d: { id: string; decision: "verify" | "reject"; note?: string }) => z.object({ id: z.string().uuid(), decision: z.enum(["verify","reject"]), note: z.string().trim().max(500).optional() }).parse(d)).handler(async ({ data }) => {
  const { requireAdmin } = await import("./admin-session.server"); await requireAdmin(); const admin = await adminClient();
  const { data: event } = await admin.from("growth_verification_events").select("*,lead:lead_id(batch_id)").eq("id", data.id).maybeSingle(); if (!event || !["reported","data_check"].includes(event.status)) throw new Error("This result has already been reviewed.");
  if (data.decision === "reject") { await admin.from("growth_verification_events").update({ status: "rejected", checked_at: new Date().toISOString(), verified_by: "admin", note: data.note || null }).eq("id", event.id); await admin.from("job_leads").update(event.kind === "enrollment" ? { enrollment_verification_status: "rejected" } : { cc_verification_status: "rejected" }).eq("id", event.lead_id); return { ok: true as const }; }
  const now = new Date(); const cycle = cycleOf(new Date(event.reported_at)); let amount = 0; let rate = 0;
  if (event.kind === "enrollment") { const { data: batchLeads } = await admin.from("job_leads").select("id").eq("batch_id", event.lead?.batch_id); const ids = (batchLeads ?? []).map((row: any) => row.id); const { count } = ids.length ? await admin.from("growth_verification_events").select("id", { count: "exact", head: true }).eq("assistant_id", event.assistant_id).eq("kind", "enrollment").eq("status", "ledgered").in("lead_id", ids) : { count: 0 }; const n = Number(count ?? 0) + 1; rate = enrollmentRateForCount(n); amount = n * rate - (n - 1) * enrollmentRateForCount(n - 1); }
  else { const { count } = await admin.from("growth_verification_events").select("id", { count: "exact", head: true }).eq("assistant_id", event.assistant_id).eq("kind", "two_cc").eq("status", "ledgered").gte("reported_at", `${cycle.start}T00:00:00+05:00`).lte("reported_at", `${cycle.end}T23:59:59+05:00`); const n = Number(count ?? 0) + 1; rate = ccRateForCount(n); amount = n * rate - (n - 1) * ccRateForCount(n - 1); }
  const { error } = await admin.from("growth_commissions").insert({ fbo_id: event.fbo_id, assistant_id: event.assistant_id, lead_id: event.lead_id, verification_event_id: event.id, batch_id: event.lead?.batch_id ?? null, kind: event.kind, cycle_start: cycle.start, cycle_end: cycle.end, units: 1, rate, amount, status: "verified", verified_at: now.toISOString(), note: data.note || null }); if (error) throw new Error(error.message);
  await admin.from("growth_verification_events").update({ status: "ledgered", checked_at: now.toISOString(), verified_at: now.toISOString(), verified_by: "admin", note: data.note || null }).eq("id", event.id); await admin.from("job_leads").update(event.kind === "enrollment" ? { enrollment_verification_status: "verified", enroll_verified_at: now.toISOString() } : { cc_verification_status: "verified", cc_verified_at: now.toISOString() }).eq("id", event.lead_id); return { ok: true as const };
});

export const adminDecideWithdrawal = createServerFn({ method: "POST" }).inputValidator((d: { id: string; decision: "approve" | "reject" | "paid"; reference?: string }) => z.object({ id: z.string().uuid(), decision: z.enum(["approve","reject","paid"]), reference: z.string().trim().max(100).optional() }).parse(d)).handler(async ({ data }) => { const { requireAdmin } = await import("./admin-session.server"); await requireAdmin(); const admin = await adminClient(); const patch = data.decision === "paid" ? { status: "paid", paid_at: new Date().toISOString(), payment_reference: data.reference || null } : data.decision === "approve" ? { status: "approved", approved_at: new Date().toISOString() } : { status: "rejected" }; const { error } = await admin.from("growth_withdrawals").update(patch).eq("id", data.id); if (error) throw new Error(error.message); return { ok: true as const }; });

export const adminDecideSettlement = createServerFn({ method: "POST" }).inputValidator((d: { id: string; decision: "approve" | "reject"; note?: string }) => z.object({ id: z.string().uuid(), decision: z.enum(["approve","reject"]), note: z.string().trim().max(500).optional() }).parse(d)).handler(async ({ data }) => { const { requireAdmin } = await import("./admin-session.server"); await requireAdmin(); const admin = await adminClient(); const { data: settlement } = await admin.from("growth_settlements").select("id,status").eq("id", data.id).maybeSingle(); if (!settlement || settlement.status !== "submitted") throw new Error("This settlement is not waiting for review."); const now = new Date().toISOString(); await admin.from("growth_settlements").update({ status: data.decision === "approve" ? "approved" : "rejected", admin_note: data.note || null, approved_at: data.decision === "approve" ? now : null, approved_by: "admin" }).eq("id", settlement.id); if (data.decision === "approve") await admin.from("growth_commissions").update({ status: "payable", payable_at: now }).eq("settlement_id", settlement.id).eq("status", "verified"); else await admin.from("growth_commissions").update({ settlement_id: null }).eq("settlement_id", settlement.id).eq("status", "verified"); return { ok: true as const }; });