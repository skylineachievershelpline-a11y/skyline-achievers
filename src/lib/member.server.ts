import type { SupabaseClient } from "@supabase/supabase-js";

import {
  signPath,
  signThumbnails,
  VIDEO_BUCKET,
  RESOURCE_BUCKET,
  AVATAR_BUCKET,
} from "./storage.server";

/** Member-scoped client: every query below is filtered by row level security. */
type Db = SupabaseClient<any, "public", any>;

export type MemberContext = {
  memberId: string;
  fullName: string;
  accountId: string;
  status: string;
  level: { id: string; name: string; slug: string; rank_order: number } | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  avatarUrl: string | null;
};

export async function loadMemberContext(db: Db, userId: string): Promise<MemberContext | null> {
  const { data, error } = await db
    .from("member_profiles")
    .select(
      "id, member_id, full_name, status, email, phone, avatar_path, created_at, last_login_at, levels:level_id (id, name, slug, rank_order)",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    accountId: data.id,
    memberId: data.member_id,
    fullName: data.full_name,
    status: data.status,
    email: data.email,
    phone: data.phone,
    createdAt: data.created_at,
    lastLoginAt: data.last_login_at,
    avatarUrl: await signPath(AVATAR_BUCKET, (data as any).avatar_path, 60 * 60 * 6),
    level: (data as any).levels ?? null,
  };
}

export async function loadAccessibleLevels(db: Db) {
  const { data } = await db
    .from("levels")
    .select("id, name, slug, description, rank_order")
    .order("rank_order");
  const levels = data ?? [];
  if (levels.length === 0) return [];
  const [{ data: series }, { data: standalone }] = await Promise.all([
    db.from("series").select("id, level_id"),
    // Lectures added straight to a level, without a series.
    db.from("lectures").select("id, level_id").is("series_id", null),
  ]);
  const counts = new Map<string, number>();
  for (const row of series ?? []) {
    counts.set(row.level_id, (counts.get(row.level_id) ?? 0) + 1);
  }
  const lectureCounts = new Map<string, number>();
  for (const row of standalone ?? []) {
    if (!row.level_id) continue;
    lectureCounts.set(row.level_id, (lectureCounts.get(row.level_id) ?? 0) + 1);
  }
  return levels
    .map((level) => ({
      ...level,
      series_count: counts.get(level.id) ?? 0,
      lecture_count: lectureCounts.get(level.id) ?? 0,
    }))
    .filter((level) => level.series_count > 0 || level.lecture_count > 0);
}

export async function loadLectureCard(db: Db, limit: number) {
  const { data } = await db
    .from("lectures")
    .select(
      "id, title, description, duration_seconds, thumbnail_path, created_at, series:series_id (id, title, levels:level_id (id, name, slug)), levels:level_id (id, name, slug)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return signThumbnails(data ?? []);
}

export async function loadContinueWatching(db: Db, userId: string) {
  const { data } = await db
    .from("watch_positions")
    .select(
      "position_seconds, updated_at, lectures:lecture_id (id, title, duration_seconds, thumbnail_path, series:series_id (id, title, levels:level_id (id, name, slug)), levels:level_id (id, name, slug))",
    )
    .eq("member_id", userId)
    .gt("position_seconds", 15)
    .order("updated_at", { ascending: false })
    .limit(12);
  const rows = (data ?? []).filter((row) => (row as any).lectures);
  const withThumbs = await signThumbnails(
    rows.map((row) => ({
      ...(row as any).lectures,
      position_seconds: row.position_seconds,
      resumed_at: row.updated_at,
    })),
  );
  return withThumbs;
}

/** Lectures attached directly to a level (no series). */
export async function loadStandaloneLecturesForLevel(db: Db, levelId: string) {
  const { data } = await db
    .from("lectures")
    .select("id, title, description, duration_seconds, thumbnail_path, sort_order, created_at")
    .eq("level_id", levelId)
    .is("series_id", null)
    .order("sort_order")
    .order("created_at");
  return signThumbnails(data ?? []);
}


export async function loadSeriesForLevel(db: Db, levelId: string) {
  const { data } = await db
    .from("series")
    .select("id, title, description, thumbnail_path, sort_order, level_id")
    .eq("level_id", levelId)
    .order("sort_order")
    .order("created_at");
  const series = await signThumbnails(data ?? []);
  if (series.length === 0) return [];
  const { data: lectureCounts } = await db
    .from("lectures")
    .select("id, series_id")
    .in(
      "series_id",
      series.map((s) => s.id),
    );
  const counts = new Map<string, number>();
  for (const row of lectureCounts ?? []) {
    counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1);
  }
  return series.map((s) => ({ ...s, lecture_count: counts.get(s.id) ?? 0 }));
}

export async function resolvePlaybackUrl(lecture: {
  video_source: string;
  video_path: string | null;
  video_url: string | null;
}): Promise<{ url: string | null; kind: "file" | "external" | "none" }> {
  if (lecture.video_source === "external" && lecture.video_url) {
    return { url: lecture.video_url, kind: "external" };
  }
  if (lecture.video_path) {
    // Short-lived signed link: long enough for a two hour lecture, then expires.
    const url = await signPath(VIDEO_BUCKET, lecture.video_path, 60 * 60 * 4);
    return { url, kind: url ? "file" : "none" };
  }
  return { url: null, kind: "none" };
}

export async function resolveResourceUrl(resource: {
  resource_type: string;
  storage_path: string | null;
  external_url: string | null;
}): Promise<string | null> {
  if (resource.external_url) return resource.external_url;
  if (resource.storage_path) return signPath(RESOURCE_BUCKET, resource.storage_path, 60 * 10);
  return null;
}