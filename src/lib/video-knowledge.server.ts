/**
 * Video knowledge for Skyline AI.
 *
 * Every training video (YouTube session, uploaded session, landing orientation
 * video) can store a timestamped transcript plus an AI-written chapter timeline.
 * The AI then answers "what was said at which second" questions from this text
 * instead of guessing.
 */

export type TimelineEntry = { t: number; label: string; detail?: string };

export function youtubeIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function formatStamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function stampToSeconds(stamp: string): number | null {
  const parts = stamp.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return null;
}

/**
 * Accepts text copied straight out of YouTube's "Show transcript" panel, an
 * SRT/VTT file, or plain text. Timestamps are kept when present.
 */
export function parseTranscriptText(raw: string): { cues: TimelineEntry[]; plain: string } {
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== "WEBVTT" && !/^\d+$/.test(line));

  const cues: TimelineEntry[] = [];
  let pending: number | null = null;

  for (const line of lines) {
    const range = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)[.,\d]*\s*-->\s*\d/);
    const lone = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?$/);
    const inline = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+(.*)$/);

    if (range?.[1]) {
      pending = stampToSeconds(range[1]);
      continue;
    }
    if (lone?.[1]) {
      pending = stampToSeconds(lone[1]);
      continue;
    }
    if (inline?.[1] && inline[2]) {
      const seconds = stampToSeconds(inline[1]);
      if (seconds !== null) {
        cues.push({ t: seconds, label: inline[2].trim() });
        pending = null;
        continue;
      }
    }
    if (pending !== null) {
      cues.push({ t: pending, label: line });
      pending = null;
      continue;
    }
    if (cues.length > 0) {
      const last = cues[cues.length - 1]!;
      last.label = `${last.label} ${line}`.trim();
      continue;
    }
    cues.push({ t: 0, label: line });
  }

  const plain = cues.length > 0 ? cues.map((cue) => cue.label).join(" ") : raw.trim();
  return { cues, plain: plain.replace(/\s+/g, " ").trim() };
}

/** Transcript text with a timestamp in front of every line, for the AI prompt. */
export function stampedTranscript(cues: TimelineEntry[], plain: string, limit = 14000): string {
  const body =
    cues.length > 0
      ? cues.map((cue) => `[${formatStamp(cue.t)}] ${cue.label}`).join("\n")
      : plain;
  return body.length > limit ? `${body.slice(0, limit)}\n…(transcript continues)` : body;
}

/**
 * Tries to download the video's own captions from YouTube. YouTube blocks many
 * server IP ranges, so a failure here is normal and the admin can paste the
 * transcript instead.
 */
export async function fetchYoutubeCaptions(
  videoId: string,
): Promise<{ cues: TimelineEntry[]; language: string } | { error: string }> {
  try {
    const watch = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!watch.ok) return { error: `YouTube replied ${watch.status}` };
    const html = await watch.text();
    const match = html.match(/"captionTracks":(\[.*?\])/);
    if (!match?.[1]) return { error: "This video has no captions available." };

    const tracks = JSON.parse(match[1].replace(/\\u0026/g, "&")) as {
      baseUrl: string;
      languageCode?: string;
      kind?: string;
    }[];
    if (tracks.length === 0) return { error: "This video has no captions available." };

    const preferred =
      tracks.find((track) => track.languageCode === "ur") ??
      tracks.find((track) => track.languageCode === "hi") ??
      tracks.find((track) => track.languageCode?.startsWith("en")) ??
      tracks[0]!;

    const captions = await fetch(`${preferred.baseUrl}&fmt=json3`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!captions.ok) return { error: `Caption download failed (${captions.status})` };
    const payload = (await captions.json()) as {
      events?: { tStartMs?: number; segs?: { utf8?: string }[] }[];
    };
    const cues: TimelineEntry[] = [];
    for (const event of payload.events ?? []) {
      const text = (event.segs ?? [])
        .map((seg) => seg.utf8 ?? "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      cues.push({ t: Math.round((event.tStartMs ?? 0) / 1000), label: text });
    }
    if (cues.length === 0) return { error: "Captions were empty." };
    return { cues, language: preferred.languageCode ?? "unknown" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Caption download failed." };
  }
}

type Chapter = { t: number; label: string; detail?: string };

/** Asks Lovable AI to turn a timestamped transcript into chapters + key points. */
export async function buildVideoSummary(input: {
  title: string;
  transcript: string;
}): Promise<{ summary: string; keyPoints: string; timeline: Chapter[] } | { error: string }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { error: "Skyline AI is not configured." };

  const { createLovableAiGatewayRunIdFetch } = await import("./ai-gateway.server");
  const gateway = createLovableAiGatewayRunIdFetch();
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText } = await import("ai");

  const lovable = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: gateway.fetch,
  });

  try {
    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      system: `You index Skyline Achievers training videos so an assistant can answer questions about them.
Return ONLY valid JSON, no markdown fence, in this exact shape:
{"summary":"3-5 sentence overview","keyPoints":"- point\\n- point","timeline":[{"t":"MM:SS","label":"short chapter title","detail":"one sentence on what is explained here"}]}
Rules: use the transcript's own timestamps, never invent a time; cover the whole video with 8-20 chapters; keep labels under 60 characters; never state money amounts, fees or income promises; write in the transcript's language (Roman Urdu stays Roman Urdu).`,
      prompt: `VIDEO TITLE: ${input.title}\n\nTIMESTAMPED TRANSCRIPT:\n${input.transcript}`,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const text = await result.text;
    const json = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(json) as {
      summary?: string;
      keyPoints?: string;
      timeline?: { t?: string | number; label?: string; detail?: string }[];
    };
    const timeline: Chapter[] = (parsed.timeline ?? [])
      .map((row) => {
        const seconds =
          typeof row.t === "number" ? row.t : stampToSeconds(String(row.t ?? "").trim());
        if (seconds === null || seconds === undefined || !row.label) return null;
        return { t: seconds, label: row.label, detail: row.detail };
      })
      .filter((row): row is Chapter => row !== null)
      .sort((a, b) => a.t - b.t);

    return {
      summary: parsed.summary ?? "",
      keyPoints: parsed.keyPoints ?? "",
      timeline,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not build the video index." };
  }
}

type KnowledgeRow = {
  title: string;
  video_label: string | null;
  summary: string | null;
  key_points: string | null;
  timeline: unknown;
  transcript: string | null;
  status: string;
};

/** The video reference block injected into both Skyline AI system prompts. */
export async function loadVideoKnowledgeContext(limit = 40): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("video_knowledge")
      .select("title, video_label, summary, key_points, timeline, transcript, status")
      .eq("is_active", true)
      .eq("status", "ready")
      .order("updated_at", { ascending: false })
      .limit(limit);

    const rows = (data ?? []) as KnowledgeRow[];
    if (rows.length === 0) return "";

    const blocks = rows.map((row) => {
      const timeline = Array.isArray(row.timeline) ? (row.timeline as TimelineEntry[]) : [];
      const chapters = timeline
        .map((entry) => `  [${formatStamp(entry.t)}] ${entry.label}${entry.detail ? ` — ${entry.detail}` : ""}`)
        .join("\n");
      return [
        `VIDEO: ${row.title}${row.video_label ? ` (${row.video_label})` : ""}`,
        row.summary ? `Overview: ${row.summary}` : "",
        row.key_points ? `Key points:\n${row.key_points}` : "",
        chapters ? `Timeline:\n${chapters}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    });

    return `\n\nSKYLINE ACHIEVERS VIDEO LIBRARY (timestamped index of the platform's own videos — your only factual source for "what was said in the video" questions):\n${blocks.join("\n\n")}\n\nVIDEO ANSWERING RULE\nWhen someone asks about a video, session or lecture, answer from this index and quote the timestamp, e.g. "Ye baat [12:40] par explain ki gayi hai." If the asked video or moment is not in this index, say plainly that you do not have that part indexed yet — never invent a timestamp or a sentence the speaker did not say. Money, fee and income rules still apply, even if a video mentions them.`;
  } catch {
    return "";
  }
}
