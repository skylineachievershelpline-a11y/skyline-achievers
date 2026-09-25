import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * One person, one account. The same active mobile number or email address can
 * never be used to open a second Beginners Training, Personal Mentorship or FBO
 * account. The only allowed exception is the same trainee moving forward into
 * Personal Mentorship, because that is the same person's own upgrade.
 */

/** Last ten digits, so 03xx…, 92 3xx… and +92 3xx… are treated as one number. */
export function phoneTail(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(-10);
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

type Allow = {
  /** Trainee record id whose phone/email may be reused (training → mentorship). */
  allowTraineeId?: string | null;
  /** Member record id whose phone/email may be reused (editing that member). */
  allowMemberId?: string | null;
};

/**
 * Throws a clear message when the phone or email already belongs to somebody
 * else. Runs on the server with admin access, so it cannot be bypassed from the
 * browser.
 */
export async function assertPhoneEmailFree(
  input: { phone?: string | null; email?: string | null },
  allow: Allow = {},
) {
  const wantedPhone = phoneTail(input.phone);
  const wantedEmail = normalizeEmail(input.email);
  if (!wantedPhone && !wantedEmail) return;

  const [{ data: members }, { data: trainees }] = await Promise.all([
    supabaseAdmin
      .from("member_profiles")
      .select("id, member_id, full_name, phone, email, status")
      .neq("status", "removed")
      .limit(10000),
    supabaseAdmin.from("trainees").select("id, trainee_code, full_name, phone").limit(10000),
  ]);

  for (const row of members ?? []) {
    if (allow.allowMemberId && row.id === allow.allowMemberId) continue;
    if (allow.allowTraineeId && row.id === allow.allowTraineeId) continue;
    if (wantedPhone && phoneTail(row.phone) === wantedPhone) {
      throw new Error(
        `Ye mobile number pehle se account ${row.member_id} (${row.full_name}) par registered hai. Ek number se doosra account nahi ban sakta.`,
      );
    }
    if (wantedEmail && normalizeEmail((row as any).email) === wantedEmail) {
      throw new Error(
        `Ye email pehle se account ${row.member_id} (${row.full_name}) par registered hai. Ek email se doosra account nahi ban sakta.`,
      );
    }
  }

  if (!wantedPhone) return;
  for (const row of trainees ?? []) {
    if (allow.allowTraineeId && row.id === allow.allowTraineeId) continue;
    if (phoneTail(row.phone) === wantedPhone) {
      throw new Error(
        `Ye mobile number pehle se ${row.full_name} ke Beginners Training account par registered hai. Ek number se doosra account nahi ban sakta.`,
      );
    }
  }
}
