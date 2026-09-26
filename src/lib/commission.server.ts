import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_ASSISTANT_SETTINGS, type AssistantSettings } from "./assistants.functions";

export async function readAssistantSettings(): Promise<AssistantSettings> {
  const { data } = await (supabaseAdmin as any)
    .from("platform_settings")
    .select("value")
    .eq("key", "job_assistant_settings")
    .maybeSingle();
  const v = data?.value as AssistantSettings | undefined;
  return v?.enrollmentTiers?.length && v?.ccTiers?.length ? v : DEFAULT_ASSISTANT_SETTINGS;
}

export type Earnings = {
  assigned: number;
  worked: number;
  verifiedEnrollments: number;
  verifiedCc: number;
  conversionRate: number;
  ccRate: number;
  perEnrollment: number;
  perCc: number;
  enrollmentPay: number;
  ccPay: number;
  total: number;
  serviceFee: number;
  fboPays: number;
  sampleReached: boolean;
};

/** Verified-only commission. 2CC rate uses enrolled people, not total leads. */
export function computeEarnings(
  leads: { call_count: number; enroll_verified_at: string | null; cc_verified_at: string | null }[],
  role: string,
  s: AssistantSettings,
): Earnings {
  const assigned = leads.length;
  const worked = leads.filter((l) => l.call_count > 0).length;
  const verifiedEnrollments = leads.filter((l) => l.enroll_verified_at).length;
  const verifiedCc = role === "full_funnel" ? leads.filter((l) => l.cc_verified_at).length : 0;
  const conversionRate = worked ? (verifiedEnrollments / worked) * 100 : 0;
  const ccRate = verifiedEnrollments ? (verifiedCc / verifiedEnrollments) * 100 : 0;
  const sampleReached = worked >= s.minSampleLeads;
  const eTier = [...s.enrollmentTiers].sort((a, b) => b.minRate - a.minRate).find((t) => conversionRate >= t.minRate);
  // Before the sample size is reached, pay the lowest tier.
  const perEnrollment = sampleReached ? eTier?.perEnrollment ?? 0 : Math.min(...s.enrollmentTiers.map((t) => t.perEnrollment));
  const cTier = [...s.ccTiers].sort((a, b) => b.minCount - a.minCount).find((t) => verifiedCc >= t.minCount);
  const perCc = cTier?.perCc ?? 0;
  const enrollmentPay = verifiedEnrollments * perEnrollment;
  const ccPay = verifiedCc * perCc;
  const total = enrollmentPay + ccPay;
  const serviceFee = Math.round((total * s.serviceFeePercent) / 100);
  return {
    assigned, worked, verifiedEnrollments, verifiedCc,
    conversionRate: Math.round(conversionRate * 10) / 10,
    ccRate: Math.round(ccRate * 10) / 10,
    perEnrollment, perCc, enrollmentPay, ccPay, total, serviceFee,
    fboPays: total + serviceFee, sampleReached,
  };
}
