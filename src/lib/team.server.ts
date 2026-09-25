import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { memberIdToAuthEmail } from "./brand";

/**
 * Every new Beginners Training account starts with the same simple code:
 * eight zeros. The person changes it from their own dashboard.
 */
export const DEFAULT_TRAINEE_PASSWORD = "00000000";

export function traineePassword(_fullName?: string, _phone?: string | null): string {
  return DEFAULT_TRAINEE_PASSWORD;
}

export type NewTrainee = {
  fullName: string;
  phone: string;
  age: number | null;
  uplineId: string;
  source: "upline" | "link";
};

export type TraineeCredentials = {
  traineeCode: string;
  password: string;
  fullName: string;
  uplineName: string;
  uplineCode: string;
  uplineAvatarUrl: string | null;
};

export function normalizeTraineePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Creates the login account plus the trainee record, then returns the card data. */
export async function createTraineeAccount(input: NewTrainee): Promise<TraineeCredentials> {
  const { data: upline } = await supabaseAdmin
    .from("member_profiles")
    .select("id, member_id, full_name, status, avatar_path")
    .eq("id", input.uplineId)
    .maybeSingle();
  if (!upline || upline.status !== "active") {
    throw new Error("The upline account is not active.");
  }

  const traineeCode = normalizeTraineePhone(input.phone ?? "");
  if (traineeCode.length < 7 || traineeCode.length > 15) {
    throw new Error("Enter a valid mobile number.");
  }
  const { assertPhoneEmailFree } = await import("./identity-unique.server");
  await assertPhoneEmailFree({ phone: traineeCode });
  const password = traineePassword(input.fullName, input.phone);

  const attempt = await supabaseAdmin.auth.admin.createUser({
    email: memberIdToAuthEmail(traineeCode),
    password,
    email_confirm: true,
    user_metadata: { trainee_code: traineeCode, full_name: input.fullName },
  });
  const { data: created, error: authError } = attempt;
  if (authError || !created?.user) {
    throw new Error(
      authError?.message.toLowerCase().includes("already")
        ? "An account already exists with this mobile number."
        : authError?.message ?? "Could not create the account.",
    );
  }

  const { error: rowError } = await supabaseAdmin.from("trainees").insert({
    id: created.user.id,
    trainee_code: traineeCode,
    full_name: input.fullName,
    phone: traineeCode,
    age: input.age,
    upline_id: input.uplineId,
    source: input.source,
  });
  if (rowError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    throw new Error(rowError.message);
  }

  const { AVATAR_BUCKET, signPath } = await import("./storage.server");

  return {
    traineeCode,
    password,
    fullName: input.fullName,
    uplineName: upline.full_name,
    uplineCode: upline.member_id,
    uplineAvatarUrl: await signPath(AVATAR_BUCKET, upline.avatar_path, 60 * 60 * 6),
  };
}

/** Deletes a trainee completely: login, record, unlocks and chat history. */
export async function deleteTraineeAccount(traineeId: string) {
  await supabaseAdmin.from("trainee_session_unlocks").delete().eq("trainee_id", traineeId);
  await supabaseAdmin.from("chat_messages").delete().eq("sender_id", traineeId);
  await supabaseAdmin.from("chat_messages").delete().eq("recipient_id", traineeId);
  await supabaseAdmin.from("chat_preferences").delete().eq("user_id", traineeId);
  const { error } = await supabaseAdmin.from("trainees").delete().eq("id", traineeId);
  if (error) throw new Error(error.message);
  await supabaseAdmin.auth.admin.deleteUser(traineeId);
  return { ok: true as const };
}


/** Progress numbers an upline sees for the people they registered. */
export async function traineeStatsFor(uplineId: string) {
  const { data: rows } = await supabaseAdmin
    .from("trainees")
    .select("id, trainee_code, full_name, phone, age, status, source, created_at, last_login_at")
    .eq("upline_id", uplineId)
    .order("created_at", { ascending: false })
    .limit(500);
  const trainees = rows ?? [];

  // One source of truth for training progress: approved session reviews in the
  // guided journey (7 basic sessions), not the old code-unlock rows.
  const { BASIC_SESSION_COUNT } = await import("./journey");
  const totalSessions = BASIC_SESSION_COUNT;

  const ids = trainees.map((t) => t.id);
  const unlockMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: approved } = await (supabaseAdmin as any)
      .from("trainee_session_reviews")
      .select("trainee_id, session_number, status")
      .in("trainee_id", ids)
      .eq("status", "approved");
    const seen = new Set<string>();
    for (const row of (approved ?? []) as { trainee_id: string; session_number: number }[]) {
      const key = `${row.trainee_id}:${row.session_number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unlockMap.set(row.trainee_id, (unlockMap.get(row.trainee_id) ?? 0) + 1);
    }
  }

  const now = Date.now();
  const week = now - 7 * 86_400_000;
  const month = now - 30 * 86_400_000;

  const list = trainees.map((t) => {
    const watched = unlockMap.get(t.id) ?? 0;
    return {
      id: t.id,
      traineeCode: t.trainee_code,
      fullName: t.full_name,
      phone: t.phone,
      age: t.age,
      status: t.status,
      source: t.source,
      createdAt: t.created_at,
      lastLoginAt: t.last_login_at,
      sessionsWatched: watched,
      totalSessions,
      completed: totalSessions > 0 && watched >= totalSessions,
    };
  });

  return {
    totalSessions,
    trainees: list,
    stats: {
      total: list.length,
      thisWeek: list.filter((t) => new Date(t.createdAt).getTime() >= week).length,
      thisMonth: list.filter((t) => new Date(t.createdAt).getTime() >= month).length,
      active: list.filter((t) => t.status === "active").length,
      blocked: list.filter((t) => t.status === "blocked").length,
      started: list.filter((t) => t.sessionsWatched > 0).length,
      completed: list.filter((t) => t.completed).length,
    },
  };
}
