import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function guard() {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Trainees waiting for / in Final Interview, with assigned senior. */
export const adminListFinalInterviews = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await guard();
  const { data: rows } = await admin
    .from("trainee_journey")
    .select("trainee_id, stage, interview_scheduled_at, interview_requested_at, interview_senior_id, interview_result, interview_marks, interview_max_marks")
    .in("stage", ["ready_for_interview", "reassess", "interview_passed"])
    .order("interview_requested_at", { ascending: false, nullsFirst: false })
    .limit(200);
  const list = (rows ?? []) as any[];
  const tIds = list.map((r) => r.trainee_id);
  const sIds = list.map((r) => r.interview_senior_id).filter(Boolean);
  const { data: trainees } = tIds.length
    ? await admin.from("trainees").select("id, full_name, trainee_code, upline_id").in("id", tIds)
    : { data: [] };
  const uIds = ((trainees ?? []) as any[]).map((t) => t.upline_id).filter(Boolean);
  const { data: people } = [...sIds, ...uIds].length
    ? await admin.from("member_profiles").select("id, member_id, full_name").in("id", [...new Set([...sIds, ...uIds])])
    : { data: [] };
  const tMap = new Map(((trainees ?? []) as any[]).map((t) => [t.id, t]));
  const pMap = new Map(((people ?? []) as any[]).map((p) => [p.id, p]));
  return list.map((r) => {
    const t = tMap.get(r.trainee_id);
    const senior = r.interview_senior_id ? pMap.get(r.interview_senior_id) : null;
    const upline = t?.upline_id ? pMap.get(t.upline_id) : null;
    return {
      traineeId: r.trainee_id as string,
      name: (t?.full_name ?? "—") as string,
      code: (t?.trainee_code ?? "") as string,
      stage: r.stage as string,
      scheduledAt: r.interview_scheduled_at as string | null,
      requestedAt: r.interview_requested_at as string | null,
      result: r.interview_result as string | null,
      marks: r.interview_marks as number | null,
      maxMarks: Number(r.interview_max_marks ?? 25),
      upline: upline ? `${upline.full_name} (${upline.member_id})` : null,
      senior: senior ? { name: senior.full_name as string, memberId: senior.member_id as string } : null,
    };
  });
});

/** Assign (or clear) the senior who takes this Final Interview, by 12-digit member ID. */
export const adminAssignInterviewSenior = createServerFn({ method: "POST" })
  .inputValidator((d: { traineeId: string; seniorMemberId: string | null }) =>
    z.object({ traineeId: z.string().uuid(), seniorMemberId: z.string().regex(/^\d{12}$/).nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await guard();
    let seniorId: string | null = null;
    let seniorName = "";
    if (data.seniorMemberId) {
      const { data: s } = await admin
        .from("member_profiles")
        .select("id, full_name, status")
        .eq("member_id", data.seniorMemberId)
        .maybeSingle();
      if (!s || s.status !== "active") throw new Error("No active member with this ID.");
      seniorId = s.id;
      seniorName = s.full_name;
    }
    const { error } = await admin
      .from("trainee_journey")
      .update({ interview_senior_id: seniorId })
      .eq("trainee_id", data.traineeId);
    if (error) throw new Error(error.message);
    if (seniorId) {
      const { data: t } = await admin.from("trainees").select("full_name").eq("id", data.traineeId).maybeSingle();
      const { pushToUsers } = await import("./push.server");
      await Promise.resolve(pushToUsers([seniorId], {
        title: "Final Interview assigned",
        body: `You will take ${t?.full_name ?? "a trainee"}'s Final Interview. Open your dashboard to set the time and give marks.`,
        path: "/dashboard",
        tag: `interview-assign-${data.traineeId}`,
      })).catch(() => undefined);
    }
    return { ok: true as const, seniorName };
  });
