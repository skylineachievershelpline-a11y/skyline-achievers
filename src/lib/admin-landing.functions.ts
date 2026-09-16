import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

/** Admin management of the public Skyline Achievers introduction. */
export const adminGetLandingIntroduction = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("landing_intro")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { introduction: data };
});

export const adminSaveLandingIntroduction = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      id?: string;
      title: string;
      description?: string | null;
      videoPath?: string | null;
      videoUrl?: string | null;
      thumbnailPath?: string | null;
      aspectRatio: string;
      isActive: boolean;
    }) =>
      z
        .object({
          id: z.string().max(80).optional(),
          title: z.string().trim().min(2).max(140),
          description: nullableText(2000),
          videoPath: nullableText(500),
          videoUrl: nullableText(2000),
          thumbnailPath: nullableText(500),
          aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3"]),
          isActive: z.boolean(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = data.id ?? "main";
    const current = data.id
      ? await supabaseAdmin.from("landing_intro").select("*").eq("id", id).maybeSingle()
      : { data: null };
    const payload = {
      id,
      title: data.title,
      description: data.description,
      video_source: data.videoPath ? "upload" : data.videoUrl ? "external" : current.data?.video_source ?? "external",
      video_path: data.videoPath ?? current.data?.video_path ?? null,
      video_url: data.videoPath ? null : data.videoUrl ?? current.data?.video_url ?? null,
      thumbnail_path: data.thumbnailPath ?? current.data?.thumbnail_path ?? null,
      aspect_ratio: data.aspectRatio,
      is_active: data.isActive,
    };
    const { error } = await supabaseAdmin.from("landing_intro").upsert(payload);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin management of landing-page reviews (approve / hide / delete). */
export const adminGetReviews = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("landing_reviews")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { reviews: data ?? [] };
});

export const adminSetReviewStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: "approved" | "pending" | "rejected" }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "pending", "rejected"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("landing_reviews")
      .update({ status: data.status, is_active: data.status === "approved" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteReview = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("landing_reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSaveReview = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      id?: string;
      personName: string;
      designation?: string | null;
      reviewText: string;
      rating: number;
      sortOrder: number;
      isActive: boolean;
      videoPath?: string | null;
      videoUrl?: string | null;
      aspectRatio?: string;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          personName: z.string().trim().min(2).max(80),
          designation: nullableText(80),
          reviewText: z.string().trim().max(600).default(""),
          rating: z.number().int().min(1).max(5),
          sortOrder: z.number().int().min(0).max(9999),
          isActive: z.boolean(),
          videoPath: nullableText(500),
          videoUrl: nullableText(2000),
          aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3"]).default("16:9"),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const current = data.id
      ? await supabaseAdmin.from("landing_reviews").select("*").eq("id", data.id).maybeSingle()
      : { data: null };
    // A fresh upload wins; otherwise a pasted link wins; otherwise keep what is stored.
    const videoPath = data.videoPath ?? (data.videoUrl ? null : current.data?.video_path ?? null);
    const videoUrl = data.videoPath ? null : data.videoUrl ?? current.data?.video_url ?? null;
    const payload = {
      person_name: data.personName,
      designation: data.designation,
      review_text: data.reviewText,
      rating: data.rating,
      sort_order: data.sortOrder,
      is_active: data.isActive,
      status: data.isActive ? "approved" : "rejected",
      video_path: videoPath,
      video_url: videoUrl,
      video_source: videoPath ? "upload" : videoUrl ? "external" : "none",
      aspect_ratio: data.aspectRatio,
    };
    const query = data.id
      ? supabaseAdmin.from("landing_reviews").update(payload).eq("id", data.id)
      : supabaseAdmin.from("landing_reviews").insert({ ...payload, photo_path: null });
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
