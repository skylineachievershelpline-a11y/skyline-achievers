import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Private buckets are never publicly readable. Playback and download links are
 * minted server-side, short-lived, and only after the caller's row-level access
 * has already been verified by a member-scoped query.
 */
export const VIDEO_BUCKET = "training-videos";
export const RESOURCE_BUCKET = "training-resources";
export const THUMBNAIL_BUCKET = "training-thumbnails";

export async function signPath(
  bucket: string,
  path: string | null | undefined,
  expiresInSeconds: number,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function signThumbnails<T extends { thumbnail_path?: string | null }>(
  rows: T[],
): Promise<(T & { thumbnail_url: string | null })[]> {
  const paths = Array.from(
    new Set(rows.map((r) => r.thumbnail_path).filter((p): p is string => Boolean(p))),
  );
  const map = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabaseAdmin.storage
      .from(THUMBNAIL_BUCKET)
      .createSignedUrls(paths, 60 * 60 * 6);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
    }
  }
  return rows.map((row) => ({
    ...row,
    thumbnail_url: row.thumbnail_path ? (map.get(row.thumbnail_path) ?? null) : null,
  }));
}