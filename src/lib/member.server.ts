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
  /** false = training only, every earning/working area stays locked. */
  workingEnabled: boolean;
  level: { id: string; name: string; slug: string; rank_order: number } | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  avatarUrl: string | null;
  dashboardCoverUrl: string | null;
  bio: string | null;
  /** Personal Mentorship money and deadline columns, straight from the row. */
  mentorship: {
    feeTotal: number;
    feePaid: number;
    dueAt: string | null;
    extensions: number;
    completedAt: string | null;
    ccDueAt: string | null;
    ccExtensions: number;
    trainingLocked: boolean;
    levelSince: string | null;
  };
};

export async function loadMemberContext(db: Db, userId: string): Promise<MemberContext | null> {
  const { data, error } = await db
    .from("member_profiles")
    .select(
      "id, member_id, full_name, status, working_enabled, email, phone, avatar_path, dashboard_cover_path, bio, created_at, last_login_at, mentorship_fee_pkr, mentorship_paid_pkr, mentorship_due_at, mentorship_extensions, mentorship_completed_at, cc_due_at, cc_extensions, training_locked, level_since, levels:level_id (id, name, slug, rank_order)",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as any;
  return {
    accountId: data.id,
    memberId: data.member_id,
    fullName: data.full_name,
    status: data.status,
    workingEnabled: (data as any).working_enabled !== false,
    email: data.email,
    phone: data.phone,
    createdAt: data.created_at,
    lastLoginAt: data.last_login_at,
    avatarUrl: await signPath(AVATAR_BUCKET, (data as any).avatar_path, 60 * 60 * 6),
    dashboardCoverUrl: await signPath(
      AVATAR_BUCKET,
      (data as any).dashboard_cover_path,
      60 * 60 * 6,
    ),
    bio: data.bio ?? null,
    level: (data as any).levels ?? null,
    mentorship: {
      feeTotal: Number(row.mentorship_fee_pkr ?? 0),
      feePaid: Number(row.mentorship_paid_pkr ?? 0),
      dueAt: row.mentorship_due_at ?? null,
      extensions: Number(row.mentorship_extensions ?? 0),
      completedAt: row.mentorship_completed_at ?? null,
      ccDueAt: row.cc_due_at ?? null,
      ccExtensions: Number(row.cc_extensions ?? 0),
      trainingLocked: row.training_locked === true,
      levelSince: row.level_since ?? null,
    },
  };
}

/** Case Credits this member has reported since reaching the current level. */
export async function loadCaseCredits(db: Db, userId: string, since: string | null) {
  let query = db.from("member_daily_reports").select("two_cc, report_date").eq("member_id", userId);
  if (since) query = query.gte("report_date", since.slice(0, 10));
  const { data } = await query;
  return (data ?? []).reduce((sum: number, row: any) => sum + Number(row.two_cc ?? 0), 0);
}

/**
 * Every training video this member may watch. Access is decided by row level
 * security from the per-video access list the admin sets.
 */
export async function loadTrainingVideos(db: Db, limit = 200) {
  const { data } = await db
    .from("lectures")
    .select(
      "id, title, description, duration_seconds, thumbnail_path, sort_order, created_at, levels:level_id (id, name, slug)",
    )
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(limit);
  return signThumbnails(data ?? []);
}

export async function loadContinueWatching(db: Db, userId: string) {
  const { data } = await db
    .from("watch_positions")
    .select(
      "position_seconds, updated_at, lectures:lecture_id (id, title, duration_seconds, thumbnail_path, levels:level_id (id, name, slug))",
    )
    .eq("member_id", userId)
    .gt("position_seconds", 15)
    .order("updated_at", { ascending: false })
    .limit(12);
  const rows = (data ?? []).filter((row) => (row as any).lectures);
  return signThumbnails(
    rows.map((row) => ({
      ...(row as any).lectures,
      position_seconds: row.position_seconds,
      resumed_at: row.updated_at,
    })),
  );
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
