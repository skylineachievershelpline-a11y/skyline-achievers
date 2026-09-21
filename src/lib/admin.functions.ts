import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdminRequest } = await import("./admin-session.server");
  return { isAdmin: await isAdminRequest() };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string }) =>
    z.object({ passcode: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { verifyAdminPasscode } = await import("./admin-session.server");
    const result = await verifyAdminPasscode(data.passcode);
    if (result.ok) return { ok: true as const };
    return { ok: false as const, reason: result.reason };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { endAdminSession } = await import("./admin-session.server");
  await endAdminSession();
  return { ok: true as const };
});

export const adminGetStats = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { adminDashboardStats } = await import("./admin.server");
  return adminDashboardStats();
});

export const adminGetMembers = createServerFn({ method: "POST" })
  .inputValidator((data: { search?: string; status?: string; levelId?: string }) =>
    z
      .object({
        search: z.string().trim().max(80).optional(),
        status: z.enum(["all", "active", "blocked", "removed"]).optional(),
        levelId: z.string().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { adminMembers } = await import("./admin.server");
    return { members: await adminMembers(data) };
  });

export const adminGetMember = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { adminMemberDetail } = await import("./admin.server");
    return { detail: await adminMemberDetail(data.id) };
  });

/** Read-only member dashboard data for the authenticated administrator. */
export const adminGetMemberDashboard = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath, AVATAR_BUCKET } = await import("./storage.server");

    const { data: member, error } = await supabaseAdmin
      .from("member_profiles")
      .select(
        "id, member_id, full_name, status, working_enabled, avatar_path, bio, created_at, levels:level_id (id, name, slug, rank_order)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member) throw new Error("Member not found.");

    const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const [{ data: reports }, { data: trainees }, { data: watch }] = await Promise.all([
      supabaseAdmin
        .from("member_daily_reports")
        .select("report_date, leads_count, rate_per_lead, is_absent")
        .eq("member_id", member.id)
        .gte("report_date", from),
      supabaseAdmin.from("trainees").select("id, status").eq("upline_id", member.id),
      supabaseAdmin
        .from("watch_positions")
        .select("position_seconds, updated_at, lectures:lecture_id (id, title, duration_seconds)")
        .eq("member_id", member.id)
        .order("updated_at", { ascending: false })
        .limit(8),
    ]);

    const dailyRows = reports ?? [];
    const teamRows = trainees ?? [];
    const leads = dailyRows.reduce((sum, row) => sum + Number(row.leads_count ?? 0), 0);
    const investment = dailyRows.reduce(
      (sum, row) => sum + Number(row.leads_count ?? 0) * Number(row.rate_per_lead ?? 0),
      0,
    );

    return {
      member: {
        id: member.id,
        memberId: member.member_id,
        fullName: member.full_name,
        status: member.status,
        workingEnabled: (member as any).working_enabled !== false,
        avatarUrl: await signPath(AVATAR_BUCKET, (member as any).avatar_path, 60 * 60),
        bio: member.bio ?? null,
        createdAt: member.created_at,
        level: (member as any).levels ?? null,
      },
      tracking: {
        leads,
        investment,
        activeDays: dailyRows.filter((row) => !row.is_absent && Number(row.leads_count ?? 0) > 0).length,
        absentDays: dailyRows.filter((row) => row.is_absent).length,
        team: teamRows.length,
        activeTeam: teamRows.filter((row) => row.status === "active").length,
      },
      recentActivity: (watch ?? []).filter((row) => (row as any).lectures),
    };
  });

export const adminAddMember = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      fullName: string;
      age?: number | null;
      cnic?: string | null;
      email?: string | null;
      phone?: string | null;
      levelId: string;
      status: string;
      workingEnabled?: boolean;
    }) =>
      z
        .object({
          fullName: text(120),
          age: z.number().int().min(10).max(100).nullable().optional(),
          cnic: optionalText(25),
          email: z
            .string()
            .trim()
            .max(255)
            .optional()
            .nullable()
            .transform((v) => (v ? v : null))
            .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
              message: "Enter a valid email address",
            }),
          phone: optionalText(25),
          levelId: uuid,
          status: z.enum(["active", "blocked", "removed"]),
          workingEnabled: z.boolean().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { adminCreateMember } = await import("./admin.server");
    return adminCreateMember({
      fullName: data.fullName,
      age: data.age ?? null,
      cnic: data.cnic ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      levelId: data.levelId,
      status: data.status,
      workingEnabled: data.workingEnabled ?? true,
    });
  });

export const adminEditMember = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: string;
      fullName?: string;
      age?: number | null;
      cnic?: string | null;
      email?: string | null;
      phone?: string | null;
      levelId?: string;
      status?: string;
      notes?: string | null;
      workingEnabled?: boolean;
    }) =>
      z
        .object({
          id: uuid,
          fullName: text(120).optional(),
          age: z.number().int().min(10).max(100).nullable().optional(),
          cnic: optionalText(25),
          email: optionalText(255),
          phone: optionalText(25),
          levelId: uuid.optional(),
          status: z.enum(["active", "blocked", "removed"]).optional(),
          notes: optionalText(2000),
          workingEnabled: z.boolean().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { adminUpdateMember } = await import("./admin.server");
    const patch: Record<string, string | number | boolean | null> = {};
    if (data.workingEnabled !== undefined) patch["working_enabled"] = data.workingEnabled;
    if (data.fullName !== undefined) patch["full_name"] = data.fullName;
    if (data.age !== undefined) patch["age"] = data.age;
    if (data.cnic !== undefined) patch["cnic"] = data.cnic;
    if (data.email !== undefined) patch["email"] = data.email;
    if (data.phone !== undefined) patch["phone"] = data.phone;
    if (data.levelId !== undefined) patch["level_id"] = data.levelId;
    if (data.status !== undefined) patch["status"] = data.status;
    if (data.notes !== undefined) patch["notes"] = data.notes;
    return adminUpdateMember(data.id, patch);
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; newPassword?: string | null }) =>
    z
      .object({
        id: uuid,
        newPassword: z
          .string()
          .min(8, "Use at least 8 characters")
          .max(72)
          .optional()
          .nullable()
          .transform((v) => (v ? v : null)),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { adminResetMemberPassword } = await import("./admin.server");
    return adminResetMemberPassword(data.id, data.newPassword ?? null);
  });

export const adminUpdateNotification = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; title: string; body?: string | null; audienceLevelId?: string | null }) =>
    z
      .object({
        id: uuid,
        title: text(140),
        body: optionalText(4000),
        audienceLevelId: uuid.nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("notifications")
      .update({
        title: data.title,
        body: data.body,
        audience_level_id: data.audienceLevelId ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteNotification = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("notifications")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


export const adminGetLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { adminLibrary } = await import("./admin.server");
  return adminLibrary();
});

/**
 * Training sections (Podcast, Motivational, Training, ...). Videos are placed
 * into one section and members browse each section from the sidebar.
 */
export const adminSaveTrainingCategory = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id?: string;
      name: string;
      description?: string | null;
      sortOrder: number;
      isPublished: boolean;
      groupId?: string | null;
      levelIds?: string[];
    }) =>
      z
        .object({
          id: uuid.optional(),
          name: text(60),
          description: optionalText(500),
          sortOrder: z.number().int().min(0).max(999),
          isPublished: z.boolean(),
          groupId: uuid.nullish(),
          levelIds: z.array(uuid).max(50).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const payload = {
      name: data.name,
      slug: slug || `section-${Date.now()}`,
      description: data.description,
      sort_order: data.sortOrder,
      is_published: data.isPublished,
      group_id: data.groupId ?? null,
    };
    let categoryId = data.id ?? null;
    if (categoryId) {
      const { error } = await (supabaseAdmin as any)
        .from("training_categories")
        .update(payload)
        .eq("id", categoryId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await (supabaseAdmin as any)
        .from("training_categories")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      categoryId = created.id as string;
    }

    // Exactly which ranks may open this section.
    if (data.levelIds) {
      await (supabaseAdmin as any)
        .from("training_category_access")
        .delete()
        .eq("category_id", categoryId);
      if (data.levelIds.length > 0) {
        const { error } = await (supabaseAdmin as any).from("training_category_access").insert(
          data.levelIds.map((levelId) => ({ category_id: categoryId, level_id: levelId })),
        );
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true as const };
  });

export const adminDeleteTrainingCategory = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("training_categories")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Categories group the training sections together (Sales, Mindset, Personal
 * Mentorship, ...). Each section belongs to one category.
 */
export const adminSaveTrainingGroup = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id?: string;
      name: string;
      description?: string | null;
      sortOrder: number;
      isPublished: boolean;
      levelIds?: string[];
    }) =>
      z
        .object({
          id: uuid.optional(),
          name: text(60),
          description: optionalText(500),
          sortOrder: z.number().int().min(0).max(999),
          isPublished: z.boolean(),
          levelIds: z.array(uuid).max(50).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const payload = {
      name: data.name,
      slug: slug || `category-${Date.now()}`,
      description: data.description,
      sort_order: data.sortOrder,
      is_published: data.isPublished,
    };
    let groupId = data.id ?? null;
    if (groupId) {
      const { error } = await (supabaseAdmin as any)
        .from("training_groups")
        .update(payload)
        .eq("id", groupId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await (supabaseAdmin as any)
        .from("training_groups")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      groupId = created.id as string;
    }

    // Exactly which ranks may open this category.
    if (data.levelIds) {
      await (supabaseAdmin as any)
        .from("training_group_access")
        .delete()
        .eq("group_id", groupId);
      if (data.levelIds.length > 0) {
        const { error } = await (supabaseAdmin as any)
          .from("training_group_access")
          .insert(data.levelIds.map((levelId) => ({ group_id: groupId, level_id: levelId })));
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true as const };
  });

export const adminDeleteTrainingGroup = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("training_groups")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


export const adminSaveLevel = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id?: string;
      name: string;
      description?: string | null;
      rankOrder: number;
      isPublished: boolean;
    }) =>
      z
        .object({
          id: uuid.optional(),
          name: text(80),
          description: optionalText(1000),
          rankOrder: z.number().int().min(1).max(99),
          isPublished: z.boolean(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const payload = {
      name: data.name,
      slug,
      description: data.description,
      rank_order: data.rankOrder,
      is_published: data.isPublished,
    };
    const query = data.id
      ? (supabaseAdmin as any).from("levels").update(payload).eq("id", data.id)
      : (supabaseAdmin as any).from("levels").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Creates or edits one training video. `levelIds` is the access list: exactly
 * which training levels may watch it.
 */
export const adminSaveLecture = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id?: string;
      levelId: string;
      levelIds?: string[];
      categoryId?: string | null;
      title: string;
      description?: string | null;
      sortOrder: number;
      durationSeconds?: number | null;
      videoSource: "upload" | "external";
      videoPath?: string | null;
      videoUrl?: string | null;
      thumbnailPath?: string | null;
      isPublished: boolean;
      aspectRatio?: string;
    }) =>
      z
        .object({
          id: uuid.optional(),
          aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3"]).optional(),
          levelId: uuid,
          levelIds: z.array(uuid).max(50).optional(),
          categoryId: uuid.nullable().optional(),
          title: text(160),
          description: optionalText(4000),
          sortOrder: z.number().int().min(0).max(999),
          durationSeconds: z.number().int().min(0).max(86400).nullable().optional(),
          videoSource: z.enum(["upload", "external"]),
          videoPath: optionalText(400),
          videoUrl: optionalText(600),
          thumbnailPath: optionalText(400),
          isPublished: z.boolean(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { adminSetLectureAccess } = await import("./admin.server");

    const payload: Record<string, unknown> = {
      series_id: null,
      level_id: data.levelId,
      category_id: data.categoryId ?? null,
      title: data.title,
      description: data.description,
      sort_order: data.sortOrder,
      duration_seconds: data.durationSeconds ?? null,
      video_source: data.videoSource,
      is_published: data.isPublished,
      aspect_ratio: data.aspectRatio ?? "16:9",
    };
    if (data.videoPath !== undefined) payload["video_path"] = data.videoPath;
    if (data.videoUrl !== undefined) payload["video_url"] = data.videoUrl;
    if (data.thumbnailPath !== undefined) payload["thumbnail_path"] = data.thumbnailPath;

    // Nobody chose an access list? Everyone at this level and above may watch.
    const accessLevels =
      data.levelIds && data.levelIds.length > 0 ? data.levelIds : await levelsAtOrAbove(data.levelId);

    if (data.id) {
      // On edit, keep the stored file when the form did not upload a new one.
      if (data.videoPath === null) delete payload["video_path"];
      if (data.thumbnailPath === null) delete payload["thumbnail_path"];
      const { error } = await (supabaseAdmin as any)
        .from("lectures")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await adminSetLectureAccess(data.id, accessLevels);
      return { ok: true as const };
    }

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("lectures")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await adminSetLectureAccess(inserted.id, accessLevels);

    // New videos no longer create notifications — only admin announcements do.
    return { ok: true as const };
  });

async function levelsAtOrAbove(levelId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: base } = await (supabaseAdmin as any)
    .from("levels")
    .select("rank_order")
    .eq("id", levelId)
    .maybeSingle();
  if (!base) return [levelId];
  const { data: levels } = await (supabaseAdmin as any)
    .from("levels")
    .select("id")
    .gte("rank_order", base.rank_order);
  return (levels ?? []).map((l: { id: string }) => l.id);
}

export const adminDeleteContent = createServerFn({ method: "POST" })
  .inputValidator((data: { table: "levels" | "lectures" | "resources"; id: string }) =>
    z.object({ table: z.enum(["levels", "lectures", "resources"]), id: uuid }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.table === "lectures") {
      await (supabaseAdmin as any)
        .from("content_access")
        .delete()
        .eq("content_type", "lecture")
        .eq("content_id", data.id);
      await (supabaseAdmin as any).from("watch_positions").delete().eq("lecture_id", data.id);
      await (supabaseAdmin as any).from("resources").delete().eq("lecture_id", data.id);
    }
    const { error } = await (supabaseAdmin as any).from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


export const adminSaveResource = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id?: string;
      lectureId?: string | null;
      resourceType: string;
      title: string;
      description?: string | null;
      storagePath?: string | null;
      externalUrl?: string | null;
      body?: string | null;
      thumbnailPath?: string | null;
      sortOrder: number;
      isPublished: boolean;
    }) =>
      z
        .object({
          id: uuid.optional(),
          lectureId: uuid.nullish(),
          resourceType: z.enum(["pdf", "audio", "presentation", "book", "link", "note", "image"]),
          title: text(160),
          description: optionalText(1000),
          storagePath: optionalText(400),
          externalUrl: optionalText(600),
          body: optionalText(8000),
          thumbnailPath: optionalText(400),
          sortOrder: z.number().int().min(0).max(999),
          isPublished: z.boolean(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      lecture_id: data.lectureId ?? null,

      series_id: null,
      resource_type: data.resourceType,
      title: data.title,
      description: data.description,
      storage_path: data.storagePath ?? null,
      external_url: data.externalUrl ?? null,
      body: data.body ?? null,
      thumbnail_path: data.thumbnailPath ?? null,
      sort_order: data.sortOrder,
      is_published: data.isPublished,
    };

    const query = data.id
      ? (supabaseAdmin as any).from("resources").update(payload).eq("id", data.id)
      : (supabaseAdmin as any).from("resources").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


export const adminUpdateVideoAccess = createServerFn({ method: "POST" })
  .inputValidator((data: { lectureId: string; levelIds: string[] }) =>
    z.object({ lectureId: uuid, levelIds: z.array(uuid).max(50) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { adminSetLectureAccess } = await import("./admin.server");
    return adminSetLectureAccess(data.lectureId, data.levelIds);
  });

/** Permanently deletes a member account — nothing of theirs is left behind. */
export const adminDeleteMember = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { adminDeleteMemberAccount } = await import("./admin.server");
    return adminDeleteMemberAccount(data.id);
  });


export const adminCreateUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { bucket: string; fileName: string }) =>
    z
      .object({
        bucket: z.enum(["training-videos", "training-resources", "training-thumbnails"]),
        fileName: z.string().trim().min(1).max(300),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dot = data.fileName.lastIndexOf(".");
    const rawExt = dot > 0 ? data.fileName.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "") : "";
    const base = (dot > 0 ? data.fileName.slice(0, dot) : data.fileName)
      .replace(/[^\w.()-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "file";
    const safeName = rawExt ? `${base}.${rawExt.slice(0, 8).toLowerCase()}` : base;

    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not prepare the upload.");
    return { path: signed.path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const adminGetNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("notifications")
    .select("id, title, body, kind, link_path, created_at, levels:audience_level_id (id, name)")
    .order("created_at", { ascending: false })
    .limit(100);
  return { notifications: data ?? [] };
});

export const adminSendNotification = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      title: string;
      body?: string | null;
      kind: string;
      audienceLevelId?: string | null;
      linkPath?: string | null;
      mediaType?: string | null;
      mediaBucket?: string | null;
      mediaPath?: string | null;
    }) =>
      z
        .object({
          title: text(140),
          body: optionalText(4000),
          kind: z.enum(["announcement", "new_lecture", "new_series", "admin_message"]),
          audienceLevelId: uuid.nullable().optional(),
          linkPath: optionalText(200),
          mediaType: z.enum(["image", "video", "audio"]).nullable().optional(),
          mediaBucket: z
            .enum(["training-videos", "training-thumbnails", "training-resources"])
            .nullable()
            .optional(),
          mediaPath: optionalText(400),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { adminNotify } = await import("./admin.server");
    return adminNotify({
      title: data.title,
      body: data.body ?? null,
      kind: data.kind,
      audienceLevelId: data.audienceLevelId ?? null,
      linkPath: data.linkPath ?? null,
      mediaType: data.mediaType ?? null,
      mediaBucket: data.mediaBucket ?? null,
      mediaPath: data.mediaPath ?? null,
    });
  });

export const adminGetSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("platform_settings").select("key, value");
  return { settings: data ?? [] };
});

export const adminSaveSetting = createServerFn({ method: "POST" })
  .inputValidator((data: { key: string; value: Record<string, unknown> }) =>
    z
      .object({ key: text(60), value: z.record(z.string(), z.unknown()) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("platform_settings")
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** ---------- Reels (admin) ---------- */

export const adminGetReels = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const [{ data }, { data: likeRows }, { data: commentRows }] = await Promise.all([
    admin
      .from("reels")
      .select(
        "id, title, caption, base_likes, video_source, created_by_admin, is_published, created_at, author:created_by (full_name, member_id)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("reel_likes").select("reel_id"),
    admin.from("reel_comments").select("reel_id, status"),
  ]);
  const likes = new Map<string, number>();
  for (const row of (likeRows ?? []) as any[])
    likes.set(row.reel_id, (likes.get(row.reel_id) ?? 0) + 1);
  const pending = new Map<string, number>();
  for (const row of (commentRows ?? []) as any[])
    if (row.status === "pending") pending.set(row.reel_id, (pending.get(row.reel_id) ?? 0) + 1);

  const reels = ((data ?? []) as any[]).map((reel) => ({
    ...reel,
    real_likes: likes.get(reel.id) ?? 0,
    total_likes: (reel.base_likes ?? 0) + (likes.get(reel.id) ?? 0),
    pending_comments: pending.get(reel.id) ?? 0,
  }));
  return { reels };
});

export const adminSaveReel = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      title: string;
      caption?: string | null;
      videoPath: string;
      thumbnailPath?: string | null;
      baseLikes?: number;
    }) =>
      z
        .object({
          title: text(140),
          caption: optionalText(600),
          videoPath: text(400),
          thumbnailPath: optionalText(400),
          baseLikes: z.number().int().min(0).max(1_000_000).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("reels").insert({
      title: data.title,
      caption: data.caption,
      base_likes: data.baseLikes ?? 0,
      video_source: "upload",
      video_path: data.videoPath,
      video_url: null,
      thumbnail_path: data.thumbnailPath,
      created_by_admin: true,
      is_published: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Edits an existing reel: caption, title and the like count it starts from. */
export const adminUpdateReel = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; title: string; caption?: string | null; baseLikes: number }) =>
    z
      .object({
        id: uuid,
        title: text(140),
        caption: optionalText(600),
        baseLikes: z.number().int().min(0).max(1_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("reels")
      .update({
        title: data.title,
        caption: data.caption,
        base_likes: data.baseLikes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Approves (publishes) or unpublishes a reel a member uploaded. */
export const adminSetReelPublished = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; publish: boolean }) =>
    z.object({ id: uuid, publish: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("reels")
      .update({ is_published: data.publish, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Comment moderation queue: nothing reaches other members until it is approved. */
export const adminGetReelComments = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("reel_comments")
    .select("id, reel_id, author_name, body, status, created_at, reel:reel_id (title)")
    .order("created_at", { ascending: false })
    .limit(300);
  return { comments: data ?? [] };
});

export const adminModerateReelComment = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: "approved" | "rejected" | "pending"; body?: string }) =>
    z
      .object({
        id: uuid,
        status: z.enum(["approved", "rejected", "pending"]),
        body: z.string().trim().min(1).max(600).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.body) payload["body"] = data.body;
    const { error } = await (supabaseAdmin as any)
      .from("reel_comments")
      .update(payload)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteReelComment = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("reel_comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


export const adminDeleteReel = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("reels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Beginners Training Sessions (opened with a session code, no login) */
/* ------------------------------------------------------------------ */

export const adminGetSessions = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("beginner_sessions")
    .select(
      "id, session_code, title, description, video_source, video_path, video_url, thumbnail_path, aspect_ratio, sort_order, is_published, created_at",
    )
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(200);
  return { sessions: data ?? [] };
});

export const adminSaveSession = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id?: string;
      sessionCode: string;
      title: string;
      description?: string | null;
      videoPath?: string | null;
      videoUrl?: string | null;
      thumbnailPath?: string | null;
      aspectRatio?: string;
      sortOrder?: number;
      isPublished: boolean;
    }) =>
      z
        .object({
          id: uuid.optional(),
          sessionCode: z
            .string()
            .trim()
            .min(4, "Use at least 4 characters")
            .max(40)
            .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only")
            .transform((v) => v.toUpperCase()),
          title: text(160),
          description: optionalText(4000),
          videoPath: optionalText(400),
          videoUrl: optionalText(600),
          thumbnailPath: optionalText(400),
          aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3"]).optional(),
          sortOrder: z.number().int().min(0).max(999).optional(),
          isPublished: z.boolean(),
        })
        .refine((v) => Boolean(v.id || v.videoPath || v.videoUrl), {
          message: "Upload a video file or paste a video link.",
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload: Record<string, unknown> = {
      session_code: data.sessionCode,
      title: data.title,
      description: data.description,
      aspect_ratio: data.aspectRatio ?? "16:9",
      sort_order: data.sortOrder ?? 0,
      is_published: data.isPublished,
    };
    if (data.videoPath) {
      payload["video_path"] = data.videoPath;
      payload["video_url"] = null;
      payload["video_source"] = "upload";
    } else if (data.videoUrl) {
      payload["video_url"] = data.videoUrl;
      payload["video_path"] = null;
      payload["video_source"] = "external";
    }
    if (data.thumbnailPath) payload["thumbnail_path"] = data.thumbnailPath;

    const query = data.id
      ? (supabaseAdmin as any).from("beginner_sessions").update(payload).eq("id", data.id)
      : (supabaseAdmin as any).from("beginner_sessions").insert(payload);
    const { error } = await query;
    if (error) {
      throw new Error(
        error.code === "23505" || /duplicate key/i.test(error.message)
          ? "That session code is already in use."
          : error.message,
      );
    }
    return { ok: true as const };
  });

export const adminDeleteSession = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("beginner_sessions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* WhatsApp groups (unlocked on the landing page with a join code)     */
/* ------------------------------------------------------------------ */

export const adminGetWhatsappGroups = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("whatsapp_groups")
    .select("id, join_code, title, description, invite_url, sort_order, is_published, created_at")
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(200);
  return { groups: data ?? [] };
});

export const adminSaveWhatsappGroup = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id?: string;
      joinCode: string;
      title: string;
      description?: string | null;
      inviteUrl: string;
      sortOrder?: number;
      isPublished: boolean;
    }) =>
      z
        .object({
          id: uuid.optional(),
          joinCode: z
            .string()
            .trim()
            .min(4, "Use at least 4 characters")
            .max(40)
            .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only")
            .transform((v) => v.toUpperCase()),
          title: text(160),
          description: optionalText(4000),
          inviteUrl: z
            .string()
            .trim()
            .url("Paste the full WhatsApp invite link")
            .max(600)
            .refine((v) => /chat\.whatsapp\.com\//i.test(v), {
              message: "Use a https://chat.whatsapp.com/... invite link",
            }),
          sortOrder: z.number().int().min(0).max(999).optional(),
          isPublished: z.boolean(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      join_code: data.joinCode,
      title: data.title,
      description: data.description,
      invite_url: data.inviteUrl,
      sort_order: data.sortOrder ?? 0,
      is_published: data.isPublished,
    };

    const query = data.id
      ? (supabaseAdmin as any).from("whatsapp_groups").update(payload).eq("id", data.id)
      : (supabaseAdmin as any).from("whatsapp_groups").insert(payload);
    const { error } = await query;
    if (error) {
      throw new Error(
        error.code === "23505" || /duplicate key/i.test(error.message)
          ? "That group code is already in use."
          : error.message,
      );
    }
    return { ok: true as const };
  });

export const adminDeleteWhatsappGroup = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("whatsapp_groups")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Extra videos attached to one beginners session                      */
/* ------------------------------------------------------------------ */

export const adminGetSessionExtras = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) => z.object({ sessionId: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await (supabaseAdmin as any)
      .from("beginner_session_extras")
      .select(
        "id, session_id, section_id, title, description, kind, file_bucket, video_source, video_path, video_url, thumbnail_path, aspect_ratio, sort_order, is_published, created_at",
      )
      .eq("session_id", data.sessionId)
      .order("sort_order")
      .order("created_at", { ascending: true });
    const { data: sections } = await (supabaseAdmin as any)
      .from("content_sections")
      .select("id, name, thumbnail_path, sort_order, is_published")
      .eq("scope", "session")
      .eq("session_id", data.sessionId)
      .order("sort_order");
    return { extras: rows ?? [], sections: sections ?? [] };
  });

export const adminSaveSessionExtra = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id?: string;
      sessionId: string;
      sectionId?: string | null;
      title: string;
      description?: string | null;
      kind?: string;
      filePath?: string | null;
      fileBucket?: string | null;
      linkUrl?: string | null;
      thumbnailPath?: string | null;
      aspectRatio?: string;
      sortOrder?: number;
      isPublished: boolean;
    }) =>
      z
        .object({
          id: uuid.optional(),
          sessionId: uuid,
          title: text(160),
          description: optionalText(2000),
          kind: z.enum(["video", "image", "pdf", "link"]).optional(),
          filePath: optionalText(400),
          fileBucket: optionalText(120),
          linkUrl: optionalText(600),
          thumbnailPath: optionalText(400),
          aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3"]).optional(),
          sortOrder: z.number().int().min(0).max(999).optional(),
          isPublished: z.boolean(),
        })
        .refine((v) => Boolean(v.id || v.filePath || v.linkUrl), {
          message: "Upload a file or paste a link.",
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload: Record<string, unknown> = {
      session_id: data.sessionId,
      title: data.title,
      description: data.description,
      aspect_ratio: data.aspectRatio ?? "16:9",
      sort_order: data.sortOrder ?? 0,
      is_published: data.isPublished,
    };
    if (data.kind) payload["kind"] = data.kind;
    if (data.filePath) {
      payload["video_path"] = data.filePath;
      payload["file_bucket"] = data.fileBucket ?? null;
      payload["video_url"] = null;
      payload["video_source"] = "upload";
    } else if (data.linkUrl) {
      payload["video_url"] = data.linkUrl;
      payload["video_path"] = null;
      payload["file_bucket"] = null;
      payload["video_source"] = "external";
    }
    if (data.thumbnailPath) payload["thumbnail_path"] = data.thumbnailPath;

    const query = data.id
      ? (supabaseAdmin as any).from("beginner_session_extras").update(payload).eq("id", data.id)
      : (supabaseAdmin as any).from("beginner_session_extras").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteSessionExtra = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("beginner_session_extras")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
