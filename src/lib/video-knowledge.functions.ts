import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Admin tools that teach Skyline AI what each training video says.
 * Every function is administrator-only; the table itself is service-role only.
 */

const idSchema = z.object({ id: z.string().uuid() });

export const adminListVideoKnowledge = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { youtubeIdFromUrl } = await import("./video-knowledge.server");

  const [{ data: sessions }, { data: intro }, { data: lectures }] = await Promise.all([
    (supabaseAdmin as any)
      .from("beginner_sessions")
      .select("id, session_code, title, video_source, video_url")
      .order("created_at"),
    (supabaseAdmin as any)
      .from("landing_intro")
      .select("id, title, video_source, video_url")
      .eq("is_active", true),
    (supabaseAdmin as any)
      .from("lectures")
      .select("id, title, video_source, video_url")
      .order("created_at")
      .limit(200),
  ]);

  type Candidate = {
    source_kind: "session" | "landing_intro" | "lecture";
    source_id: string;
    title: string;
    video_label: string | null;
    video_url: string | null;
  };

  const candidates: Candidate[] = [
    ...((sessions ?? []) as any[]).map((row) => ({
      source_kind: "session" as const,
      source_id: String(row.id),
      title: String(row.title ?? "Session"),
      video_label: row.session_code ? String(row.session_code) : null,
      video_url: row.video_source === "external" ? (row.video_url ?? null) : null,
    })),
    ...((intro ?? []) as any[]).map((row) => ({
      source_kind: "landing_intro" as const,
      source_id: String(row.id),
      title: String(row.title ?? "Orientation video"),
      video_label: "Landing orientation",
      video_url: row.video_source === "external" ? (row.video_url ?? null) : null,
    })),
    ...((lectures ?? []) as any[]).map((row) => ({
      source_kind: "lecture" as const,
      source_id: String(row.id),
      title: String(row.title ?? "Lecture"),
      video_label: "Lecture",
      video_url: row.video_source === "external" ? (row.video_url ?? null) : null,
    })),
  ];

  const { data: existing } = await (supabaseAdmin as any)
    .from("video_knowledge")
    .select(
      "id, source_kind, source_id, title, video_label, video_url, youtube_id, language, summary, key_points, timeline, transcript, status, last_error, is_active, updated_at",
    );

  const have = new Map(
    ((existing ?? []) as any[]).map((row) => [`${row.source_kind}:${row.source_id}`, row]),
  );

  const missing = candidates.filter((item) => !have.has(`${item.source_kind}:${item.source_id}`));
  if (missing.length > 0) {
    await (supabaseAdmin as any).from("video_knowledge").insert(
      missing.map((item) => ({
        source_kind: item.source_kind,
        source_id: item.source_id,
        title: item.title,
        video_label: item.video_label,
        video_url: item.video_url,
        youtube_id: youtubeIdFromUrl(item.video_url),
        status: "pending",
      })),
    );
  }

  const { data: rows } = await (supabaseAdmin as any)
    .from("video_knowledge")
    .select(
      "id, source_kind, source_id, title, video_label, video_url, youtube_id, language, summary, key_points, timeline, transcript, status, last_error, is_active, updated_at",
    )
    .order("source_kind")
    .order("title");

  return {
    videos: ((rows ?? []) as any[]).map((row) => ({
      id: String(row.id),
      sourceKind: String(row.source_kind),
      title: String(row.title),
      videoLabel: (row.video_label ?? null) as string | null,
      videoUrl: (row.video_url ?? null) as string | null,
      youtubeId: (row.youtube_id ?? null) as string | null,
      language: (row.language ?? null) as string | null,
      summary: (row.summary ?? null) as string | null,
      keyPoints: (row.key_points ?? null) as string | null,
      chapters: Array.isArray(row.timeline) ? row.timeline.length : 0,
      transcriptChars: typeof row.transcript === "string" ? row.transcript.length : 0,
      status: String(row.status) as "pending" | "ready" | "failed",
      lastError: (row.last_error ?? null) as string | null,
      isActive: row.is_active !== false,
      updatedAt: String(row.updated_at),
    })),
  };
});

async function storeIndexed(
  id: string,
  payload: {
    transcript: string;
    stamped: string;
    title: string;
    language?: string | null;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { buildVideoSummary } = await import("./video-knowledge.server");

  const built = await buildVideoSummary({ title: payload.title, transcript: payload.stamped });
  if ("error" in built) {
    await (supabaseAdmin as any)
      .from("video_knowledge")
      .update({
        transcript: payload.transcript,
        language: payload.language ?? null,
        status: "failed",
        last_error: built.error,
      })
      .eq("id", id);
    return { status: "failed" as const, message: built.error };
  }

  await (supabaseAdmin as any)
    .from("video_knowledge")
    .update({
      transcript: payload.transcript,
      language: payload.language ?? null,
      summary: built.summary,
      key_points: built.keyPoints,
      timeline: built.timeline,
      status: "ready",
      last_error: null,
    })
    .eq("id", id);

  return { status: "ready" as const, chapters: built.timeline.length };
}

/** Downloads the video's own YouTube captions, then builds the AI index. */
export const adminAutoIndexVideo = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchYoutubeCaptions, parseTranscriptText, stampedTranscript, youtubeIdFromUrl } =
      await import("./video-knowledge.server");

    const { data: row } = await (supabaseAdmin as any)
      .from("video_knowledge")
      .select("id, title, video_url, youtube_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { status: "failed" as const, message: "Video not found." };

    const youtubeId = (row.youtube_id as string | null) ?? youtubeIdFromUrl(row.video_url);
    if (!youtubeId) {
      return {
        status: "failed" as const,
        message: "This video is not a YouTube link. Paste its transcript instead.",
      };
    }

    const captions = await fetchYoutubeCaptions(youtubeId);
    if ("error" in captions) {
      await (supabaseAdmin as any)
        .from("video_knowledge")
        .update({ youtube_id: youtubeId, status: "failed", last_error: captions.error })
        .eq("id", data.id);
      return { status: "failed" as const, message: captions.error };
    }

    const transcript = captions.cues.map((cue) => `[${cue.t}] ${cue.label}`).join("\n");
    const parsed = parseTranscriptText(transcript);
    await (supabaseAdmin as any)
      .from("video_knowledge")
      .update({ youtube_id: youtubeId })
      .eq("id", data.id);

    return storeIndexed(data.id, {
      transcript,
      stamped: stampedTranscript(captions.cues, parsed.plain),
      title: String(row.title),
      language: captions.language,
    });
  });

/** Admin pastes a transcript (YouTube "Show transcript" copy, SRT, VTT or plain text). */
export const adminSaveVideoTranscript = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; transcript: string }) =>
    z
      .object({ id: z.string().uuid(), transcript: z.string().trim().min(40).max(400000) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { parseTranscriptText, stampedTranscript } = await import("./video-knowledge.server");

    const { data: row } = await (supabaseAdmin as any)
      .from("video_knowledge")
      .select("id, title")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { status: "failed" as const, message: "Video not found." };

    const parsed = parseTranscriptText(data.transcript);
    return storeIndexed(data.id, {
      transcript: data.transcript,
      stamped: stampedTranscript(parsed.cues, parsed.plain),
      title: String(row.title),
    });
  });

/** Listens to an uploaded (non-YouTube) video and writes its transcript. */
export const adminTranscribeUploadedVideo = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { parseTranscriptText, stampedTranscript } = await import("./video-knowledge.server");

    const { data: row } = await (supabaseAdmin as any)
      .from("video_knowledge")
      .select("id, title, source_kind, source_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { status: "failed" as const, message: "Video not found." };

    const table =
      row.source_kind === "session"
        ? "beginner_sessions"
        : row.source_kind === "lecture"
          ? "lectures"
          : "landing_intro";
    const { data: media } = await (supabaseAdmin as any)
      .from(table)
      .select("video_source, video_path")
      .eq("id", row.source_id)
      .maybeSingle();
    if (!media || media.video_source === "external" || !media.video_path) {
      return { status: "failed" as const, message: "No uploaded video file for this entry." };
    }

    const { VIDEO_BUCKET } = await import("./storage.server");
    const { data: file, error } = await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .download(media.video_path as string);
    if (error || !file) {
      return { status: "failed" as const, message: "Could not read the video file." };
    }
    if (file.size > 24 * 1024 * 1024) {
      return {
        status: "failed" as const,
        message: "This video is too large to listen to. Paste its transcript instead.",
      };
    }

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { status: "failed" as const, message: "Skyline AI is not configured." };

    const form = new FormData();
    form.append("model", "openai/gpt-4o-transcribe");
    form.append("response_format", "json");
    form.append("stream", "true");
    form.append("file", new File([file], "session.mp4", { type: "video/mp4" }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!response.ok) {
      const message = (await response.text()).slice(0, 300) || `Transcription failed (${response.status})`;
      await (supabaseAdmin as any)
        .from("video_knowledge")
        .update({ status: "failed", last_error: message })
        .eq("id", data.id);
      return { status: "failed" as const, message };
    }

    const raw = await response.text();
    let transcript = "";
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as { type?: string; delta?: string; text?: string };
        if (event.type?.endsWith("delta") && event.delta) transcript += event.delta;
        else if (event.type?.endsWith("done") && event.text) transcript = event.text;
        else if (!event.type && event.text) transcript = event.text;
      } catch {
        /* ignore partial SSE frames */
      }
    }
    transcript = transcript.replace(/\s+/g, " ").trim();
    if (transcript.length < 40) {
      return { status: "failed" as const, message: "No speech could be read from this video." };
    }

    const parsed = parseTranscriptText(transcript);
    return storeIndexed(data.id, {
      transcript,
      stamped: stampedTranscript(parsed.cues, parsed.plain),
      title: String(row.title),
    });
  });

export const adminSetVideoKnowledgeActive = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; isActive: boolean }) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("video_knowledge")
      .update({ is_active: data.isActive })
      .eq("id", data.id);
    return { ok: true };
  });
