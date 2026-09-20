import { supabase } from "@/integrations/supabase/client";

/**
 * Signs the user out without making them wait on the network.
 *
 * The local session is cleared first (that is what every guard in the app
 * checks), the screen moves straight away, and the server-side revoke runs in
 * the background. This keeps the Logout tap feeling instant even on a slow
 * connection.
 */
export function fastSignOut(go: (path: string) => void, to = "/") {
  // Fire-and-forget: local scope clears storage immediately, no round trip.
  void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  go(to);
  // Best-effort global revoke afterwards; failures do not matter to the user.
  void supabase.auth.signOut().catch(() => undefined);
}
