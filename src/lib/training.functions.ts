import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The signed-in member's mandatory training status. */
export const getMyTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { trainingStatus } = await import("./training.server");
    const s = await trainingStatus(context.userId);
    const { data } = await (await import("@/integrations/supabase/client.server")).supabaseAdmin
      .from("member_profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      required: s.required,
      locked: s.locked,
      name: data?.full_name ?? "",
      row: {
        current_chapter: s.row.current_chapter,
        current_lesson: s.row.current_lesson,
        current_stage: s.row.current_stage,
        unlocked_chapter: s.row.unlocked_chapter,
        status: s.row.status,
        chapters: s.row.chapters ?? {},
        remediation_count: s.row.remediation_count,
        final_passed: s.row.final_passed,
        admin_completed: s.row.admin_completed,
        completed_at: s.row.completed_at,
      },
    };
  });

/** Admin: view or mark a member's mandatory training complete. */
export const adminGetTraining = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { trainingStatus } = await import("./training.server");
    const s = await trainingStatus(data.id);
    return { required: s.required, locked: s.locked, adminCompleted: s.row.admin_completed, chapters: s.row.chapters ?? {}, current: s.row.current_chapter };
  });

export const adminSetTrainingComplete = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; complete: boolean }) =>
    z.object({ id: z.string().uuid(), complete: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { loadTraining } = await import("./training.server");
    await loadTraining(data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("fbo_training")
      .update({
        admin_completed: data.complete,
        completed_at: data.complete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", data.id);
    return { ok: true };
  });
