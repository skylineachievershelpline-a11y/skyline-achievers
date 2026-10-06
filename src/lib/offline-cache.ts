import { hydrate, type QueryClient } from "@tanstack/react-query";

/**
 * The app opens like a messaging app: everything a person saw last time is
 * already on the phone, so screens paint immediately and the fresh copy is
 * fetched silently in the background.
 */
export const OFFLINE_CACHE_KEY = "skyline-offline-cache";
const LAST_SCREEN_KEY = "skyline-last-screen";
const MAX_AGE = 7 * 24 * 3_600_000;

/** Id of the signed-in account, used so one account never sees another's data. */
export function cacheOwnerId(): string {
  try {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    const parsed = key ? JSON.parse(localStorage.getItem(key) ?? "null") : null;
    return parsed?.user?.id ?? "guest";
  } catch {
    return "guest";
  }
}

/** True when this device already holds a signed-in account. */
export function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  } catch {
    return false;
  }
}

/**
 * Puts the saved screen data back into memory before anything renders, so no
 * screen ever shows a loading spinner for data it already had.
 */
export function hydrateSavedScreens(queryClient: QueryClient) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as {
      buster?: string;
      timestamp?: number;
      clientState?: unknown;
    };
    if (!saved?.clientState) return;
    if (saved.buster && saved.buster !== cacheOwnerId()) {
      localStorage.removeItem(OFFLINE_CACHE_KEY);
      return;
    }
    if (saved.timestamp && Date.now() - saved.timestamp > MAX_AGE) {
      localStorage.removeItem(OFFLINE_CACHE_KEY);
      return;
    }
    hydrate(queryClient, saved.clientState);
  } catch {
    /* a damaged saved copy simply means the screens load from the internet */
  }
}

/**
 * Only the person's own workspaces may be remembered. Shared links (reports,
 * invites, applications, videos, records) are temporary entry points and must
 * never become the screen the app reopens on.
 */
const WORKSPACES = new Set([
  "/dashboard",
  "/beginners",
  "/executive",
  "/team",
  "/seats",
  "/reels",
  "/training",
  "/courses",
  "/resources",
  "/search",
  "/profile",
  "/leave",
  "/chat",
  "/assistants",
  "/notifications",
  "/sessions",
  "/todo",
  "/payment-method",
]);

/** Remembers the last workspace screen so the app reopens right there. */
export function rememberLastScreen(path: string) {
  if (typeof window === "undefined") return;
  if (window.self !== window.top) return; // Skyline AI Teacher's classroom screen
  if (!WORKSPACES.has(path)) return;
  try {
    localStorage.setItem(LAST_SCREEN_KEY, path);
  } catch {
    /* ignore storage limits */
  }
}

export function lastScreen(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(LAST_SCREEN_KEY);
    if (saved && WORKSPACES.has(saved)) return saved;
    if (saved) localStorage.removeItem(LAST_SCREEN_KEY);
    return null;
  } catch {
    return null;
  }
}
