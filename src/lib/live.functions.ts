import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** Members from Assistant Supervisor upwards may schedule premiere links. */
const MIN_RANK_FOR_LIVE = 2;

const TRAINING_COLUMNS =
  "id, title, description, video_source, video_path, video_url, thumbnail_path, aspect_ratio, duration_seconds, sort_order, is_published, created_at";

/* ------------------------------------------------------------------ */
/* Admin: manage the live training library                             */
/* ------------------------------------------------------------------ */

export const adminGetLiveTrainings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("live_trainings")
    .select(TRAINING_COLUMNS)
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(200);
  return { trainings: data ?? [] };
});

export const adminSaveLiveTraining = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id?: string;
      title: string;
      description?: string | null;
      videoPath?: string | null;
      videoUrl?: string | null;
      thumbnailPath?: string | null;
      aspectRatio?: string;
      sortOrder?: number;
      isPublished: boolean;
    }) =>
      z
        .object({
          id: uuid.optional(),
          title: z.string().trim().min(1).max(160),
          description: optionalText(4000),
          videoPath: optionalText(400),
          videoUrl: optionalText(600),
          thumbnailPath: optionalText(400),
          aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3"]).optional(),
          sortOrder: z.number().int().min(0).max(999).optional(),
          isPublished: z.boolean(),
        })
        .refine((v) => Boolean(v.id || v.videoPath || v.videoUrl), {
          message: "Upload a video file or paste a video link.",
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload: Record<string, unknown> = {
      title: data.title,
      description: data.description,
      aspect_ratio: data.aspectRatio ?? "16:9",
      sort_order: data.sortOrder ?? 0,
      is_published: data.isPublished,
    };
    if (data.videoPath) {
      payload["video_path"] = data.videoPath;
      payload["video_url"] = null;
      payload["video_source"] = "upload";
    } else if (data.videoUrl) {
      payload["video_url"] = data.videoUrl;
      payload["video_path"] = null;
      payload["video_source"] = "external";
    }
    if (data.thumbnailPath) payload["thumbnail_path"] = data.thumbnailPath;

    const query = data.id
      ? (supabaseAdmin as any).from("live_trainings").update(payload).eq("id", data.id)
      : (supabaseAdmin as any).from("live_trainings").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteLiveTraining = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("live_trainings")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Members: pick a session, schedule it, generate the premiere link    */
/* ------------------------------------------------------------------ */

export const getLiveTrainingHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadMemberContext } = await import("./member.server");
    const { signThumbnails } = await import("./storage.server");
    const member = await loadMemberContext(context.supabase as never, context.userId);
    const rank = member?.level?.rank_order ?? 0;
    if (!member || member.status !== "active" || rank < MIN_RANK_FOR_LIVE) {
      return { allowed: false as const, trainings: [], premieres: [] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: trainings }, { data: premieres }] = await Promise.all([
      (supabaseAdmin as any)
        .from("live_trainings")
        .select(TRAINING_COLUMNS)
        .eq("is_published", true)
        .order("sort_order")
        .order("created_at", { ascending: false }),
      (supabaseAdmin as any)
        .from("live_premieres")
        .select("id, token, scheduled_at, created_at, live_trainings:training_id (id, title)")
        .eq("created_by", context.userId)
        .order("scheduled_at", { ascending: false })
        .limit(60),
    ]);

    return {
      allowed: true as const,
      trainings: await signThumbnails((trainings ?? []) as any[]),
      premieres: (premieres ?? []) as any[],
    };
  });

export const createPremiereLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { trainingId: string; scheduledAt: string }) =>
    z
      .object({
        trainingId: uuid,
        scheduledAt: z.string().min(4),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { loadMemberContext } = await import("./member.server");
    const member = await loadMemberContext(context.supabase as never, context.userId);
    const rank = member?.level?.rank_order ?? 0;
    if (!member || member.status !== "active" || rank < MIN_RANK_FOR_LIVE) {
      throw new Error("Your rank cannot schedule live sessions yet.");
    }
    const when = new Date(data.scheduledAt);
    if (Number.isNaN(when.getTime())) throw new Error("Pick a valid date and time.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = `${randomToken(5)}-${randomToken(5)}`;
    const { error } = await (supabaseAdmin as any).from("live_premieres").insert({
      training_id: data.trainingId,
      token,
      scheduled_at: when.toISOString(),
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, token };
  });

export const deletePremiereLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("live_premieres")
      .delete()
      .eq("id", data.id)
      .eq("created_by", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Public: open a premiere link                                        */
/* ------------------------------------------------------------------ */

export const openPremiere = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) =>
    z.object({ token: z.string().trim().min(4).max(60) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signPath, VIDEO_BUCKET, THUMBNAIL_BUCKET } = await import("./storage.server");

    const { data: row } = await (supabaseAdmin as any)
      .from("live_premieres")
      .select(
        "id, token, scheduled_at, live_trainings:training_id (id, title, description, video_source, video_path, video_url, thumbnail_path, aspect_ratio, duration_seconds, is_published)",
      )
      .eq("token", data.token)
      .maybeSingle();

    const training = row?.live_trainings;
    if (!row || !training || !training.is_published) return { status: "invalid" as const };

    const startedAt = new Date(row.scheduled_at).getTime();
    const serverNow = Date.now();
    const isLive = serverNow >= startedAt;

    // The video link is only minted once the premiere has actually started, so
    // nobody can watch the session early by digging through the page source.
    const videoUrl = !isLive
      ? null
      : training.video_source === "external" && training.video_url
        ? training.video_url
        : await signPath(VIDEO_BUCKET, training.video_path, 60 * 60 * 5);

    return {
      status: "ok" as const,
      premiere: {
        token: row.token as string,
        title: training.title as string,
        description: (training.description ?? null) as string | null,
        aspectRatio: (training.aspect_ratio ?? "16:9") as string,
        durationSeconds: (training.duration_seconds ?? null) as number | null,
        scheduledAt: new Date(startedAt).toISOString(),
        serverNow: new Date(serverNow).toISOString(),
        isLive,
        videoUrl: videoUrl as string | null,
        isExternal: training.video_source === "external",
        thumbnailUrl: await signPath(THUMBNAIL_BUCKET, training.thumbnail_path, 60 * 60 * 4),
      },
    };
  });

function randomToken(length: number): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
