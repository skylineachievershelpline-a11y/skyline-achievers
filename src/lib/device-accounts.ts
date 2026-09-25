import { supabase } from "@/integrations/supabase/client";

/**
 * Accounts saved on this device so a person can switch between them with one
 * tap (like WhatsApp Business / Instagram). Only the account label and its
 * sign-in refresh token are stored — never a password.
 */
export type DeviceAccount = {
  userId: string;
  name: string;
  code: string;
  kind: "member" | "trainee";
  refreshToken: string;
  /** Kept so switching can restore the session instantly, without a refresh. */
  accessToken?: string;
  expiresAt?: number;
};

const KEY = "skyline-device-accounts";
const OPEN_LOGIN_KEY = "skyline-open-login";

export function listDeviceAccounts(): DeviceAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: DeviceAccount[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/** Save/refresh the currently signed-in account in the device list. */
export async function rememberCurrentAccount(info: {
  name?: string;
  code?: string;
  kind?: "member" | "trainee";
}) {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.refresh_token) return;
  const list = listDeviceAccounts();
  const existing = list.find((a) => a.userId === session.user.id);
  const next: DeviceAccount = {
    userId: session.user.id,
    name: info.name ?? existing?.name ?? "Account",
    code: info.code ?? existing?.code ?? "",
    kind: info.kind ?? existing?.kind ?? "member",
    refreshToken: session.refresh_token,
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? undefined,
  };
  write([next, ...list.filter((a) => a.userId !== next.userId)]);
}

export function forgetAccount(userId: string) {
  write(listDeviceAccounts().filter((a) => a.userId !== userId));
}

/** Switch to another saved account. Returns where to go, or null if it expired. */
export async function switchToAccount(userId: string): Promise<"/dashboard" | "/beginners" | null> {
  const target = listDeviceAccounts().find((a) => a.userId === userId);
  if (!target) return null;
  // Save the account we are leaving so we can come back to it in one tap.
  await rememberCurrentAccount({});
  const destination = target.kind === "trainee" ? "/beginners" : "/dashboard";

  // 1) Fastest path: put the stored session back without spending the
  //    one-time refresh token. Works while the access token is still valid.
  const stillValid =
    target.accessToken && target.expiresAt ? target.expiresAt * 1000 - Date.now() > 60_000 : false;
  if (target.accessToken && stillValid) {
    const { data, error } = await supabase.auth.setSession({
      access_token: target.accessToken,
      refresh_token: target.refreshToken,
    });
    if (!error && data.session) {
      await rememberCurrentAccount({ name: target.name, code: target.code, kind: target.kind });
      return destination;
    }
  }

  // 2) Otherwise renew the session from the saved refresh token.
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: target.refreshToken });
  if (error || !data.session) {
    // Keep the account in the list; the person only needs their password again.
    return null;
  }
  await rememberCurrentAccount({ name: target.name, code: target.code, kind: target.kind });
  return destination;
}


/** Go to the login screen to add another account, keeping this one saved. */
export async function startAddAccount() {
  await rememberCurrentAccount({});
  localStorage.setItem(OPEN_LOGIN_KEY, "1");
}

export function consumeOpenLoginFlag(): boolean {
  if (typeof window === "undefined") return false;
  const value = localStorage.getItem(OPEN_LOGIN_KEY) === "1";
  localStorage.removeItem(OPEN_LOGIN_KEY);
  return value;
}

// Keep the saved refresh token current whenever the active session refreshes.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    if (!session || (event !== "TOKEN_REFRESHED" && event !== "SIGNED_IN")) return;
    const list = listDeviceAccounts();
    const found = list.find((a) => a.userId === session.user.id);
    if (!found) return;
    found.refreshToken = session.refresh_token;
    found.accessToken = session.access_token;
    found.expiresAt = session.expires_at ?? undefined;
    write(list);
  });
}
