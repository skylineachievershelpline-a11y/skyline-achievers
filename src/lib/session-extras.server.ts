import { signPath, RESOURCE_BUCKET, THUMBNAIL_BUCKET, VIDEO_BUCKET } from "./storage.server";

export type SessionSection = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
};

export type SessionExtra = {
  id: string;
  title: string;
  description: string | null;
  sectionId: string | null;
  /** video = player, image = picture, pdf = document, link = open in a new tab */
  kind: "video" | "image" | "pdf" | "link";
  aspectRatio: string;
  isExternal: boolean;
  url: string | null;
  /** Kept for older callers that only played videos. */
  videoUrl: string | null;
  thumbnailUrl: string | null;
};

function bucketFor(kind: string, stored: string | null): string {
  if (stored) return stored;
  if (kind === "image") return THUMBNAIL_BUCKET;
  if (kind === "pdf") return RESOURCE_BUCKET;
  return VIDEO_BUCKET;
}

/** Every published extra (video, picture, PDF or link) for one beginners session. */
export async function loadSessionExtras(db: any, sessionId: string): Promise<SessionExtra[]> {
  const { data } = await db
    .from("beginner_session_extras")
    .select(
      "id, title, description, section_id, kind, file_bucket, video_source, video_path, video_url, thumbnail_path, aspect_ratio, sort_order",
    )
    .eq("session_id", sessionId)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  return Promise.all(
    (data ?? []).map(async (row: any) => {
      const kind = (row.kind ?? "video") as SessionExtra["kind"];
      const external = row.video_source === "external";
      const url =
        external && row.video_url
          ? (row.video_url as string)
          : await signPath(bucketFor(kind, row.file_bucket), row.video_path, 60 * 60 * 4);
      return {
        id: row.id as string,
        title: row.title as string,
        description: (row.description ?? null) as string | null,
        sectionId: (row.section_id ?? null) as string | null,
        kind,
        aspectRatio: (row.aspect_ratio ?? "16:9") as string,
        isExternal: external,
        url,
        videoUrl: url,
        thumbnailUrl: await signPath(THUMBNAIL_BUCKET, row.thumbnail_path, 60 * 60 * 4),
      };
    }),
  );
}

const RESOURCE_KIND: Record<string, SessionExtra["kind"]> = {
  pdf: "pdf",
  image: "image",
  link: "link",
  audio: "link",
  presentation: "pdf",
  book: "pdf",
  note: "link",
};

/**
 * Resources an admin attached to this beginners session. They appear inside the
 * same categories as the session's own extra material.
 */
export async function loadSessionResources(db: any, sessionId: string): Promise<SessionExtra[]> {
  const { data } = await db
    .from("resources")
    .select(
      "id, title, description, section_id, resource_type, storage_path, external_url, thumbnail_path, sort_order",
    )
    .eq("session_id", sessionId)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  return Promise.all(
    (data ?? []).map(async (row: any) => {
      const kind = RESOURCE_KIND[row.resource_type as string] ?? "link";
      const external = Boolean(row.external_url) && !row.storage_path;
      const url = external
        ? (row.external_url as string)
        : await signPath(
            kind === "image" ? THUMBNAIL_BUCKET : RESOURCE_BUCKET,
            row.storage_path,
            60 * 60 * 4,
          );
      return {
        id: `resource-${row.id}`,
        title: row.title as string,
        description: (row.description ?? null) as string | null,
        sectionId: (row.section_id ?? null) as string | null,
        kind,
        aspectRatio: "16:9",
        isExternal: external,
        url,
        videoUrl: url,
        thumbnailUrl: await signPath(THUMBNAIL_BUCKET, row.thumbnail_path, 60 * 60 * 4),
      };
    }),
  );
}

/** Categories (Products, Reviews, PDFs …) used to group one session's extras. */
export async function loadSessionSections(db: any, sessionId: string): Promise<SessionSection[]> {
  const { data } = await db
    .from("content_sections")
    .select("id, name, thumbnail_path, sort_order")
    .eq("scope", "session")
    .eq("session_id", sessionId)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  return Promise.all(
    (data ?? []).map(async (row: any) => ({
      id: row.id as string,
      name: row.name as string,
      thumbnailUrl: await signPath(THUMBNAIL_BUCKET, row.thumbnail_path, 60 * 60 * 4),
    })),
  );
}
