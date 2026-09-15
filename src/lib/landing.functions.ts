import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export type LandingQuote = {
  id: string;
  quoteText: string;
};

export type LandingReview = {
  id: string;
  personName: string;
  designation: string | null;
  reviewText: string;
  rating: number | null;
  createdAt: string;
};

export type LandingIntro = {
  title: string;
  description: string | null;
  videoSource: "upload" | "external";
  videoUrl: string | null;
  thumbnailUrl: string | null;
  aspectRatio: string;
};

export const getLandingContent = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [quotesResult, introResult, reviewsResult] = await Promise.all([
    (supabase as any)
      .from("landing_quotes")
      .select("id, quote_text")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
    (supabase as any)
      .from("landing_intro")
      .select("title, description, video_source, video_path, video_url, thumbnail_path, aspect_ratio")
      .eq("id", "default")
      .eq("is_active", true)
      .maybeSingle(),
    (supabase as any)
      .from("landing_reviews")
      .select("id, person_name, designation, review_text, rating, created_at")
      .eq("status", "approved")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  let introVideoUrl: string | null = introResult.data?.video_url ?? null;
  let introThumbnailUrl: string | null = null;
  if (introResult.data?.video_source === "upload" && introResult.data.video_path) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage
      .from("training-videos")
      .createSignedUrl(introResult.data.video_path, 60 * 60 * 6);
    introVideoUrl = data?.signedUrl ?? null;
  }
  if (introResult.data?.thumbnail_path) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage
      .from("training-thumbnails")
      .createSignedUrl(introResult.data.thumbnail_path, 60 * 60 * 6);
    introThumbnailUrl = data?.signedUrl ?? null;
  }

  return {
    quotes: (quotesResult.data ?? []).map((row: any) => ({
      id: row.id,
      quoteText: row.quote_text,
    })) as LandingQuote[],
    intro: introResult.data
      ? ({
          title: introResult.data.title,
          description: introResult.data.description,
          videoSource: introResult.data.video_source,
          videoUrl: introVideoUrl,
          thumbnailUrl: introThumbnailUrl,
          aspectRatio: introResult.data.aspect_ratio,
        } as LandingIntro)
      : null,
    reviews: (reviewsResult.data ?? []).map((row: any) => ({
      id: row.id,
      personName: row.person_name,
      designation: row.designation,
      reviewText: row.review_text,
      rating: row.rating,
      createdAt: row.created_at,
    })) as LandingReview[],
  };
});

export const submitLandingReview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        personName: z.string().trim().min(2).max(100),
        designation: z.string().trim().max(100).optional().nullable(),
        reviewText: z.string().trim().min(10).max(700),
        rating: z.number().int().min(1).max(5).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { error } = await (supabase as any).from("landing_reviews").insert({
      person_name: data.personName,
      designation: data.designation || null,
      review_text: data.reviewText,
      rating: data.rating ?? null,
      status: "pending",
      is_active: false,
      sort_order: 0,
      photo_path: null,
    });
    if (error) throw new Error("Your review could not be submitted. Please try again.");
    return { ok: true as const };
  });