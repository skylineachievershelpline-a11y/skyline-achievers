import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const personSchema = z.object({
  fullName: z.string().trim().min(3, "Enter the full name").max(80),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+\-\s]+$/, "Phone number may only contain digits"),
  // Only adults may join.
  age: z.number({ message: "Enter the age" }).int().min(18, "Member must be 18 or older").max(90),
});

async function activeMember(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("member_profiles")
    .select("id, member_id, full_name, status")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") throw new Error("Your membership is not active.");
  return data;
}

/** Everything the upline sees: progress numbers, their people and invite links. */
export const getMyTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const member = await activeMember(context.userId);
    const { traineeStatsFor } = await import("./team.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [team, { data: invites }] = await Promise.all([
      traineeStatsFor(member.id),
      supabaseAdmin
        .from("trainee_invites")
        .select("id, token, label, is_active, uses, created_at")
        .eq("upline_id", member.id)
        .order("created_at", { ascending: false }),
    ]);
    return {
      upline: { memberId: member.member_id, fullName: member.full_name },
      ...team,
      invites: invites ?? [],
    };
  });

/**
 * FBO Team Tree: every Skyline member (12-digit ID) in this account's downline,
 * direct and indirect, with the level each one sits at. Read-only by design —
 * nobody can edit or remove an FBO from here. Personal Mentorship members are
 * marked separately so the two trees can be shown apart.
 */
export const getMyFboTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { AVATAR_BUCKET, signPath } = await import("./storage.server");

    // Walk the hierarchy level by level: direct members, then their members.
    const columns =
      "id, member_id, full_name, phone, status, working_enabled, avatar_path, created_at, last_login_at, upline_id, levels:level_id (name, rank_order)";
    const members: any[] = [];
    const seen = new Set<string>([member.id]);
    let frontier = [member.id];
    const depthOf = new Map<string, number>();
    for (let depth = 1; depth <= 8 && frontier.length > 0 && members.length < 2000; depth += 1) {
      const { data: rows } = await (supabaseAdmin as any)
        .from("member_profiles")
        .select(columns)
        .in("upline_id", frontier)
        .neq("status", "removed")
        .order("created_at", { ascending: false })
        .limit(1000);
      const batch = ((rows ?? []) as any[]).filter((row) => !seen.has(row.id as string));
      for (const row of batch) {
        seen.add(row.id as string);
        depthOf.set(row.id as string, depth);
      }
      members.push(...batch);
      frontier = batch.map((row) => row.id as string);
    }

    const ids = members.map((row) => row.id as string);
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const reportMap = new Map<string, any[]>();
    if (ids.length > 0) {
      const { data: reports } = await (supabaseAdmin as any)
        .from("member_daily_reports")
        .select(
          "member_id, report_date, leads_count, responses, enrollments, pending_count, two_cc, mentorship_paid, is_absent",
        )
        .in("member_id", ids)
        .gte("report_date", from)
        .order("report_date", { ascending: false });
      for (const row of reports ?? []) {
        const list = reportMap.get(row.member_id) ?? [];
        list.push(row);
        reportMap.set(row.member_id, list);
      }
    }

    const team = await Promise.all(
      members.map(async (row) => {
        const reports = reportMap.get(row.id) ?? [];
        const sum = (key: string) =>
          reports.reduce((total, entry) => total + Number(entry[key] ?? 0), 0);
        return {
          id: row.id as string,
          memberId: row.member_id as string,
          fullName: row.full_name as string,
          phone: (row.phone ?? null) as string | null,
          status: row.status as string,
          workingEnabled: row.working_enabled !== false,
          rank: (row.levels?.name ?? null) as string | null,
          avatarUrl: await signPath(AVATAR_BUCKET, row.avatar_path, 60 * 60),
          createdAt: row.created_at as string,
          lastLoginAt: (row.last_login_at ?? null) as string | null,
          report: {
            days: reports.filter((entry) => !entry.is_absent).length,
            absentDays: reports.filter((entry) => entry.is_absent).length,
            leads: sum("leads_count"),
            responses: sum("responses"),
            enrollments: sum("enrollments"),
            pending: sum("pending_count"),
            twoCc: sum("two_cc"),
            mentorshipPaid: sum("mentorship_paid"),
            lastDate: (reports[0]?.report_date ?? null) as string | null,
            recent: reports.slice(0, 7).map((entry) => ({
              date: entry.report_date as string,
              leads: Number(entry.leads_count ?? 0),
              responses: Number(entry.responses ?? 0),
              enrollments: Number(entry.enrollments ?? 0),
              pending: Number(entry.pending_count ?? 0),
              twoCc: Number(entry.two_cc ?? 0),
              absent: Boolean(entry.is_absent),
            })),
          },
        };
      }),
    );

    return {
      upline: { memberId: member.member_id, fullName: member.full_name },
      team,
      stats: {
        total: team.length,
        active: team.filter((row) => row.status === "active").length,
        reporting: team.filter((row) => row.report.lastDate).length,
        leads: team.reduce((total, row) => total + row.report.leads, 0),
        enrollments: team.reduce((total, row) => total + row.report.enrollments, 0),
      },
    };
  });


/** Reserve a seat: the upline fills the form and gets the ID + password card. */
export const reserveSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fullName: string; phone: string; age: number | null }) =>
    personSchema.parse(data),
  )

  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { createTraineeAccount } = await import("./team.server");
    const credentials = await createTraineeAccount({
      fullName: data.fullName,
      phone: data.phone,
      age: data.age,
      uplineId: member.id,
      source: "upline",
    });
    return { credentials };
  });

export const setTraineeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string; status: "active" | "blocked" }) =>
    z
      .object({
        traineeId: z.string().uuid(),
        status: z.enum(["active", "blocked"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: trainee } = await supabaseAdmin
      .from("trainees")
      .select("id, upline_id")
      .eq("id", data.traineeId)
      .maybeSingle();
    if (!trainee || trainee.upline_id !== member.id) {
      throw new Error("You can only manage the people you registered.");
    }
    const { error } = await supabaseAdmin
      .from("trainees")
      .update({ status: data.status })
      .eq("id", data.traineeId);
    if (error) throw new Error(error.message);
    // Blocked accounts lose their live session immediately.
    await supabaseAdmin.auth.admin.updateUserById(data.traineeId, {
      ban_duration: data.status === "active" ? "none" : "876000h",
    });
    return { ok: true as const };
  });

/** A direct upline can reset only a trainee they personally registered. */
export const resetTraineePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string }) =>
    z.object({ traineeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: trainee } = await supabaseAdmin
      .from("trainees")
      .select("id, upline_id")
      .eq("id", data.traineeId)
      .maybeSingle();
    if (!trainee || trainee.upline_id !== member.id) {
      throw new Error("You can only manage the people you registered.");
    }
    const { DEFAULT_TRAINEE_PASSWORD } = await import("./team.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.traineeId, {
      password: DEFAULT_TRAINEE_PASSWORD,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Remove means remove: the login, the record and the chats all disappear. */
export const deleteTrainee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string }) =>
    z.object({ traineeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: trainee } = await supabaseAdmin
      .from("trainees")
      .select("id, upline_id")
      .eq("id", data.traineeId)
      .maybeSingle();
    if (!trainee || trainee.upline_id !== member.id) {
      throw new Error("You can only manage the people you registered.");
    }
    const { deleteTraineeAccount } = await import("./team.server");
    return deleteTraineeAccount(data.traineeId);
  });


export const createInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { label: string }) =>
    z.object({ label: z.string().trim().max(60) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(9).toString("base64url");
    const { error } = await supabaseAdmin.from("trainee_invites").insert({
      token,
      upline_id: member.id,
      label: data.label || null,
    });
    if (error) throw new Error(error.message);
    return { token };
  });

export const setInviteActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; isActive: boolean }) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trainee_invites")
      .update({ is_active: data.isActive })
      .eq("id", data.id)
      .eq("upline_id", member.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trainee_invites")
      .delete()
      .eq("id", data.id)
      .eq("upline_id", member.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Every published beginners session with its code, so an upline can hand a
 * direct watch link to someone who cannot manage a login yet.
 */
export const getBeginnerSessionLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signThumbnails } = await import("./storage.server");

    const { data } = await (supabaseAdmin as any)
      .from("beginner_sessions")
      .select(
        "id, session_code, title, description, thumbnail_path, duration_seconds, sort_order, created_at",
      )
      .eq("is_published", true)
      .order("sort_order")
      .order("created_at", { ascending: false })
      .limit(200);

    const rows = await signThumbnails((data ?? []) as any[]);
    return {
      sessions: rows.map((row: any) => ({
        id: row.id as string,
        code: String(row.session_code).toUpperCase(),
        title: row.title as string,
        description: (row.description ?? null) as string | null,
        durationSeconds: (row.duration_seconds ?? null) as number | null,
        thumbnailUrl: row.thumbnail_url as string | null,
      })),
    };
  });
