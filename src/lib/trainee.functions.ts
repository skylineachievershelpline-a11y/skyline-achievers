import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: who invited me? Shown on the self-registration page. */
export const getInvite = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) =>
    z.object({ token: z.string().trim().min(6).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("trainee_invites")
      .select("id, is_active, label, member_profiles:upline_id (member_id, full_name, status)")
      .eq("token", data.token)
      .maybeSingle();
    const upline = (invite as any)?.member_profiles;
    if (!invite || !invite.is_active || !upline || upline.status !== "active") {
      return { status: "invalid" as const };
    }
    return {
      status: "ok" as const,
      invite: {
        label: invite.label as string | null,
        uplineName: upline.full_name as string,
        uplineCode: upline.member_id as string,
      },
    };
  });

/** Public: the person fills their own form through a shared link. */
export const registerWithInvite = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; fullName: string; phone: string; age: number | null }) =>
    z
      .object({
        token: z.string().trim().min(6).max(64),
        fullName: z.string().trim().min(3, "Enter your full name").max(80),
        phone: z
          .string()
          .trim()
          .min(7, "Enter a valid phone number")
          .max(20)
          .regex(/^[0-9+\-\s]+$/, "Phone number may only contain digits"),
        age: z.number().int().min(10).max(90).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("trainee_invites")
      .select("id, upline_id, is_active, uses")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite || !invite.is_active) return { status: "invalid" as const };

    const { createTraineeAccount } = await import("./team.server");
    const credentials = await createTraineeAccount({
      fullName: data.fullName,
      phone: data.phone,
      age: data.age,
      uplineId: invite.upline_id as string,
      source: "link",
    });
    await supabaseAdmin
      .from("trainee_invites")
      .update({ uses: (invite.uses ?? 0) + 1 })
      .eq("id", invite.id);
    return { status: "ok" as const, credentials };
  });

async function loadTrainee(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("trainees")
    .select(
      "id, trainee_code, full_name, phone, age, status, created_at, member_profiles:upline_id (member_id, full_name)",
    )
    .eq("id", userId)
    .maybeSingle();
  return data as any;
}

/** Tells the login form which dashboard this account belongs to. */
export const whoAmI = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const trainee = await loadTrainee(context.userId);
    if (trainee) return { kind: "trainee" as const, status: trainee.status as string };
    return { kind: "member" as const, status: "unknown" };
  });

export const recordTraineeLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const trainee = await loadTrainee(context.userId);
    if (!trainee) return { status: "not_trainee" as const };
    if (trainee.status !== "active") return { status: trainee.status as "blocked" | "removed" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("trainees")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", context.userId);
    return { status: "ok" as const };
  });

/** The Beginners Training dashboard: profile plus locked / unlocked sessions. */
export const getTraineeDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const trainee = await loadTrainee(context.userId);
    if (!trainee) return { trainee: null, blocked: true as const, sessions: [] };
    if (trainee.status !== "active") {
      return { trainee: { ...trainee, upline: trainee.member_profiles ?? null }, blocked: true as const, sessions: [] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath, THUMBNAIL_BUCKET } = await import("./storage.server");
    const [{ data: sessions }, { data: unlocks }] = await Promise.all([
      supabaseAdmin
        .from("beginner_sessions")
        .select("id, title, description, thumbnail_path, duration_seconds, sort_order")
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("trainee_session_unlocks")
        .select("session_id")
        .eq("trainee_id", context.userId),
    ]);
    const unlocked = new Set((unlocks ?? []).map((row) => row.session_id));

    const list = await Promise.all(
      (sessions ?? []).map(async (row) => ({
        id: row.id as string,
        title: row.title as string,
        description: (row.description ?? null) as string | null,
        durationSeconds: (row.duration_seconds ?? null) as number | null,
        thumbnailUrl: await signPath(THUMBNAIL_BUCKET, (row as any).thumbnail_path, 60 * 60 * 4),
        unlocked: unlocked.has(row.id),
      })),
    );

    return {
      trainee: {
        traineeCode: trainee.trainee_code as string,
        fullName: trainee.full_name as string,
        phone: trainee.phone as string | null,
        age: trainee.age as number | null,
        createdAt: trainee.created_at as string,
        upline: trainee.member_profiles
          ? {
              memberId: trainee.member_profiles.member_id as string,
              fullName: trainee.member_profiles.full_name as string,
            }
          : null,
      },
      blocked: false as const,
      sessions: list,
    };
  });

/** Unlocks one session with the code the trainer shares. */
export const unlockTraineeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .min(4, "Enter the full session code")
          .max(40)
          .transform((value) => value.toUpperCase()),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const trainee = await loadTrainee(context.userId);
    if (!trainee || trainee.status !== "active") return { status: "blocked" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("beginner_sessions")
      .select("id, session_code, is_published")
      .ilike("session_code", data.code)
      .maybeSingle();
    if (!row || !row.is_published || String(row.session_code).toUpperCase() !== data.code) {
      return { status: "invalid" as const };
    }
    await supabaseAdmin
      .from("trainee_session_unlocks")
      .upsert({ trainee_id: context.userId, session_id: row.id }, { onConflict: "trainee_id,session_id" });
    return { status: "ok" as const, sessionId: row.id as string, code: data.code };
  });

/** Returns the playable video for a session this trainee already unlocked. */
export const playTraineeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const trainee = await loadTrainee(context.userId);
    if (!trainee || trainee.status !== "active") return { status: "blocked" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: unlock } = await supabaseAdmin
      .from("trainee_session_unlocks")
      .select("id")
      .eq("trainee_id", context.userId)
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!unlock) return { status: "locked" as const };

    const { signPath, VIDEO_BUCKET } = await import("./storage.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("beginner_sessions")
      .select("id, title, video_source, video_path, video_url, aspect_ratio")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!row || !row.is_published === undefined) {
      /* fall through: row shape checked below */
    }
    if (!row) return { status: "invalid" as const };

    const videoUrl =
      row.video_source === "external" && row.video_url
        ? row.video_url
        : await signPath(VIDEO_BUCKET, row.video_path, 60 * 60 * 4);

    return {
      status: "ok" as const,
      session: {
        id: row.id as string,
        title: row.title as string,
        aspectRatio: (row.aspect_ratio ?? "16:9") as string,
        videoUrl: videoUrl as string | null,
        isExternal: row.video_source === "external",
      },
    };
  });
