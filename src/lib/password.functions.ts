import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ current: z.string().min(1).max(200), next: z.string().min(8).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      const email = (context.claims as { email?: string }).email;
      if (!email) return { ok: false as const, message: "Account email not found." };
      const url = process.env['SUPABASE_URL']!;
      const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
      const verifier = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signInError } = await verifier.auth.signInWithPassword({
        email,
        password: data.current,
      });
      if (signInError) return { ok: false as const, message: "Your current password is incorrect." };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        password: data.next,
      });
      if (error) return { ok: false as const, message: "Password could not be changed. Try a different one." };
      return { ok: true as const };
    } catch (e) {
      console.error("changeMyPassword", e);
      return { ok: false as const, message: "Something went wrong. Please try again." };
    }
  });
