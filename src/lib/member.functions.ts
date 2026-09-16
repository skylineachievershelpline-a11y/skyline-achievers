import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Which screen does this signed-in account belong to? */
export const getSessionRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member } = await supabaseAdmin
      .from("member_profiles")
      .select("id, status")
      .eq("id", context.userId)
      .maybeSingle();
    if (member) {
      return { role: "member" as const, active: member.status === "active" };
    }

    const { data: trainee } = await supabaseAdmin
      .from("trainees")
      .select("id, status")
      .eq("id", context.userId)
      .maybeSingle();
    if (trainee) {
      return { role: "trainee" as const, active: trainee.status === "active" };
    }

    return { role: "none" as const, active: false };
  });

export const getMemberSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadMemberContext } = await import("./member.server");
    const member = await loadMemberContext(context.supabase as never, context.userId);
    if (!member) return { member: null, reason: "no_profile" as const };
    if (member.status !== "active") return { member, reason: member.status as "blocked" | "removed" };
    return { member, reason: "ok" as const };
  });

export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadMemberContext } = await import("./member.server");
    const member = await loadMemberContext(context.supabase as never, context.userId);
    if (!member) return { status: "no_profile" as const, member: null };
    if (member.status !== "active") {
      return { status: member.status as "blocked" | "removed", member };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("member_profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", context.userId);
    return { status: "ok" as const, member };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as never;
    const {
      loadMemberContext,
      loadAccessibleLevels,
      loadLectureCard,
      loadContinueWatching,
      loadSeriesForLevel,
    } = await import("./member.server");

    const member = await loadMemberContext(db, context.userId);
    if (!member || member.status !== "active") {
      return {
        member,
        blocked: true as const,
        levels: [],
        continueWatching: [],
        latestLectures: [],
        mySeries: [],
        featured: null,
      };
    }

    const [levels, latestLectures, continueWatching, mySeries] = await Promise.all([
      loadAccessibleLevels(db),
      loadLectureCard(db, 12),
      loadContinueWatching(db, context.userId),
      member.level ? loadSeriesForLevel(db, member.level.id) : Promise.resolve([]),
    ]);

    return {
      member,
      blocked: false as const,
      levels,
      continueWatching,
      latestLectures,
      mySeries,
      featured: latestLectures[0] ?? null,
    };
  });

export const getTrainingLevels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadAccessibleLevels, loadMemberContext } = await import("./member.server");
    const [levels, member] = await Promise.all([
      loadAccessibleLevels(context.supabase as never),
      loadMemberContext(context.supabase as never, context.userId),
    ]);
    return { levels, member };
  });

export const getLevelDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as never;
    const { loadSeriesForLevel, loadStandaloneLecturesForLevel } = await import("./member.server");
    const { data: level } = await (db as any)
      .from("levels")
      .select("id, name, slug, description, rank_order")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!level) return { level: null, series: [], lectures: [] };
    const [series, lectures] = await Promise.all([
      loadSeriesForLevel(db, level.id),
      loadStandaloneLecturesForLevel(db, level.id),
    ]);
    return { level, series, lectures };
  });


export const getSeriesDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { seriesId: string }) =>
    z.object({ seriesId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { signThumbnails } = await import("./storage.server");
    const { data: series } = await db
      .from("series")
      .select(
        "id, title, description, thumbnail_path, level_id, levels:level_id (id, name, slug, rank_order)",
      )
      .eq("id", data.seriesId)
      .maybeSingle();
    if (!series) return { series: null, lectures: [], resources: [] };

    const [{ data: lectures }, { data: resources }] = await Promise.all([
      db
        .from("lectures")
        .select("id, title, description, duration_seconds, thumbnail_path, sort_order, created_at")
        .eq("series_id", data.seriesId)
        .order("sort_order")
        .order("created_at"),
      db
        .from("resources")
        .select("id, title, description, resource_type, sort_order")
        .eq("series_id", data.seriesId)
        .order("sort_order"),
    ]);

    const [seriesWithThumb] = await signThumbnails([series]);
    return {
      series: seriesWithThumb,
      lectures: await signThumbnails(lectures ?? []),
      resources: resources ?? [],
    };
  });

export const getLectureDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lectureId: string }) =>
    z.object({ lectureId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { resolvePlaybackUrl } = await import("./member.server");

    // Row level security only returns this lecture when the member's rank allows it.
    const { data: lecture } = await db
      .from("lectures")
      .select(
        "id, title, description, duration_seconds, aspect_ratio, video_source, video_path, video_url, series_id, level_id, series:series_id (id, title, description, levels:level_id (id, name, slug)), levels:level_id (id, name, slug)",
      )
      .eq("id", data.lectureId)
      .maybeSingle();
    if (!lecture) return { lecture: null, playback: null, resources: [], position: 0, siblings: [] };

    // Siblings come from the parent series, or from the level for standalone lectures.
    const siblingQuery = db.from("lectures").select("id, title, duration_seconds, sort_order");
    const siblingsPromise = lecture.series_id
      ? siblingQuery.eq("series_id", lecture.series_id).order("sort_order").order("created_at")
      : lecture.level_id
        ? siblingQuery
            .eq("level_id", lecture.level_id)
            .is("series_id", null)
            .order("sort_order")
            .order("created_at")
        : Promise.resolve({ data: [] as any[] });

    const [{ data: resources }, { data: position }, { data: siblings }] = await Promise.all([
      db
        .from("resources")
        .select("id, title, description, resource_type, sort_order, body")
        .eq("lecture_id", data.lectureId)
        .order("sort_order"),
      db
        .from("watch_positions")
        .select("position_seconds")
        .eq("lecture_id", data.lectureId)
        .eq("member_id", context.userId)
        .maybeSingle(),
      siblingsPromise,
    ]);


    const playback = await resolvePlaybackUrl(lecture);
    return {
      lecture,
      playback,
      resources: resources ?? [],
      position: position?.position_seconds ?? 0,
      siblings: siblings ?? [],
    };
  });

export const saveWatchPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lectureId: string; seconds: number }) =>
    z
      .object({ lectureId: z.string().uuid(), seconds: z.number().int().min(0).max(60 * 60 * 24) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { error } = await db.from("watch_positions").upsert(
      {
        member_id: context.userId,
        lecture_id: data.lectureId,
        position_seconds: Math.floor(data.seconds),
      },
      { onConflict: "member_id,lecture_id" },
    );
    if (error) return { ok: false as const };
    return { ok: true as const };
  });

export const getResourceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { resourceId: string }) =>
    z.object({ resourceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { resolveResourceUrl } = await import("./member.server");
    const { data: resource } = await db
      .from("resources")
      .select("id, resource_type, storage_path, external_url")
      .eq("id", data.resourceId)
      .maybeSingle();
    if (!resource) return { url: null };
    return { url: await resolveResourceUrl(resource) };
  });

export const getMemberResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data } = await db
      .from("resources")
      .select(
        "id, title, description, resource_type, created_at, lectures:lecture_id (id, title), series:series_id (id, title)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    return { resources: data ?? [] };
  });

export const searchLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string }) =>
    z.object({ query: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const term = `%${data.query.replace(/[%_]/g, "")}%`;
    const [levels, series, lectures, resources] = await Promise.all([
      db.from("levels").select("id, name, slug, description").ilike("name", term).limit(6),
      db
        .from("series")
        .select("id, title, description, levels:level_id (name, slug)")
        .ilike("title", term)
        .limit(12),
      db
        .from("lectures")
        .select("id, title, duration_seconds, series:series_id (id, title, levels:level_id (name))")
        .ilike("title", term)
        .limit(20),
      db
        .from("resources")
        .select("id, title, resource_type, lectures:lecture_id (id, title), series:series_id (id, title)")
        .ilike("title", term)
        .limit(20),
    ]);
    return {
      levels: levels.data ?? [],
      series: series.data ?? [],
      lectures: lectures.data ?? [],
      resources: resources.data ?? [],
    };
  });

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const [{ data: notifications }, { data: reads }] = await Promise.all([
      db
        .from("notifications")
        .select("id, title, body, kind, link_path, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      db.from("notification_reads").select("notification_id").eq("member_id", context.userId),
    ]);
    const readSet = new Set((reads ?? []).map((r: { notification_id: string }) => r.notification_id));
    const items = (notifications ?? []).map((n: { id: string }) => ({
      ...n,
      is_read: readSet.has(n.id),
    }));
    return { items, unread: items.filter((n: { is_read: boolean }) => !n.is_read).length };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.ids.length === 0) return { ok: true as const };
    const db = context.supabase as any;
    await db.from("notification_reads").upsert(
      data.ids.map((id) => ({ notification_id: id, member_id: context.userId })),
      { onConflict: "notification_id,member_id", ignoreDuplicates: true },
    );
    return { ok: true as const };
  });
/** Signed upload slot for the member's own profile picture. */
export const getAvatarUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { extension: string }) =>
    z.object({ extension: z.enum(["png", "jpg", "jpeg", "webp"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${context.userId}/${crypto.randomUUID()}.${data.extension}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("member-avatars")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not prepare the upload.");
    return { path: signed.path, token: signed.token, signedUrl: signed.signedUrl };
  });

/** Stores the uploaded picture against the caller's own profile only. */
export const saveAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path: string }) =>
    z.object({ path: z.string().trim().min(3).max(300) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`)) throw new Error("Invalid upload path.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("member_profiles")
      .update({ avatar_path: data.path } as never)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
