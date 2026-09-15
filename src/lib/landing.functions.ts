import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const uuid = z.string().uuid();
const clean = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((value) => value || null);

export const getLandingContent = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { signPath, THUMBNAIL_BUCKET, VIDEO_BUCKET } = await import("./storage.server");
  const [{ data: intro }, { data: quotes }, { data: reviews }] = await Promise.all([
    (supabaseAdmin as any).from("landing_intro").select("*").eq("is_active", true).limit(1).maybeSingle(),
    (supabaseAdmin as any).from("landing_quotes").select("*").eq("is_active", true).order("sort_order"),
    (supabaseAdmin as any)
      .from("landing_reviews")
      .select("*")
      .eq("status", "approved")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return {
    intro: intro
      ? {
          ...intro,
          video_signed_url:
            intro.video_source === "upload"
              ? await signPath(VIDEO_BUCKET, intro.video_path, 60 * 60 * 6)
              : intro.video_url,
          thumbnail_url: await signPath(THUMBNAIL_BUCKET, intro.thumbnail_path, 60 * 60 * 6),
        }
      : null,
    quotes: quotes ?? [],
    reviews: await Promise.all(
      (reviews ?? []).map(async (review: any) => ({
        ...review,
        photo_url: await signPath(THUMBNAIL_BUCKET, review.photo_path, 60 * 60 * 6),
      })),
    ),
  };
});

export const adminGetLandingContent = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: intro }, { data: quotes }, { data: reviews }] = await Promise.all([
    (supabaseAdmin as any).from("landing_intro").select("*").order("created_at").limit(1).maybeSingle(),
    (supabaseAdmin as any).from("landing_quotes").select("*").order("sort_order").order("created_at"),
    (supabaseAdmin as any).from("landing_reviews").select("*").order("sort_order").order("created_at"),
  ]);
  return { intro: intro ?? null, quotes: quotes ?? [], reviews: reviews ?? [] };
});

export const adminSaveLandingIntro = createServerFn({ method: "POST" })
  .inputValidator((data: { title: string; description?: string | null; videoUrl?: string | null; videoPath?: string | null; thumbnailPath?: string | null; aspectRatio: string; isActive: boolean }) =>
    z.object({
      title: clean(160), description: optional(1200), videoUrl: optional(800), videoPath: optional(500),
      thumbnailPath: optional(500), aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3"]), isActive: z.boolean(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, unknown> = {
      id: "default", title: data.title, description: data.description, aspect_ratio: data.aspectRatio,
      is_active: data.isActive, video_source: data.videoPath ? "upload" : "external",
    };
    if (data.videoPath) { payload["video_path"] = data.videoPath; payload["video_url"] = null; }
    else if (data.videoUrl) { payload["video_url"] = data.videoUrl; payload["video_path"] = null; }
    if (data.thumbnailPath) payload["thumbnail_path"] = data.thumbnailPath;
    const { error } = await (supabaseAdmin as any).from("landing_intro").upsert(payload);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSaveLandingQuote = createServerFn({ method: "POST" })
  .inputValidator((data: { id?: string; quoteText: string; sortOrder: number; isActive: boolean }) =>
    z.object({ id: uuid.optional(), quoteText: clean(300), sortOrder: z.number().int().min(0).max(999), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server"); await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { quote_text: data.quoteText, sort_order: data.sortOrder, is_active: data.isActive };
    const query = data.id ? (supabaseAdmin as any).from("landing_quotes").update(payload).eq("id", data.id) : (supabaseAdmin as any).from("landing_quotes").insert(payload);
    const { error } = await query; if (error) throw new Error(error.message); return { ok: true as const };
  });

export const adminDeleteLandingQuote = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server"); await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("landing_quotes").delete().eq("id", data.id);
    if (error) throw new Error(error.message); return { ok: true as const };
  });

export const adminSaveLandingReview = createServerFn({ method: "POST" })
  .inputValidator((data: { id?: string; personName: string; designation?: string | null; reviewText: string; rating?: number | null; photoPath?: string | null; status: string; sortOrder: number; isActive: boolean }) =>
    z.object({ id: uuid.optional(), personName: clean(120), designation: optional(120), reviewText: clean(1200), rating: z.number().int().min(1).max(5).optional().nullable(), photoPath: optional(500), status: z.enum(["pending", "approved", "rejected"]), sortOrder: z.number().int().min(0).max(999), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server"); await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, unknown> = { person_name: data.personName, designation: data.designation, review_text: data.reviewText, rating: data.rating, status: data.status, sort_order: data.sortOrder, is_active: data.isActive };
    if (data.photoPath) payload["photo_path"] = data.photoPath;
    const query = data.id ? (supabaseAdmin as any).from("landing_reviews").update(payload).eq("id", data.id) : (supabaseAdmin as any).from("landing_reviews").insert(payload);
    const { error } = await query; if (error) throw new Error(error.message); return { ok: true as const };
  });

export const adminDeleteLandingReview = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server"); await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("landing_reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message); return { ok: true as const };
  });