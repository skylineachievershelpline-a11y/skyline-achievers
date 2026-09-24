import { supabase } from "@/integrations/supabase/client";

/** The stored access token, used when the phone is offline and cannot refresh. */
function storedOfflineToken(): string | null {
  if (typeof window === "undefined" || navigator.onLine) return null;
  try {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    if (!key) return null;
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null");
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * A live access token, or null when the stored session cannot be refreshed.
 * Offline, the saved token is returned so the app opens with saved data.
 */
export async function getAccessToken(): Promise<string | null> {
  const offline = storedOfflineToken();
  if (offline) return offline;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? storedOfflineToken();
  } catch {
    return storedOfflineToken();
  }
}
