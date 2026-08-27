import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Short vertical clips, visible to every active member. */
export const getReels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const [{ data }, manager] = await Promise.all([
      db
        .from("reels")
        .select(
          "id, title, caption, video_source, video_path, video_url, thumbnail_path, created_by, created_by_admin, created_at, author:created_by (full_name, member_id)",
        )
        .order("created_at", { ascending: false })
        .limit(60),
      db.rpc("is_manager_member"),
    ]);

    const { signPath, VIDEO_BUCKET, THUMBNAIL_BUCKET } = await import("./storage.server");
    const reels = await Promise.all(
      (data ?? []).map(async (reel: any) => ({
        id: reel.id,
        title: reel.title,
        caption: reel.caption,
        createdAt: reel.created_at,
        isMine: reel.created_by === context.userId,
        authorName: reel.created_by_admin
          ? "Skyline Achievers"
          : (reel.author?.full_name ?? "Skyline Achievers"),
        posterUrl: await signPath(THUMBNAIL_BUCKET, reel.thumbnail_path, 60 * 60 * 6),
        url:
          reel.video_source === "external"
            ? reel.video_url
            : await signPath(VIDEO_BUCKET, reel.video_path, 60 * 60 * 4),
      })),
    );
    return { reels, isManager: manager?.data === true };
  });

/** Managers may upload their own reel video / cover. */
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
    const { data: isManager } = await db.rpc("is_manager_member");
    if (isManager !== true) throw new Error("Only Manager rank members can post reels.");
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
      videoPath?: string | null;
      videoUrl?: string | null;
      thumbnailPath?: string | null;
    }) =>
      z
        .object({
          title: z.string().trim().min(1).max(140),
          caption: z.string().trim().max(600).nullable().optional(),
          videoPath: z.string().trim().max(400).nullable().optional(),
          videoUrl: z.string().trim().url().max(600).nullable().optional(),
          thumbnailPath: z.string().trim().max(400).nullable().optional(),
        })
        .refine((v) => Boolean(v.videoPath || v.videoUrl), {
          message: "Upload a video file or paste a video link.",
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    // Row level security additionally enforces the Manager rank requirement.
    const { error } = await db.from("reels").insert({
      title: data.title,
      caption: data.caption ?? null,
      video_source: data.videoPath ? "upload" : "external",
      video_path: data.videoPath ?? null,
      video_url: data.videoUrl ?? null,
      thumbnail_path: data.thumbnailPath ?? null,
      created_by: context.userId,
      created_by_admin: false,
      is_published: true,
    });
    if (error) throw new Error("Only Manager rank members can post reels.");
    return { ok: true as const };
  });

export const deleteReel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { error } = await db.from("reels").delete().eq("id", data.id).eq("created_by", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
