import { createServerFn } from "@tanstack/react-start";

/** Returns the single published landing introduction with secure media links. */
export const getLandingIntroduction = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { signPath, THUMBNAIL_BUCKET, VIDEO_BUCKET } = await import("./storage.server");
  const { data, error } = await supabaseAdmin
    .from("landing_intro")
    .select(
      "id, title, description, video_source, video_path, video_url, thumbnail_path, aspect_ratio",
    )
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { introduction: null };

  return {
    introduction: {
      id: data.id,
      title: data.title,
      description: data.description,
      aspectRatio: data.aspect_ratio,
      videoUrl:
        data.video_source === "external"
          ? data.video_url
          : await signPath(VIDEO_BUCKET, data.video_path, 60 * 60 * 6),
      thumbnailUrl: await signPath(THUMBNAIL_BUCKET, data.thumbnail_path, 60 * 60 * 6),
    },
  };
});