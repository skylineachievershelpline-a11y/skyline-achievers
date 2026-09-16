import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["ayat", "hadees"]),
  partOfDay: z.enum(["morning", "evening", "night"]),
  textUr: z.string().trim().max(1200).optional(),
  textEn: z.string().trim().max(1200).optional(),
  reference: z.string().trim().max(160).optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
});

export type InspirationInput = z.infer<typeof saveSchema>;

/** All daily verses and hadees, newest grouping first. */
export const adminGetInspirations = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("daily_inspirations")
    .select("*")
    .order("part_of_day", { ascending: true })
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
});

export const adminSaveInspiration = createServerFn({ method: "POST" })
  .inputValidator((data: InspirationInput) => saveSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    if (!data.textUr && !data.textEn) {
      throw new Error("Please add the text in Urdu or English.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      kind: data.kind,
      part_of_day: data.partOfDay,
      text_ur: data.textUr || null,
      text_en: data.textEn || null,
      reference: data.reference || null,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("daily_inspirations")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("daily_inspirations").insert(row);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const adminDeleteInspiration = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("daily_inspirations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
