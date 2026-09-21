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
    const { loadMemberContext, loadTrainingVideos, loadContinueWatching } = await import(
      "./member.server"
    );

    const member = await loadMemberContext(db, context.userId);
    if (!member || member.status !== "active") {
      return { member, blocked: true as const, videos: [], continueWatching: [] };
    }

    const [videos, continueWatching] = await Promise.all([
      loadTrainingVideos(db, 60),
      loadContinueWatching(db, context.userId),
    ]);

    return { member, blocked: false as const, videos, continueWatching };
  });

/** Every training video unlocked for this member. */
export const getTrainingVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadTrainingVideos } = await import("./member.server");
    return { videos: await loadTrainingVideos(context.supabase as never, 200) };
  });

/**
 * The whole training library: every published video is visible so members can
 * see what is waiting for them, but videos their rank cannot open are locked.
 */
export const getTrainingLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signThumbnails } = await import("./storage.server");
    const { loadMemberContext } = await import("./member.server");

    const member = await loadMemberContext(context.supabase as never, context.userId);
    if (!member || member.status !== "active") return { videos: [], categories: [] };

    const [
      { data: lectures },
      { data: access },
      { data: categories },
      { data: groups },
      { data: sectionAccess },
    ] = await Promise.all([
        supabaseAdmin
          .from("lectures")
          .select(
            "id, title, description, duration_seconds, thumbnail_path, sort_order, created_at, category_id, levels:level_id (id, name, slug, rank_order)",
          )
          .eq("is_published", true)
          .eq("is_archived", false)
          .order("sort_order")
          .order("created_at", { ascending: false })
          .limit(300),
        member.level
          ? supabaseAdmin
              .from("content_access")
              .select("content_id")
              .eq("content_type", "lecture")
              .eq("level_id", member.level.id)
          : Promise.resolve({ data: [] as { content_id: string }[] }),
        (supabaseAdmin as any)
          .from("training_categories")
          .select("id, name, slug, description, sort_order, group_id")
          .eq("is_published", true)
          .order("sort_order"),
        (supabaseAdmin as any)
          .from("training_groups")
          .select("id, name, slug, description, sort_order")
          .eq("is_published", true)
          .order("sort_order"),
      (supabaseAdmin as any).from("training_category_access").select("category_id, level_id"),
    ]);

    const allowed = new Set((access ?? []).map((row) => row.content_id));
    const signed = await signThumbnails(lectures ?? []);

    // A section with no access list stays open to everyone; once ranks are
    // picked, only those ranks may open it.
    const sectionLevels = new Map<string, string[]>();
    for (const row of (sectionAccess ?? []) as { category_id: string; level_id: string }[]) {
      sectionLevels.set(row.category_id, [
        ...(sectionLevels.get(row.category_id) ?? []),
        row.level_id,
      ]);
    }
    // Categories are only an admin-side organizer now. Members see training
    // sections directly, so category access must not hide a section from the
    // Training page; section/video access below remains the source of truth.
    const visibleGroups = (groups ?? []) as any[];

    // A rank that sits above an unlocked rank keeps the section: whatever a
    // junior rank can open, a senior rank can open too.
    const { data: levelRows } = await (supabaseAdmin as any)
      .from("levels")
      .select("id, rank_order");
    const rankOf = new Map<string, number>(
      ((levelRows ?? []) as { id: string; rank_order: number }[]).map((row) => [
        row.id,
        row.rank_order,
      ]),
    );
    const myRank = member.level ? (rankOf.get(member.level.id) ?? null) : null;

    const visibleCategories = ((categories ?? []) as any[]).filter((category) => {
      const list = sectionLevels.get(category.id);
      if (!list || list.length === 0) return true;
      if (!member.level) return false;
      if (list.includes(member.level.id)) return true;
      if (myRank === null) return false;
      const ranks = list.map((id) => rankOf.get(id)).filter((r): r is number => r != null);
      return ranks.length > 0 && myRank >= Math.min(...ranks);
    });

    const visibleIds = new Set(visibleCategories.map((c) => c.id));

    return {
      groups: visibleGroups as {
        id: string;
        name: string;
        slug: string;
        description: string | null;
      }[],
      categories: visibleCategories as {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        group_id: string | null;
      }[],
      videos: signed
        .filter((video: any) => !video.category_id || visibleIds.has(video.category_id))
        .map((video: any) => ({ ...video, locked: !allowed.has(video.id) })),
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
        "id, title, description, duration_seconds, aspect_ratio, video_source, video_path, video_url, level_id, levels:level_id (id, name, slug)",
      )
      .eq("id", data.lectureId)
      .maybeSingle();
    if (!lecture) return { lecture: null, playback: null, resources: [], position: 0, siblings: [] };

    // Other videos from the same training level.
    const siblingsPromise = lecture.level_id
      ? db
          .from("lectures")
          .select("id, title, duration_seconds, sort_order")
          .eq("level_id", lecture.level_id)
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
    const { signThumbnails } = await import("./storage.server");
    const { signPath, THUMBNAIL_BUCKET } = await import("./storage.server");
    const [{ data }, { data: sectionRows }] = await Promise.all([
      db
        .from("resources")
        .select(
          "id, title, description, resource_type, section_id, thumbnail_path, created_at, lectures:lecture_id (id, title)",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("content_sections")
        .select("id, name, thumbnail_path, sort_order")
        .eq("scope", "resource")
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
    ]);
    const sections = await Promise.all(
      (sectionRows ?? []).map(async (row: any) => ({
        id: row.id as string,
        name: row.name as string,
        thumbnailUrl: await signPath(THUMBNAIL_BUCKET, row.thumbnail_path, 60 * 60 * 4),
      })),
    );
    return { resources: await signThumbnails(data ?? []), sections };
  });

/**
 * Public preview of one resource. Anybody holding the shared link can open the
 * item itself (PDF, picture, voice note, link or note) without an account.
 */
export const getSharedResource = createServerFn({ method: "GET" })
  .inputValidator((data: { resourceId: string }) =>
    z.object({ resourceId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath, RESOURCE_BUCKET, THUMBNAIL_BUCKET } = await import("./storage.server");
    const { data: resource } = await (supabaseAdmin as any)
      .from("resources")
      .select(
        "id, title, description, resource_type, body, external_url, storage_path, thumbnail_path, is_published",
      )
      .eq("id", data.resourceId)
      .maybeSingle();
    if (!resource || !resource.is_published) return { resource: null };
    const week = 60 * 60 * 24 * 7;
    return {
      resource: {
        id: resource.id as string,
        title: resource.title as string,
        description: (resource.description ?? null) as string | null,
        resourceType: resource.resource_type as string,
        body: (resource.body ?? null) as string | null,
        url:
          (resource.external_url as string | null) ??
          (await signPath(RESOURCE_BUCKET, resource.storage_path, week)),
        thumbnailUrl: await signPath(THUMBNAIL_BUCKET, resource.thumbnail_path, week),
      },
    };
  });


export const searchLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string }) =>
    z.object({ query: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { signThumbnails } = await import("./storage.server");
    const { tokenize, relevance, RELATED_THRESHOLD } = await import("./search-match");
    const db = context.supabase as any;
    const tokens = tokenize(data.query);

    // Everything the member may see is pulled once, then ranked by how close it
    // is to the words they typed — related topics come up too, not just exact titles.
    const [lectures, resources] = await Promise.all([
      db
        .from("lectures")
        .select(
          "id, title, description, duration_seconds, thumbnail_path, created_at, levels:level_id (id, name), training_categories:category_id (id, name)",
        )
        .limit(400),
      db
        .from("resources")
        .select(
          "id, title, description, body, resource_type, lectures:lecture_id (id, title)",
        )
        .limit(400),
    ]);

    const rankedLectures = (lectures.data ?? [])
      .map((row: any) => ({
        row,
        score: relevance(tokens, {
          fields: [
            { text: row.title, weight: 1 },
            { text: row.description, weight: 0.8 },
            { text: row.training_categories?.name, weight: 0.7 },
            { text: row.levels?.name, weight: 0.5 },
          ],
        }),
      }))
      .filter((item: any) => item.score >= RELATED_THRESHOLD)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 30);

    const rankedResources = (resources.data ?? [])
      .map((row: any) => ({
        row,
        score: relevance(tokens, {
          fields: [
            { text: row.title, weight: 1 },
            { text: row.description, weight: 0.8 },
            { text: row.body, weight: 0.5 },
            { text: row.resource_type, weight: 0.5 },
            { text: row.lectures?.title, weight: 0.6 },
          ],
        }),
      }))
      .filter((item: any) => item.score >= RELATED_THRESHOLD)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 30);

    const signed = await signThumbnails(rankedLectures.map((item: any) => item.row));

    return {
      lectures: signed.map((row: any, index: number) => ({
        ...row,
        match: rankedLectures[index]!.score >= 0.8 ? ("exact" as const) : ("related" as const),
      })),
      resources: rankedResources.map((item: any) => ({
        ...item.row,
        match: item.score >= 0.8 ? ("exact" as const) : ("related" as const),
      })),
    };
  });



/**
 * Announcements only: automatic "new video" alerts are no longer shown.
 * Anything the member deleted stays hidden for them.
 */
export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const [{ data: notifications }, { data: reads }, { data: dismissed }] = await Promise.all([
      db
        .from("notifications")
        .select("id, title, body, kind, link_path, created_at, media_type, media_bucket, media_path")
        .in("kind", ["announcement", "admin_message"])
        .order("created_at", { ascending: false })
        .limit(60),
      db.from("notification_reads").select("notification_id").eq("member_id", context.userId),
      db.from("notification_dismissals").select("notification_id").eq("member_id", context.userId),
    ]);
    const readSet = new Set((reads ?? []).map((r: { notification_id: string }) => r.notification_id));
    const hidden = new Set(
      (dismissed ?? []).map((r: { notification_id: string }) => r.notification_id),
    );
    const { signPath } = await import("./storage.server");
    const items = await Promise.all(
      (notifications ?? [])
        .filter((n: { id: string }) => !hidden.has(n.id))
        .map(async (n: any) => ({
          ...n,
          is_read: readSet.has(n.id),
          media_url: n.media_path
            ? await signPath(n.media_bucket ?? "training-resources", n.media_path, 60 * 60 * 6)
            : null,
        })),
    );
    return { items, unread: items.filter((n: { is_read: boolean }) => !n.is_read).length };
  });

/** Hides one announcement for this member only. */
export const dismissNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await db
      .from("notification_dismissals")
      .upsert(
        { notification_id: data.id, member_id: context.userId },
        { onConflict: "notification_id,member_id", ignoreDuplicates: true },
      );
    return { ok: true as const };
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

/** Saves the signed-in member's short public-facing dashboard bio. */
export const saveMemberBio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bio: string }) =>
    z.object({ bio: z.string().trim().max(240) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("member_profiles")
      .update({ bio: data.bio || null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Updates only the signed-in member's own display name. */
export const saveMemberName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fullName: string }) =>
    z.object({ fullName: z.string().trim().min(2).max(80) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("member_profiles")
      .update({ full_name: data.fullName })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, fullName: data.fullName };
  });

/** Signed upload slot for the signed-in member's dashboard cover. */
export const getDashboardCoverUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { extension: string }) =>
    z.object({ extension: z.enum(["png", "jpg", "jpeg", "webp"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${context.userId}/covers/${crypto.randomUUID()}.${data.extension}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("member-avatars")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not prepare the upload.");
    return { path: signed.path, token: signed.token, signedUrl: signed.signedUrl };
  });

/** Saves a cover path only for the authenticated member. */
export const saveDashboardCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path: string }) =>
    z.object({ path: z.string().trim().min(3).max(300) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/covers/`)) {
      throw new Error("Invalid cover upload path.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("member_profiles")
      .update({ dashboard_cover_path: data.path } as never)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
