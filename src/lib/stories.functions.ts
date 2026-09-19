import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const uuid = z.string().uuid();

const STORY_BUCKETS = ["training-videos", "training-thumbnails", "training-resources"] as const;

/**
 * Stories behave like WhatsApp / Instagram status: an admin posts text, a
 * picture or a video and it disappears on its own after the chosen hours.
 * Reading is public so both dashboards (and even the landing page) can show
 * the glowing ring on the Skyline logo.
 */
export const getActiveStories = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { signPath } = await import("./storage.server");

  const { data } = await (supabaseAdmin as any)
    .from("stories")
    .select("id, kind, caption, text_body, background, media_bucket, media_path, created_at, expires_at")
    .eq("is_published", true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(30);

  const rows = (data ?? []) as any[];
  const items = await Promise.all(
    rows.map(async (row) => ({
      id: row.id as string,
      kind: row.kind as "text" | "image" | "video",
      caption: (row.caption ?? null) as string | null,
      textBody: (row.text_body ?? null) as string | null,
      background: (row.background ?? null) as string | null,
      createdAt: row.created_at as string,
      mediaUrl: row.media_path
        ? await signPath(row.media_bucket ?? "training-thumbnails", row.media_path, 60 * 60 * 6)
        : null,
    })),
  );
  return { items };
});

export const adminGetStories = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { signPath } = await import("./storage.server");

  const { data } = await (supabaseAdmin as any)
    .from("stories")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = (data ?? []) as any[];
  const stories = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      media_url: row.media_path
        ? await signPath(row.media_bucket ?? "training-thumbnails", row.media_path, 60 * 60 * 6)
        : null,
      live: row.is_published && new Date(row.expires_at).getTime() > Date.now(),
    })),
  );
  return { stories };
});

export const adminSaveStory = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id?: string;
      kind: "text" | "image" | "video";
      caption?: string | null;
      textBody?: string | null;
      background?: string | null;
      mediaBucket?: string | null;
      mediaPath?: string | null;
      hours: number;
      isPublished: boolean;
    }) =>
      z
        .object({
          id: uuid.optional(),
          kind: z.enum(["text", "image", "video"]),
          caption: z.string().trim().max(300).nullable().optional(),
          textBody: z.string().trim().max(600).nullable().optional(),
          background: z.string().trim().max(80).nullable().optional(),
          mediaBucket: z.enum(STORY_BUCKETS).nullable().optional(),
          mediaPath: z.string().trim().max(400).nullable().optional(),
          hours: z.number().int().min(1).max(168),
          isPublished: z.boolean(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.kind === "text" && !data.textBody) throw new Error("Write the story text first.");
    if (data.kind !== "text" && !data.mediaPath && !data.id) {
      throw new Error("Choose a picture or video for this story.");
    }

    const patch: Record<string, unknown> = {
      kind: data.kind,
      caption: data.caption ?? null,
      text_body: data.textBody ?? null,
      background: data.background ?? null,
      is_published: data.isPublished,
    };
    if (data.mediaPath) {
      patch["media_path"] = data.mediaPath;
      patch["media_bucket"] = data.mediaBucket ?? "training-thumbnails";
    }

    if (data.id) {
      const { error } = await (supabaseAdmin as any)
        .from("stories")
        .update(patch)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }

    patch["expires_at"] = new Date(Date.now() + data.hours * 3600_000).toISOString();
    const { error } = await (supabaseAdmin as any).from("stories").insert(patch);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteStory = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("stories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
