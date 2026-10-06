/**
 * Web Push sender (RFC 8291 / VAPID). Runs inside server functions only.
 * Every alert the app already stores can also be delivered to a member's
 * device while the app is closed.
 */
import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";

export type PushPayload = {
  title: string;
  body: string;
  /** In-app path opened when the notification is tapped. */
  path?: string;
  tag?: string;
};

type Row = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function vapid() {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:support@skyline-achievers.lovable.app";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function pushPublicKey() {
  return process.env["VAPID_PUBLIC_KEY"] ?? null;
}

/**
 * Sends one notification to every registered device of the given users.
 * Never throws: a failed device must not break the action that triggered it.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  const keys = vapid();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!keys || ids.length === 0) return { sent: 0, removed: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("member_id", ids);

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return { sent: 0, removed: 0 };

  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    rows.map(async (row) => {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        const message = await buildPushPayload(
          {
            data: {
              title: payload.title,
              body: payload.body,
              path: payload.path ?? "/notifications",
              tag: payload.tag ?? "skyline",
            },
            options: { ttl: 86_400, urgency: "high" },
          },
          subscription,
          keys,
        );
        const res = await fetch(row.endpoint, {
          method: "POST",
          headers: message.headers,
          body: message.body as unknown as BodyInit,
        });
        if (res.status === 404 || res.status === 410) {
          stale.push(row.id);
          return;
        }
        if (!res.ok) {
          console.error(`push failed [${res.status}]: ${await res.text()}`);
          return;
        }
        sent += 1;
      } catch (error) {
        console.error("push send error", error);
      }
    }),
  );

  if (stale.length > 0) await admin.from("push_subscriptions").delete().in("id", stale);
  if (sent > 0) {
    await admin
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .in(
        "id",
        rows.filter((row) => !stale.includes(row.id)).map((row) => row.id),
      );
  }
  return { sent, removed: stale.length };
}

/** Fire-and-forget helper for action handlers. */
export function pushToUsers(userIds: string[], payload: PushPayload) {
  return sendPushToUsers(userIds, payload).catch((error) => {
    console.error("push dispatch error", error);
    return { sent: 0, removed: 0 };
  });
}

/** Every active member device (used for admin announcements). */
export async function pushToEveryone(payload: PushPayload, levelId?: string | string[] | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  let query = admin.from("member_profiles").select("id").eq("status", "active");
  if (Array.isArray(levelId)) {
    if (levelId.length) query = query.in("level_id", levelId);
  } else if (levelId) query = query.eq("level_id", levelId);
  const { data } = await query;
  const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
  return pushToUsers(ids, payload);
}

/** Admin app devices are stored under this fixed id, separate from every member. */
export const ADMIN_PUSH_ID = "00000000-0000-0000-0000-00000000ad00";

/** Alerts for the separate Skyline Admin app only. Never throws. */
export function pushToAdmin(payload: PushPayload) {
  return pushToUsers([ADMIN_PUSH_ID], { path: "/admin", tag: "admin", ...payload });
}
