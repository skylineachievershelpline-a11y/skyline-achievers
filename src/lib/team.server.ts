import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { memberIdToAuthEmail } from "./brand";

/**
 * Simple, easy-to-remember password: a Skyline prefix, the person's first name
 * and the last three digits of their phone number (e.g. Sky@Ahmad786). The
 * prefix keeps it out of the common-password lists that auth rejects as weak.
 */
export function traineePassword(fullName: string, phone: string | null): string {
  const rawFirst = (fullName.trim().split(/\s+/)[0] ?? "").replace(/[^A-Za-z]/g, "");
  const first = rawFirst.length > 0 ? rawFirst : "Skyline";
  const digits = (phone ?? "").replace(/\D/g, "");
  const last3 = digits.length >= 3 ? digits.slice(-3) : digits.padStart(3, "7");
  const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  return `Sky@${name}${last3}`;
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

  const { data: generated, error: idError } = await supabaseAdmin.rpc("generate_trainee_id");
  if (idError || !generated) throw new Error("Could not generate a Skyline ID. Please try again.");
  const traineeCode = generated as string;
  let password = traineePassword(input.fullName, input.phone);

  let attempt = await supabaseAdmin.auth.admin.createUser({
    email: memberIdToAuthEmail(traineeCode),
    password,
    email_confirm: true,
    user_metadata: { trainee_code: traineeCode, full_name: input.fullName },
  });
  // Some name/number combinations land in the leaked-password list; add a small
  // random tail so the person still gets a working, simple password.
  if (attempt.error && /weak|easy to guess|pwned/i.test(attempt.error.message)) {
    password = `${password}${Math.floor(Math.random() * 90 + 10)}`;
    attempt = await supabaseAdmin.auth.admin.createUser({
      email: memberIdToAuthEmail(traineeCode),
      password,
      email_confirm: true,
      user_metadata: { trainee_code: traineeCode, full_name: input.fullName },
    });
  }
  const { data: created, error: authError } = attempt;
  if (authError || !created?.user) {
    throw new Error(authError?.message ?? "Could not create the account.");
  }

  const { error: rowError } = await supabaseAdmin.from("trainees").insert({
    id: created.user.id,
    trainee_code: traineeCode,
    full_name: input.fullName,
    phone: input.phone,
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

  const { count: publishedSessions } = await supabaseAdmin
    .from("beginner_sessions")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true);
  const totalSessions = publishedSessions ?? 0;

  const ids = trainees.map((t) => t.id);
  const unlockMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: unlocks } = await supabaseAdmin
      .from("trainee_session_unlocks")
      .select("trainee_id")
      .in("trainee_id", ids);
    for (const row of unlocks ?? []) {
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
