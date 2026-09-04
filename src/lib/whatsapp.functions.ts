import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * WhatsApp groups are unlocked with a join code. The table is unreachable from
 * the browser: only this server function reads it, and only on an exact match.
 */
export const openWhatsappGroup = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .min(4, "Enter the full group code")
          .max(40)
          .transform((v) => v.toUpperCase()),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await (supabaseAdmin as any)
      .from("whatsapp_groups")
      .select("id, join_code, title, description, invite_url, is_published")
      .ilike("join_code", data.code)
      .maybeSingle();

    if (!row || !row.is_published || String(row.join_code).toUpperCase() !== data.code) {
      return { status: "invalid" as const };
    }

    return {
      status: "ok" as const,
      group: {
        id: row.id as string,
        code: String(row.join_code).toUpperCase(),
        title: row.title as string,
        description: (row.description ?? null) as string | null,
        inviteUrl: row.invite_url as string,
      },
    };
  });
