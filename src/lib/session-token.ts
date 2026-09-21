import { supabase } from "@/integrations/supabase/client";

/**
 * A live access token, or null when the stored session cannot be refreshed.
 * Protected server functions reject without this token, so callers must check
 * it before asking the server anything.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
