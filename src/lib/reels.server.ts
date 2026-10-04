import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { AVATAR_BUCKET, signPath } from "./storage.server";

export type ReelAuthor = { name: string; avatarUrl: string | null; rank: string | null; founder: boolean };

/**
 * Who posted a reel: their display name, profile picture and the rank whose pin
 * is shown next to the name — exactly like on their own dashboard.
 */
export async function loadReelAuthors(ids: string[]): Promise<Map<string, ReelAuthor>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, ReelAuthor>();
  if (unique.length === 0) return map;

  const { data } = await (supabaseAdmin as any)
    .from("member_profiles")
    .select("id, member_id, full_name, avatar_path, level:level_id (name)")
    .in("id", unique);

  for (const row of ((data ?? []) as any[])) {
    map.set(row.id as string, {
      name: (row.full_name as string) ?? "Skyline member",
      avatarUrl: await signPath(AVATAR_BUCKET, row.avatar_path, 60 * 60 * 6),
      rank: (row.level?.name as string | null) ?? null,
      founder: row.member_id === "760000010005",
    });
  }
  return map;
}
