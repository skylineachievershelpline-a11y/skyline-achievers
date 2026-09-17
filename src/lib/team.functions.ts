import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const personSchema = z.object({
  fullName: z.string().trim().min(3, "Enter the full name").max(80),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+\-\s]+$/, "Phone number may only contain digits"),
  // Only adults may join.
  age: z.number({ message: "Enter the age" }).int().min(18, "Member must be 18 or older").max(90),
});

async function activeMember(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("member_profiles")
    .select("id, member_id, full_name, status")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") throw new Error("Your membership is not active.");
  return data;
}

/** Everything the upline sees: progress numbers, their people and invite links. */
export const getMyTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const member = await activeMember(context.userId);
    const { traineeStatsFor } = await import("./team.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [team, { data: invites }] = await Promise.all([
      traineeStatsFor(member.id),
      supabaseAdmin
        .from("trainee_invites")
        .select("id, token, label, is_active, uses, created_at")
        .eq("upline_id", member.id)
        .order("created_at", { ascending: false }),
    ]);
    return {
      upline: { memberId: member.member_id, fullName: member.full_name },
      ...team,
      invites: invites ?? [],
    };
  });

/** Reserve a seat: the upline fills the form and gets the ID + password card. */
export const reserveSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fullName: string; phone: string; age: number | null }) =>
    personSchema.parse(data),
  )

  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { createTraineeAccount } = await import("./team.server");
    const credentials = await createTraineeAccount({
      fullName: data.fullName,
      phone: data.phone,
      age: data.age,
      uplineId: member.id,
      source: "upline",
    });
    return { credentials };
  });

export const setTraineeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string; status: "active" | "blocked" }) =>
    z
      .object({
        traineeId: z.string().uuid(),
        status: z.enum(["active", "blocked"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: trainee } = await supabaseAdmin
      .from("trainees")
      .select("id, upline_id")
      .eq("id", data.traineeId)
      .maybeSingle();
    if (!trainee || trainee.upline_id !== member.id) {
      throw new Error("You can only manage the people you registered.");
    }
    const { error } = await supabaseAdmin
      .from("trainees")
      .update({ status: data.status })
      .eq("id", data.traineeId);
    if (error) throw new Error(error.message);
    // Blocked accounts lose their live session immediately.
    await supabaseAdmin.auth.admin.updateUserById(data.traineeId, {
      ban_duration: data.status === "active" ? "none" : "876000h",
    });
    return { ok: true as const };
  });

/** Remove means remove: the login, the record and the chats all disappear. */
export const deleteTrainee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { traineeId: string }) =>
    z.object({ traineeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: trainee } = await supabaseAdmin
      .from("trainees")
      .select("id, upline_id")
      .eq("id", data.traineeId)
      .maybeSingle();
    if (!trainee || trainee.upline_id !== member.id) {
      throw new Error("You can only manage the people you registered.");
    }
    const { deleteTraineeAccount } = await import("./team.server");
    return deleteTraineeAccount(data.traineeId);
  });


export const createInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { label: string }) =>
    z.object({ label: z.string().trim().max(60) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(9).toString("base64url");
    const { error } = await supabaseAdmin.from("trainee_invites").insert({
      token,
      upline_id: member.id,
      label: data.label || null,
    });
    if (error) throw new Error(error.message);
    return { token };
  });

export const setInviteActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; isActive: boolean }) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trainee_invites")
      .update({ is_active: data.isActive })
      .eq("id", data.id)
      .eq("upline_id", member.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const member = await activeMember(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trainee_invites")
      .delete()
      .eq("id", data.id)
      .eq("upline_id", member.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
