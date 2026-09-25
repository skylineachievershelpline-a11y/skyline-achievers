import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const uuid = z.string().uuid();

/** Every pending or recent payment claim, with the screenshot to inspect. */
export const adminGetPaymentSubmissions = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { signMemberPaymentProof, signProof } = await import("./journey.server");
  const { data } = await (supabaseAdmin as any)
    .from("payment_submissions")
    .select(
      "id, payer_id, payer_kind, payer_name, payer_code, purpose, method, claimed_amount_pkr, verified_amount_pkr, proof_path, phone, email, note, admin_note, status, created_at, verified_at, upline:upline_id (full_name, member_id)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = [];
  for (const row of ((data ?? []) as any[])) {
    rows.push({
      id: row.id as string,
      payerId: row.payer_id as string,
      payerKind: row.payer_kind as string,
      payerName: row.payer_name as string,
      payerCode: (row.payer_code ?? null) as string | null,
      purpose: row.purpose as string,
      method: (row.method ?? null) as string | null,
      claimed: Number(row.claimed_amount_pkr ?? 0),
      verified: Number(row.verified_amount_pkr ?? 0),
      proofUrl:
        row.payer_kind === "member"
          ? await signMemberPaymentProof(row.proof_path)
          : await signProof(row.proof_path),
      phone: (row.phone ?? null) as string | null,
      email: (row.email ?? null) as string | null,
      note: (row.note ?? null) as string | null,
      adminNote: (row.admin_note ?? null) as string | null,
      status: row.status as string,
      createdAt: row.created_at as string,
      verifiedAt: (row.verified_at ?? null) as string | null,
      uplineName: (row.upline?.full_name ?? null) as string | null,
      uplineCode: (row.upline?.member_id ?? null) as string | null,
    });
  }
  return { rows };
});

/**
 * The admin types the amount actually received. A screenshot alone never moves
 * money: only this verified figure reaches the wallet.
 */
export const adminVerifyPayment = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: string;
      decision: "verified" | "rejected";
      verifiedAmount?: number;
      adminNote?: string | null;
    }) =>
      z
        .object({
          id: uuid,
          decision: z.enum(["verified", "rejected"]),
          verifiedAmount: z.number().min(0).max(100_000_000).optional(),
          adminNote: z.string().trim().max(1000).nullish(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: row } = await admin
      .from("payment_submissions")
      .select("id, payer_id, purpose, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("That payment claim no longer exists.");

    const verifiedAmount = data.decision === "verified" ? (data.verifiedAmount ?? 0) : 0;
    if (data.decision === "verified" && verifiedAmount <= 0) {
      throw new Error("Enter the verified amount received before approving.");
    }

    const { error } = await admin
      .from("payment_submissions")
      .update({
        status: data.decision,
        verified_amount_pkr: verifiedAmount,
        admin_note: data.adminNote ?? null,
        verified_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { loadLedger, loadPolicy, ensureJourney } = await import("./journey.server");
    const [ledger, policy] = await Promise.all([loadLedger(row.payer_id), loadPolicy()]);

    // Trainee wallets: start the completion countdown on the first verified amount.
    await ensureJourney(row.payer_id);
    const { data: journey } = await admin
      .from("trainee_journey")
      .select("mentorship_due_at")
      .eq("trainee_id", row.payer_id)
      .maybeSingle();
    if (row.purpose === "mentorship" && ledger.mentorshipPaid > 0 && !journey?.mentorship_due_at) {
      await admin
        .from("trainee_journey")
        .update({
          mentorship_due_at: new Date(
            Date.now() + policy.mentorshipDays * 24 * 60 * 60 * 1000,
          ).toISOString(),
          stage: "mentorship",
        })
        .eq("trainee_id", row.payer_id);
    }

    // First verified Personal Mentorship payment from a trainee: the account is
    // created automatically and the trainee dashboard hands over to it.
    if (data.decision === "verified" && row.purpose === "mentorship") {
      const { data: traineeRow } = await admin
        .from("trainees")
        .select("id")
        .eq("id", row.payer_id)
        .maybeSingle();
      if (traineeRow) {
        const { data: claim } = await admin
          .from("payment_submissions")
          .select("email")
          .eq("id", data.id)
          .maybeSingle();
        await graduateTrainee(traineeRow.id, (claim?.email ?? null) as string | null);
      }
    }

    // Members keep their own ledger columns in step with the verified totals.
    const { data: memberRow } = await admin
      .from("member_profiles")
      .select("id, mentorship_fee_pkr")
      .eq("id", row.payer_id)
      .maybeSingle();
    if (memberRow) {
      await admin
        .from("member_profiles")
        .update({ mentorship_paid_pkr: ledger.mentorshipPaid })
        .eq("id", memberRow.id);
    }

    return {
      ok: true as const,
      mentorshipPaid: ledger.mentorshipPaid,
      ccPaid: ledger.ccPaid,
      mentorshipRequired: policy.mentorshipFeePkr,
    };
  });

/**
 * Turns an approved Personal Mentorship trainee into a real member account.
 * Uses the normal account creation path, so the ID and default password rules
 * stay exactly the same.
 */
export const adminCreateMentorshipAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { traineeId: string }) => z.object({ traineeId: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const result = await graduateTrainee(data.traineeId, null);
    if (result.alreadyCode) {
      throw new Error(`This person already has the account ${result.alreadyCode}.`);
    }
    return result.credentials!;
  });

/**
 * Turns an approved Personal Mentorship trainee into a real member account
 * with the default password. Safe to call twice — the second call is a no-op.
 */
async function graduateTrainee(traineeId: string, email: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;

  const { data: trainee } = await admin
    .from("trainees")
    .select("id, full_name, phone, age, upline_id")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee) throw new Error("That trainee no longer exists.");

  const { data: existing } = await admin
    .from("trainee_journey")
    .select("mentorship_account_code")
    .eq("trainee_id", trainee.id)
    .maybeSingle();
  if (existing?.mentorship_account_code) {
    return { alreadyCode: existing.mentorship_account_code as string, credentials: null };
  }

  const { data: level } = await admin
    .from("levels")
    .select("id")
    .eq("slug", "personal-mentorship")
    .maybeSingle();
  if (!level) throw new Error("The Personal Mentorship level is missing.");

  const { ensureOfficialMember, adminCreateMember } = await import("./admin.server");
  const uplineId = trainee.upline_id ?? (await ensureOfficialMember());
  const { loadLedger, loadPolicy, ensureJourney } = await import("./journey.server");
  const [ledger, policy] = await Promise.all([loadLedger(trainee.id), loadPolicy()]);

  const credentials = await adminCreateMember({
    fullName: trainee.full_name,
    age: trainee.age ?? null,
    cnic: null,
    email,
    phone: trainee.phone ?? null,
    levelId: level.id as string,
    uplineId: typeof uplineId === "string" ? uplineId : (uplineId as any)?.id,
    status: "active",
    workingEnabled: true,
    feePkr: policy.mentorshipFeePkr,
    paidPkr: ledger.mentorshipPaid,
    password: "00000000",
  });

  await ensureJourney(trainee.id);
  await admin
    .from("trainee_journey")
    .update({
      mentorship_account_id: credentials.accountId,
      mentorship_account_code: credentials.memberId,
      stage: "mentorship",
    })
    .eq("trainee_id", trainee.id);

  try {
    const { pushToUsers } = await import("./push.server");
    await pushToUsers([trainee.id], {
      title: "🎉 Aap ka Personal Mentorship account tayyar hai",
      body: `Aap ki ID ${credentials.memberId} hai. Password 00000000 — ID ya mobile number se login karein.`,
      path: "/beginners",
      tag: `graduated-${trainee.id}`,
    });
  } catch {
    // push is best-effort
  }

  return { alreadyCode: null, credentials };
}

/** 2CC target reached: the rank moves up automatically. */
export const adminSyncRankUpgrade = createServerFn({ method: "POST" })
  .inputValidator((data: { memberId: string }) => z.object({ memberId: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { loadLedger, loadPolicy } = await import("./journey.server");

    const [{ data: member }, ledger, policy] = await Promise.all([
      admin
        .from("member_profiles")
        .select("id, mentorship_fee_pkr, mentorship_paid_pkr, level_id")
        .eq("id", data.memberId)
        .maybeSingle(),
      loadLedger(data.memberId),
      loadPolicy(),
    ]);
    if (!member) throw new Error("That member no longer exists.");

    const fullPayment = Number(member.mentorship_paid_pkr ?? 0) >= Number(member.mentorship_fee_pkr ?? policy.mentorshipFeePkr);
    const target = fullPayment ? policy.ccTargetFullPayment : policy.ccTargetPartial;
    if (ledger.ccPaid < target) {
      return { upgraded: false as const, target, ccPaid: ledger.ccPaid };
    }

    const { data: nextLevel } = await admin
      .from("levels")
      .select("id, name")
      .eq("slug", "assistant-supervisor")
      .maybeSingle();
    if (!nextLevel) return { upgraded: false as const, target, ccPaid: ledger.ccPaid };

    await admin
      .from("member_profiles")
      .update({
        level_id: nextLevel.id,
        level_since: new Date().toISOString(),
        training_locked: false,
      })
      .eq("id", member.id);
    return { upgraded: true as const, target, ccPaid: ledger.ccPaid, levelName: nextLevel.name };
  });

/** Policy numbers the admin can change — never hard-coded in the app. */
export const adminGetJourneyPolicy = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { loadPolicy } = await import("./journey.server");
  return { policy: await loadPolicy() };
});

export const adminSaveJourneyPolicy = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      mentorshipFeePkr: number;
      mentorshipDays: number;
      ccTargetFullPayment: number;
      ccTargetPartial: number;
      mentorshipSeats: number;
      paymentMethods?: {
        name: string;
        accountTitle: string;
        accountNumber: string;
        instructions: string;
        qrUrl: string;
      }[];
    }) =>
      z
        .object({
          mentorshipFeePkr: z.number().min(0).max(100_000_000),
          mentorshipDays: z.number().int().min(1).max(365),
          ccTargetFullPayment: z.number().min(0).max(100_000_000),
          ccTargetPartial: z.number().min(0).max(100_000_000),
          mentorshipSeats: z.number().int().min(0).max(1000),
          paymentMethods: z
            .array(
              z.object({
                name: z.string().trim().min(1).max(60),
                accountTitle: z.string().trim().max(120),
                accountNumber: z.string().trim().max(120),
                instructions: z.string().trim().max(600),
                qrUrl: z.string().trim().max(500),
              }),
            )
            .max(12)
            .optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("platform_settings").upsert({
      key: "journey_policy",
      value: data,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
