import { memberIdToAuthEmail } from "./brand";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildCredentialMessage, generateTemporaryPassword } from "./admin-session.server";
import { signThumbnails } from "./storage.server";

export async function adminDashboardStats() {
  const counts = async (table: string, filter?: (q: any) => any) => {
    let query: any = (supabaseAdmin as any)
      .from(table)
      .select("id", { count: "exact", head: true });
    if (filter) query = filter(query);
    const { count } = await query;
    return count ?? 0;
  };

  const [members, active, blocked, removed, levels, series, lectures, resources] =
    await Promise.all([
      counts("member_profiles"),
      counts("member_profiles", (q) => q.eq("status", "active")),
      counts("member_profiles", (q) => q.eq("status", "blocked")),
      counts("member_profiles", (q) => q.eq("status", "removed")),
      counts("levels"),
      counts("series"),
      counts("lectures"),
      counts("resources"),
    ]);

  const { data: perLevel } = await supabaseAdmin
    .from("levels")
    .select("id, name, rank_order")
    .order("rank_order");
  const { data: memberLevels } = await supabaseAdmin
    .from("member_profiles")
    .select("level_id")
    .neq("status", "removed");
  const map = new Map<string, number>();
  for (const row of memberLevels ?? []) {
    if (row.level_id) map.set(row.level_id, (map.get(row.level_id) ?? 0) + 1);
  }

  const { data: recentMembers } = await supabaseAdmin
    .from("member_profiles")
    .select("id, member_id, full_name, status, created_at, levels:level_id (name)")
    .order("created_at", { ascending: false })
    .limit(6);

  return {
    totals: { members, active, blocked, removed, levels, series, lectures, resources },
    membersPerLevel: (perLevel ?? []).map((l) => ({ name: l.name, members: map.get(l.id) ?? 0 })),
    recentMembers: recentMembers ?? [],
  };
}

export async function adminMembers(input: {
  search?: string | undefined;
  status?: string | undefined;
  levelId?: string | undefined;
}) {
  let query = supabaseAdmin
    .from("member_profiles")
    .select(
      "id, member_id, full_name, age, email, phone, status, created_at, last_login_at, level_id, levels:level_id (id, name, rank_order)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (input.status && input.status !== "all") query = query.eq("status", input.status);
  if (input.levelId && input.levelId !== "all") query = query.eq("level_id", input.levelId);
  if (input.search) {
    const term = `%${input.search.replace(/[%_]/g, "")}%`;
    query = query.or(
      `full_name.ilike.${term},member_id.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminMemberDetail(id: string) {
  const { data: member } = await supabaseAdmin
    .from("member_profiles")
    .select("*, levels:level_id (id, name, rank_order)")
    .eq("id", id)
    .maybeSingle();
  if (!member) return null;
  const { data: watch } = await supabaseAdmin
    .from("watch_positions")
    .select("position_seconds, updated_at, lectures:lecture_id (id, title)")
    .eq("member_id", id)
    .order("updated_at", { ascending: false })
    .limit(10);
  return { member, recentActivity: watch ?? [] };
}

export async function adminCreateMember(input: {
  fullName: string;
  age: number | null;
  cnic: string | null;
  email: string | null;
  phone: string | null;
  levelId: string;
  status: string;
}) {
  const { data: level } = await supabaseAdmin
    .from("levels")
    .select("id, name")
    .eq("id", input.levelId)
    .maybeSingle();
  if (!level) throw new Error("Selected training level no longer exists.");

  const { data: generatedId, error: idError } = await supabaseAdmin.rpc("generate_member_id");
  if (idError || !generatedId) throw new Error("Could not generate a Member ID. Please try again.");
  const memberId = generatedId as string;
  const password = generateTemporaryPassword();

  const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: memberIdToAuthEmail(memberId),
    password,
    email_confirm: true,
    user_metadata: { member_id: memberId, full_name: input.fullName },
  });
  if (authError || !created.user) {
    throw new Error(authError?.message ?? "Could not create the member account.");
  }

  const { error: profileError } = await supabaseAdmin.from("member_profiles").insert({
    id: created.user.id,
    member_id: memberId,
    full_name: input.fullName,
    age: input.age,
    cnic: input.cnic,
    email: input.email,
    phone: input.phone,
    level_id: input.levelId,
    status: input.status,
  });
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    throw new Error(profileError.message);
  }

  return {
    memberId,
    password,
    fullName: input.fullName,
    levelName: level.name,
    accountId: created.user.id,
    message: buildCredentialMessage({
      fullName: input.fullName,
      memberId,
      password,
      levelName: level.name,
    }),
  };
}

export async function adminUpdateMember(
  id: string,
  patch: Record<string, string | number | null>,
) {
  const { error } = await (supabaseAdmin as any)
    .from("member_profiles")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (patch["status"] === "removed" || patch["status"] === "blocked") {
    // Revoke live sessions immediately so a blocked member loses access at once.
    await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  }
  if (patch["status"] === "active") {
    await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: "none" });
  }
  return { ok: true as const };
}

export async function adminResetMemberPassword(id: string, newPassword: string | null = null) {
  const { data: member } = await supabaseAdmin
    .from("member_profiles")
    .select("member_id, full_name, levels:level_id (name)")
    .eq("id", id)
    .maybeSingle();
  if (!member) throw new Error("Member not found.");
  // Admin may set the password manually, otherwise a strong one is generated.
  const password = newPassword && newPassword.length >= 8 ? newPassword : generateTemporaryPassword();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });

  if (error) throw new Error(error.message);
  const levelName = (member as any).levels?.name ?? "Not assigned";
  return {
    memberId: member.member_id,
    password,
    fullName: member.full_name,
    levelName,
    message: buildCredentialMessage({
      fullName: member.full_name,
      memberId: member.member_id,
      password,
      levelName,
    }),
  };
}

export async function adminLibrary() {
  const [{ data: levels }, { data: series }, { data: lectures }, { data: resources }] =
    await Promise.all([
      supabaseAdmin.from("levels").select("*").order("rank_order"),
      supabaseAdmin
        .from("series")
        .select("*, levels:level_id (id, name, rank_order)")
        .order("sort_order"),
      supabaseAdmin
        .from("lectures")
        .select("*, series:series_id (id, title, level_id, levels:level_id (id, name))")
        .order("sort_order"),
      supabaseAdmin
        .from("resources")
        .select("*, lectures:lecture_id (id, title), series:series_id (id, title)")
        .order("created_at", { ascending: false }),
    ]);
  return {
    levels: levels ?? [],
    series: await signThumbnails(series ?? []),
    lectures: lectures ?? [],
    resources: resources ?? [],
  };
}

export async function adminSeriesAccess(seriesId: string) {
  const { data } = await supabaseAdmin
    .from("content_access")
    .select("level_id")
    .eq("content_type", "series")
    .eq("content_id", seriesId);
  return (data ?? []).map((row) => row.level_id);
}

export async function adminSetSeriesAccess(seriesId: string, levelIds: string[]) {
  await supabaseAdmin
    .from("content_access")
    .delete()
    .eq("content_type", "series")
    .eq("content_id", seriesId);
  if (levelIds.length > 0) {
    const { error } = await supabaseAdmin.from("content_access").insert(
      levelIds.map((levelId) => ({
        content_type: "series",
        content_id: seriesId,
        level_id: levelId,
      })),
    );
    if (error) throw new Error(error.message);
  }
  return { ok: true as const };
}

export async function adminNotify(input: {
  title: string;
  body: string | null;
  kind: string;
  audienceLevelId: string | null;
  linkPath: string | null;
}) {
  const { error } = await supabaseAdmin.from("notifications").insert({
    title: input.title,
    body: input.body,
    kind: input.kind,
    audience_level_id: input.audienceLevelId,
    link_path: input.linkPath,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}