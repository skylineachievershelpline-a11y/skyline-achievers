import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** A member may watch this many reels per day — the feed is about value, not scrolling. */
export const DAILY_REEL_LIMIT = 15;

/** Start of the current day in Pakistan time (UTC+5), as an ISO timestamp. */
function startOfLocalDay(): string {
  const now = Date.now();
  const offset = 5 * 60 * 60 * 1000;
  const local = new Date(now + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset).toISOString();
}

function shuffle<T>(items: T[]): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j] as T, list[i] as T];
  }
  return list;
}

async function viewerName(admin: any, userId: string): Promise<string> {
  const { data: member } = await admin
    .from("member_profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  if (member?.full_name) return member.full_name as string;
  const { data: trainee } = await admin
    .from("trainees")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return (trainee?.full_name as string) ?? "Skyline member";
}

/**
 * The reel feed: a fresh, shuffled set every visit, capped per day so the
 * platform informs without eating the member's time.
 */
export const getReels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [{ data: rows }, manager, canPost, { data: views }, { data: likes }, { data: saves }] =
      await Promise.all([
        db
          .from("reels")
          .select(
            "id, title, caption, video_source, video_path, video_url, thumbnail_path, base_likes, created_by, created_by_admin, created_at, author:created_by (full_name, member_id)",
          )
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(200),
        db.rpc("is_manager_member"),
        db.rpc("can_post_reels"),
        admin.from("reel_views").select("reel_id, seen_at").eq("viewer_id", context.userId),
        admin.from("reel_likes").select("reel_id").eq("viewer_id", context.userId),
        admin.from("reel_saves").select("reel_id").eq("viewer_id", context.userId),
      ]);

    const dayStart = startOfLocalDay();
    const seenToday = (views ?? []).filter((v: any) => v.seen_at >= dayStart).length;

    const seenAt = new Map<string, string>((views ?? []).map((v: any) => [v.reel_id, v.seen_at]));
    const published = (rows ?? []) as any[];
    const fresh = shuffle(published.filter((r) => !seenAt.has(r.id)));
    const repeats = published
      .filter((r) => seenAt.has(r.id))
      .sort((a, b) => String(seenAt.get(a.id)).localeCompare(String(seenAt.get(b.id))));
    // No daily cap: members may watch as many reels as they like.
    const picked = [...fresh, ...repeats];

    const likedSet = new Set((likes ?? []).map((l: any) => l.reel_id));
    const savedSet = new Set((saves ?? []).map((s: any) => s.reel_id));

    const ids = picked.map((r) => r.id);
    const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
      ids.length ? admin.from("reel_likes").select("reel_id").in("reel_id", ids) : { data: [] },
      ids.length
        ? admin.from("reel_comments").select("reel_id").eq("status", "approved").in("reel_id", ids)
        : { data: [] },
    ]);
    const likeCount = new Map<string, number>();
    for (const row of (likeRows ?? []) as any[])
      likeCount.set(row.reel_id, (likeCount.get(row.reel_id) ?? 0) + 1);
    const commentCount = new Map<string, number>();
    for (const row of (commentRows ?? []) as any[])
      commentCount.set(row.reel_id, (commentCount.get(row.reel_id) ?? 0) + 1);

    const { signPath, VIDEO_BUCKET, THUMBNAIL_BUCKET } = await import("./storage.server");
    const { loadReelAuthors } = await import("./reels.server");
    const authors = await loadReelAuthors(
      picked.filter((r) => !r.created_by_admin).map((r) => r.created_by as string),
    );
    const reels = await Promise.all(
      picked.map(async (reel: any) => {
        const author = reel.created_by_admin ? null : authors.get(reel.created_by as string);
        return {
          id: reel.id as string,
          title: reel.title as string,
          caption: (reel.caption ?? null) as string | null,
          createdAt: reel.created_at as string,
          isMine: reel.created_by === context.userId,
          verified: reel.created_by_admin === true,
          authorName: reel.created_by_admin
            ? "Skyline Achievers"
            : (author?.name ?? (reel.author?.full_name as string) ?? "Skyline Achievers"),
          authorAvatarUrl: author?.avatarUrl ?? null,
          authorRank: author?.rank ?? null,
          likes: (reel.base_likes ?? 0) + (likeCount.get(reel.id) ?? 0),
          comments: commentCount.get(reel.id) ?? 0,
          liked: likedSet.has(reel.id),
          saved: savedSet.has(reel.id),
          posterUrl: await signPath(THUMBNAIL_BUCKET, reel.thumbnail_path, 60 * 60 * 6),
          url:
            reel.video_source === "external"
              ? (reel.video_url as string | null)
              : await signPath(VIDEO_BUCKET, reel.video_path, 60 * 60 * 4),
        };
      }),
    );

    return {
      reels,
      isManager: manager?.data === true,
      canPost: canPost?.data === true,
      dailyLimit: null,
      watchedToday: seenToday,
      remaining: picked.length,
      limitReached: false,
    };
  });

/** Counts a reel against today's allowance once it is actually watched. */
export const markReelSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("reel_views")
      .upsert(
        { reel_id: data.id, viewer_id: context.userId, seen_at: new Date().toISOString() },
        { onConflict: "reel_id,viewer_id" },
      );
    return { ok: true as const };
  });

export const toggleReelLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: existing } = await admin
      .from("reel_likes")
      .select("id")
      .eq("reel_id", data.id)
      .eq("viewer_id", context.userId)
      .maybeSingle();
    if (existing) {
      await admin.from("reel_likes").delete().eq("id", existing.id);
      return { liked: false as const };
    }
    await admin.from("reel_likes").insert({ reel_id: data.id, viewer_id: context.userId });
    return { liked: true as const };
  });

export const toggleReelSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: existing } = await admin
      .from("reel_saves")
      .select("id")
      .eq("reel_id", data.id)
      .eq("viewer_id", context.userId)
      .maybeSingle();
    if (existing) {
      await admin.from("reel_saves").delete().eq("id", existing.id);
      return { saved: false as const };
    }
    await admin.from("reel_saves").insert({ reel_id: data.id, viewer_id: context.userId });
    return { saved: true as const };
  });

/** Approved comments for everyone, plus the viewer's own pending ones. */
export const getReelComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await (supabaseAdmin as any)
      .from("reel_comments")
      .select("id, author_id, author_name, body, status, created_at")
      .eq("reel_id", data.id)
      .neq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(200);
    const comments = ((rows ?? []) as any[])
      .filter((row) => row.status === "approved" || row.author_id === context.userId)
      .map((row) => ({
        id: row.id as string,
        authorName: row.author_name as string,
        body: row.body as string,
        createdAt: row.created_at as string,
        pending: row.status !== "approved",
        isMine: row.author_id === context.userId,
      }));
    return { comments };
  });

export const addReelComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; body: string }) =>
    z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(600) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const name = await viewerName(admin, context.userId);
    const { error } = await admin.from("reel_comments").insert({
      reel_id: data.id,
      author_id: context.userId,
      author_name: name,
      body: data.body,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Ranked members (Assistant Supervisor and above) may upload their own reel. */
export const getReelUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind: "video" | "cover"; extension: string }) =>
    z
      .object({
        kind: z.enum(["video", "cover"]),
        extension: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9]{1,8}$/),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: allowed } = await db.rpc("can_post_reels");
    if (allowed !== true)
      throw new Error("Assistant Supervisor rank and above can post reels.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = data.kind === "video" ? "training-videos" : "training-thumbnails";
    const path = `reels/${context.userId}/${crypto.randomUUID()}.${data.extension}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not prepare the upload.");
    return { path: signed.path, signedUrl: signed.signedUrl };
  });

export const createReel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      title: string;
      caption?: string | null;
      videoPath: string;
      thumbnailPath?: string | null;
    }) =>
      z
        .object({
          title: z.string().trim().min(1).max(140),
          caption: z.string().trim().max(600).nullable().optional(),
          videoPath: z.string().trim().min(1).max(400),
          thumbnailPath: z.string().trim().max(400).nullable().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    // Row level security additionally enforces the rank requirement.
    const { error } = await db.from("reels").insert({
      title: data.title,
      caption: data.caption ?? null,
      video_source: "upload",
      video_path: data.videoPath,
      video_url: null,
      thumbnail_path: data.thumbnailPath ?? null,
      created_by: context.userId,
      created_by_admin: false,
      // Member reels always wait for admin approval before anyone can see them.
      is_published: false,
    });
    if (error) throw new Error("Assistant Supervisor rank and above can post reels.");
    return { ok: true as const };
  });

export const deleteReel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { error } = await db
      .from("reels")
      .delete()
      .eq("id", data.id)
      .eq("created_by", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
