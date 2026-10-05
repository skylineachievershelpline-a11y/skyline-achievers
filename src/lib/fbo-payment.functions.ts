import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const methodSchema = z.object({
  provider: z.string().trim().min(1).max(40),
  accountTitle: z.string().trim().min(1).max(80),
  accountNumber: z.string().trim().min(3).max(40),
  note: z.string().trim().max(300).optional().default(""),
});
export type FboPaymentMethod = z.infer<typeof methodSchema>;

function readMethods(value: any): FboPaymentMethod[] {
  if (Array.isArray(value?.methods)) return value.methods.slice(0, 3);
  return value?.method ? [value.method] : [];
}

const keyFor = (memberId: string) => `fbo_payment:${memberId}`;

async function ownMemberId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("member_profiles")
    .select("member_id, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.member_id) throw new Error("Member profile not found.");
  return data as { member_id: string; full_name: string };
}

export const getMyPaymentMethod = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await ownMemberId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("platform_settings")
      .select("value")
      .eq("key", keyFor(me.member_id))
      .maybeSingle();
    return { memberId: me.member_id, methods: readMethods(data?.value) };
  });

export const saveMyPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ methods: z.array(methodSchema).max(3) }).parse(data))
  .handler(async ({ context, data }) => {
    const me = await ownMemberId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("platform_settings").upsert({
      key: keyFor(me.member_id),
      value: { methods: data.methods, method: data.methods[0] ?? null, fullName: me.full_name },
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not save payment method.");
    return { ok: true };
  });

/** Public: the payment card an FBO chose to show on their enrollment link. */
export const getFboPublicPayment = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ fbo: z.string().regex(/^\d{12}$/) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("platform_settings")
      .select("value")
      .eq("key", keyFor(data.fbo))
      .maybeSingle();
    const methods = readMethods(row?.value);
    if (!methods.length) return { method: null, methods: [], fullName: null };
    return {
      method: methods[0],
      methods,
      fullName: (row.value.fullName ?? null) as string | null,
    };
  });
