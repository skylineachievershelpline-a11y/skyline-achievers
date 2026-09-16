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

/** Published testimonials, with secure playback links for uploaded videos. */
export const getLandingReviews = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { signPath, VIDEO_BUCKET } = await import("./storage.server");
  const { data, error } = await supabaseAdmin
    .from("landing_reviews")
    .select(
      "id, person_name, designation, review_text, rating, video_source, video_path, video_url, aspect_ratio",
    )
    .eq("status", "approved")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw new Error(error.message);

  const reviews = await Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      personName: row.person_name,
      designation: row.designation,
      reviewText: row.review_text,
      rating: row.rating,
      aspectRatio: row.aspect_ratio ?? "16:9",
      videoUrl:
        row.video_source === "external"
          ? row.video_url
          : await signPath(VIDEO_BUCKET, row.video_path, 60 * 60 * 6),
    })),
  );
  return { reviews };
});