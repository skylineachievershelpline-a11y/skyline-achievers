import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public VAPID key the browser needs to register a device. */
export const getPushKey = createServerFn({ method: "GET" }).handler(async () => {
  const { pushPublicKey } = await import("./push.server");
  return { publicKey: pushPublicKey() };
});

export const savePushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) =>
    z
      .object({
        endpoint: z.string().url().max(600),
        p256dh: z.string().min(10).max(400),
        auth: z.string().min(5).max(200),
        userAgent: z.string().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("push_subscriptions").upsert(
      {
        member_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removePushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { endpoint: string }) =>
    z.object({ endpoint: z.string().url().max(600) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("member_id", context.userId);
    return { ok: true as const };
  });

/** Sends a sample alert to the signed-in member's own devices. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPushToUsers } = await import("./push.server");
    const result = await sendPushToUsers([context.userId], {
      title: "Skyline Achievers",
      body: "Notifications are on. You will now get alerts even when the app is closed.",
      path: "/notifications",
      tag: "skyline-test",
    });
    return result;
  });
