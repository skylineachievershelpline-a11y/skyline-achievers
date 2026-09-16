import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

/** Conversation list + my own chat settings. Polled so ticks stay fresh. */
export const chatBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveChatIdentity, listChatPeers, chatShowsAvatar, CHAT_BUCKET } = await import(
      "./chat.server"
    );
    const { signPath, AVATAR_BUCKET } = await import("./storage.server");

    const identity = await resolveChatIdentity(context.userId);
    if (!identity) return { status: "unavailable" as const };

    const peers = await listChatPeers(identity);
    const myShowAvatar = await chatShowsAvatar(identity.id);

    const threads = await Promise.all(
      peers.map(async (peer) => {
        const [{ data: last }, { count: unread }, peerShowsAvatar] = await Promise.all([
          supabaseAdmin
            .from("chat_messages")
            .select("id, body, kind, sender_id, created_at, read_at, delivered_at")
            .or(
              `and(sender_id.eq.${identity.id},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${identity.id})`,
            )
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabaseAdmin
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("sender_id", peer.id)
            .eq("recipient_id", identity.id)
            .is("read_at", null),
          chatShowsAvatar(peer.id),
        ]);

        return {
          peerId: peer.id,
          name: peer.name,
          code: peer.code,
          kind: peer.kind,
          status: peer.status,
          avatarUrl: peerShowsAvatar
            ? await signPath(AVATAR_BUCKET, peer.avatarPath, 60 * 60 * 4)
            : null,
          unread: unread ?? 0,
          lastMessage: last
            ? {
                preview:
                  last.kind === "text"
                    ? ((last.body ?? "") as string)
                    : last.kind === "image"
                      ? "Photo"
                      : last.kind === "video"
                        ? "Video"
                        : "Attachment",
                mine: last.sender_id === identity.id,
                createdAt: last.created_at as string,
                readAt: (last.read_at ?? null) as string | null,
                deliveredAt: (last.delivered_at ?? null) as string | null,
              }
            : null,
        };
      }),
    );

    // Anything already handed to the recipient counts as delivered (single -> double tick).
    await supabaseAdmin
      .from("chat_messages")
      .update({ delivered_at: new Date().toISOString() })
      .eq("recipient_id", identity.id)
      .is("delivered_at", null);

    void CHAT_BUCKET;

    return {
      status: "ok" as const,
      me: {
        id: identity.id,
        name: identity.name,
        code: identity.code,
        kind: identity.kind,
        showAvatar: myShowAvatar,
        avatarUrl: await signPath(AVATAR_BUCKET, identity.avatarPath, 60 * 60 * 4),
      },
      threads: threads.sort((a, b) => {
        const at = a.lastMessage?.createdAt ?? "";
        const bt = b.lastMessage?.createdAt ?? "";
        return bt.localeCompare(at);
      }),
      totalUnread: threads.reduce((sum, thread) => sum + thread.unread, 0),
    };
  });

/** One conversation. Opening it marks the other side's messages as seen. */
export const chatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { peerId: string }) => z.object({ peerId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveChatIdentity, findChatPeer, chatShowsAvatar, CHAT_BUCKET } = await import(
      "./chat.server"
    );
    const { signPath, AVATAR_BUCKET } = await import("./storage.server");

    const identity = await resolveChatIdentity(context.userId);
    if (!identity) return { status: "unavailable" as const };
    const peer = await findChatPeer(identity, data.peerId);
    if (!peer) return { status: "unavailable" as const };

    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("chat_messages")
      .update({ delivered_at: nowIso, read_at: nowIso })
      .eq("sender_id", peer.id)
      .eq("recipient_id", identity.id)
      .is("read_at", null);

    const { data: rows } = await supabaseAdmin
      .from("chat_messages")
      .select(
        "id, sender_id, recipient_id, body, kind, media_path, media_mime, media_name, delivered_at, read_at, created_at",
      )
      .or(
        `and(sender_id.eq.${identity.id},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${identity.id})`,
      )
      .order("created_at", { ascending: true })
      .limit(400);

    const messages = await Promise.all(
      (rows ?? []).map(async (row) => ({
        id: row.id as string,
        mine: row.sender_id === identity.id,
        body: (row.body ?? null) as string | null,
        kind: row.kind as "text" | "image" | "video" | "file" | "audio",
        mediaUrl: await signPath(CHAT_BUCKET, (row as any).media_path, 60 * 60 * 4),
        mediaName: ((row as any).media_name ?? null) as string | null,
        mediaMime: ((row as any).media_mime ?? null) as string | null,
        deliveredAt: (row.delivered_at ?? null) as string | null,
        readAt: (row.read_at ?? null) as string | null,
        createdAt: row.created_at as string,
      })),
    );

    const peerShowsAvatar = await chatShowsAvatar(peer.id);

    return {
      status: "ok" as const,
      peer: {
        id: peer.id,
        name: peer.name,
        code: peer.code,
        kind: peer.kind,
        avatarUrl: peerShowsAvatar
          ? await signPath(AVATAR_BUCKET, peer.avatarPath, 60 * 60 * 4)
          : null,
      },
      messages,
    };
  });

export const chatSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      peerId: string;
      body?: string | null;
      kind?: "text" | "image" | "video" | "file" | "audio";
      mediaPath?: string | null;
      mediaMime?: string | null;
      mediaName?: string | null;
    }) =>
      z
        .object({
          peerId: uuid,
          body: z.string().trim().max(4000).nullable().optional(),
          kind: z.enum(["text", "image", "video", "file", "audio"]).default("text"),
          mediaPath: z.string().trim().max(400).nullable().optional(),
          mediaMime: z.string().trim().max(160).nullable().optional(),
          mediaName: z.string().trim().max(200).nullable().optional(),
        })
        .refine((value) => Boolean(value.body?.trim()) || Boolean(value.mediaPath), {
          message: "Write a message or attach a file.",
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveChatIdentity, assertPeerAllowed } = await import("./chat.server");

    const identity = await resolveChatIdentity(context.userId);
    if (!identity) return { status: "unavailable" as const };
    if (identity.status !== "active") return { status: "blocked" as const };
    const peer = await assertPeerAllowed(identity, data.peerId);
    if (peer.status !== "active") return { status: "blocked" as const };

    const { error } = await supabaseAdmin.from("chat_messages").insert({
      sender_id: identity.id,
      recipient_id: peer.id,
      body: data.body?.trim() ? data.body.trim() : null,
      kind: data.kind,
      media_path: data.mediaPath ?? null,
      media_mime: data.mediaMime ?? null,
      media_name: data.mediaName ?? null,
    });
    if (error) throw new Error(error.message);
    return { status: "ok" as const };
  });

/** Signed upload slot for a photo/video/file sent in chat (originals, full quality). */
export const chatUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileName: string }) =>
    z
      .object({
        fileName: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .regex(/^[\w .()-]+\.[A-Za-z0-9]{1,8}$/, "Use a simple file name with an extension"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveChatIdentity, CHAT_BUCKET } = await import("./chat.server");

    const identity = await resolveChatIdentity(context.userId);
    if (!identity || identity.status !== "active") throw new Error("Chat is not available.");

    const safeName = data.fileName.replace(/[^\w.()-]+/g, "-");
    const path = `${identity.id}/${crypto.randomUUID()}-${safeName}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(CHAT_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not prepare the upload.");
    return { path: signed.path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const chatSetShowAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { showAvatar: boolean }) =>
    z.object({ showAvatar: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("chat_preferences")
      .upsert(
        { user_id: context.userId, show_avatar: data.showAvatar },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
