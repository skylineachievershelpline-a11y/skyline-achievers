import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sessionCodeSchema = z
  .string()
  .trim()
  .min(4, "Enter the full session code")
  .max(40)
  .transform((value) => value.toUpperCase());

/** Lightweight public details used by social-sharing previews. */
export const getBeginnerSessionPreview = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) =>
    z.object({ code: sessionCodeSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath, THUMBNAIL_BUCKET } = await import("./storage.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("beginner_sessions")
      .select("session_code, title, description, thumbnail_path, is_published")
      .ilike("session_code", data.code)
      .maybeSingle();

    if (!row || !row.is_published || String(row.session_code).toUpperCase() !== data.code) {
      return { session: null };
    }

    return {
      session: {
        code: data.code,
        title: row.title as string,
        description: (row.description ?? null) as string | null,
        thumbnailUrl: await signPath(THUMBNAIL_BUCKET, row.thumbnail_path, 60 * 60 * 24 * 7),
      },
    };
  });

/**
 * Beginners Training Sessions are opened with a session code instead of a
 * member account. The table itself is unreachable from the browser: only this
 * server function may read it, and only after the exact code matches.
 */
export const openBeginnerSession = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) =>
    z.object({ code: sessionCodeSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath, VIDEO_BUCKET, THUMBNAIL_BUCKET } = await import("./storage.server");

    const { data: row } = await (supabaseAdmin as any)
      .from("beginner_sessions")
      .select(
        "id, session_code, title, description, video_source, video_path, video_url, thumbnail_path, aspect_ratio, duration_seconds, is_published",
      )
      .ilike("session_code", data.code)
      .maybeSingle();

    if (!row || !row.is_published || String(row.session_code).toUpperCase() !== data.code) {
      return { status: "invalid" as const };
    }

    const videoUrl =
      row.video_source === "external" && row.video_url
        ? row.video_url
        : await signPath(VIDEO_BUCKET, row.video_path, 60 * 60 * 4);

    const { loadSessionExtras } = await import("./session-extras.server");
    const extras = await loadSessionExtras(supabaseAdmin, row.id);

    return {
      status: "ok" as const,
      extras,
      session: {
        id: row.id as string,
        code: String(row.session_code).toUpperCase(),
        title: row.title as string,
        description: (row.description ?? null) as string | null,
        aspectRatio: (row.aspect_ratio ?? "16:9") as string,
        durationSeconds: (row.duration_seconds ?? null) as number | null,
        videoUrl: videoUrl as string | null,
        isExternal: row.video_source === "external",
        thumbnailUrl: await signPath(THUMBNAIL_BUCKET, row.thumbnail_path, 60 * 60 * 4),
      },
    };
  });
