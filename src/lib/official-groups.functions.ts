import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const GROUP_PLACEMENTS = ["member", "mentorship", "beginners", "executive", "report"] as const;
export type GroupPlacement = (typeof GROUP_PLACEMENTS)[number];

export const PLACEMENT_LABEL: Record<GroupPlacement, string> = {
  member: "FBO Member dashboard",
  mentorship: "Personal Mentorship dashboard",
  beginners: "Beginners dashboard",
  executive: "Growth Executive dashboard",
  report: "Daily Report group",
};

const placement = z.enum(GROUP_PLACEMENTS);

/** Published official group for one dashboard. Only returns what the join screen needs. */
export const getOfficialGroup = createServerFn({ method: "GET" })
  .inputValidator((data: { placement: GroupPlacement }) => z.object({ placement }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("official_groups")
      .select("placement, title, rules, invite_url, is_published")
      .eq("placement", data.placement)
      .maybeSingle();
    if (!row || !row.is_published) return { group: null };
    return {
      group: {
        placement: row.placement as GroupPlacement,
        title: row.title as string,
        rules: row.rules as string,
        inviteUrl: row.invite_url as string,
      },
    };
  });

export const adminGetOfficialGroups = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).from("official_groups").select("*");
  if (error) throw new Error(error.message);
  return { groups: (data ?? []) as Array<{
    placement: GroupPlacement;
    title: string;
    rules: string;
    invite_url: string;
    is_published: boolean;
  }> };
});

export const adminSaveOfficialGroup = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { placement: GroupPlacement; title: string; rules: string; inviteUrl: string; isPublished: boolean }) =>
      z
        .object({
          placement,
          title: z.string().trim().min(2).max(160),
          rules: z.string().trim().max(6000),
          inviteUrl: z
            .string()
            .trim()
            .url("Paste the full WhatsApp invite link")
            .max(600)
            .refine((v) => /chat\.whatsapp\.com\//i.test(v), {
              message: "Use a https://chat.whatsapp.com/... invite link",
            }),
          isPublished: z.boolean(),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("official_groups").upsert({
      placement: data.placement,
      title: data.title,
      rules: data.rules,
      invite_url: data.inviteUrl,
      is_published: data.isPublished,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
