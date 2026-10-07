/**
 * Member-side Personal Mentorship / 2CC payments.
 *
 * One source of truth: the verified rows in payment_submissions. A screenshot is
 * evidence only — it never changes the verified total. The office enters the
 * amount actually received from the admin Journey & Payments tab.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROOF_BUCKET = "payment-proofs";

async function activeMemberRow(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("member_profiles")
    .select(
      "id, member_id, full_name, status, phone, email, age, upline_id, mentorship_due_at, mentorship_completed_at, mentorship_fee_pkr, mentorship_paid_pkr",
    )
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") throw new Error("Your membership is not active.");
  return data as any;
}

/** Everything the payment section on the dashboard needs. */
export const getMyPaymentCentre = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const member = await activeMemberRow(context.userId);
    const { loadLedger, loadPolicy, signMemberPaymentProof } = await import("./journey.server");
    const [policy, ledger] = await Promise.all([loadPolicy(), loadLedger(member.id)]);

    // The office recorded some older payments straight on the member record, so
    // the verified figure is the higher of the ledger and that recorded amount —
    // the same number the dashboard summary shows.
    const required = Number(member.mentorship_fee_pkr) || policy.mentorshipFeePkr;
    const verified = Math.max(ledger.mentorshipPaid, Number(member.mentorship_paid_pkr) || 0);
    const remaining = Math.max(0, required - verified);
    const complete = remaining === 0 && required > 0;
    const { computeCcMoney } = await import("./journey");
    const paidInTime =
      !member.mentorship_due_at ||
      (member.mentorship_completed_at
        ? new Date(member.mentorship_completed_at).getTime() <=
          new Date(member.mentorship_due_at).getTime()
        : Date.now() <= new Date(member.mentorship_due_at).getTime());
    const lastVerify =
      ledger.rows.find((row) => row.purpose === "mentorship" && row.status === "verified")
        ?.verifiedAt ?? null;
    const ccMoney = computeCcMoney({
      policy,
      mentorshipVerified: verified,
      ccPaid: ledger.ccPaid,
      paidInTime,
      completedAt: member.mentorship_completed_at ?? lastVerify,
    });

    const history = [] as {
      id: string;
      purpose: string;
      claimed: number;
      verified: number;
      status: string;
      method: string | null;
      adminNote: string | null;
      createdAt: string;
      verifiedAt: string | null;
      proofUrl: string | null;
    }[];
    for (const row of ledger.rows) {
      history.push({
        id: row.id,
        purpose: row.purpose,
        claimed: row.claimed,
        verified: row.verified,
        status: row.status,
        method: (row as any).method ?? null,
        adminNote: row.adminNote,
        createdAt: row.createdAt,
        verifiedAt: row.verifiedAt,
        proofUrl:
          row.status === "pending"
            ? await signMemberPaymentProof((row as any).proofPath ?? null)
            : null,
      });
    }

    return {
      profile: {
        fullName: member.full_name as string,
        memberId: member.member_id as string,
        phone: (member.phone ?? null) as string | null,
        email: (member.email ?? null) as string | null,
      },
      policy: {
        mentorshipDays: policy.mentorshipDays,
        ccTargetFullPayment: policy.ccTargetFullPayment,
        ccTargetPartial: policy.ccTargetPartial,
      },
      methods: policy.paymentMethods,
      mentorship: {
        required,
        verified,
        remaining,
        complete,
        dueAt: (member.mentorship_due_at ?? null) as string | null,
      },
      cc: {
        target: ccMoney.total,
        verified: ccMoney.received,
        remaining: ccMoney.remaining,
        dueAt: ccMoney.dueAt,
        ccDays: ccMoney.ccDays,
        full: ccMoney.full,
        partial: ccMoney.partial,
      },
      pendingCount: ledger.pendingCount,
      history,
    };
  });

/** Short-lived, member-scoped upload slot for a payment screenshot. */
export const createMemberPaymentProofUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileName: string }) =>
    z.object({ fileName: z.string().trim().min(1).max(300) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMemberRow(context.userId);
    const dot = data.fileName.lastIndexOf(".");
    const extension =
      dot > 0
        ? data.fileName.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").toLowerCase()
        : "jpg";
    if (!["png", "jpg", "jpeg", "webp"].includes(extension)) {
      throw new Error("Please choose a PNG, JPG or WebP screenshot.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${member.id}/${crypto.randomUUID()}.${extension}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not prepare the screenshot upload.");
    return { path: signed.path, signedUrl: signed.signedUrl };
  });

/** A member's payment claim. Stays pending until the office verifies it. */
export const submitMemberPaymentClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      purpose: "mentorship" | "two_cc";
      claimedAmount: number;
      method: string;
      proofPath: string;
      note?: string | null;
    }) =>
      z
        .object({
          purpose: z.enum(["mentorship", "two_cc"]),
          claimedAmount: z.number().min(1, "Enter the amount you paid").max(100_000_000),
          method: z.string().trim().min(1, "Choose a payment method").max(60),
          proofPath: z.string().trim().min(3).max(300),
          note: z.string().trim().max(1000).nullish(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMemberRow(context.userId);
    if (!data.proofPath.startsWith(`${member.id}/`)) {
      throw new Error("That payment screenshot does not belong to this account.");
    }
    const { loadLedger, loadPolicy } = await import("./journey.server");
    const [policy, ledger] = await Promise.all([loadPolicy(), loadLedger(member.id)]);

    if (data.purpose === "mentorship") {
      const required = Number(member.mentorship_fee_pkr) || policy.mentorshipFeePkr;
      const paid = Math.max(ledger.mentorshipPaid, Number(member.mentorship_paid_pkr) || 0);
      const remaining = Math.max(0, required - paid);
      if (remaining === 0) throw new Error("Your Personal Mentorship amount is already complete.");
      if (data.claimedAmount > remaining) {
        throw new Error("That amount is more than your remaining Personal Mentorship balance.");
      }
    }
    if (data.purpose === "two_cc") {
      const required = Number(member.mentorship_fee_pkr) || policy.mentorshipFeePkr;
      const paid = Math.max(ledger.mentorshipPaid, Number(member.mentorship_paid_pkr) || 0);
      if (paid < required) throw new Error("Complete your Personal Mentorship amount first.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("payment_submissions").insert({
      payer_id: member.id,
      payer_kind: "member",
      payer_name: member.full_name,
      payer_code: member.member_id,
      upline_id: member.upline_id,
      purpose: data.purpose,
      claimed_amount_pkr: data.claimedAmount,
      method: data.method,
      proof_path: data.proofPath,
      phone: member.phone ?? null,
      email: member.email ?? null,
      age: member.age ?? null,
      note: data.note ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    {
      const { pushToAdmin } = await import("./push.server");
      await pushToAdmin({ title: "New payment proof", body: `${member.full_name} submitted a payment proof to verify.`, tag: "admin-payment", path: "/admin?tab=journey" });
    }
    return { ok: true as const };
  });
