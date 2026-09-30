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

/** Remembers the last screen the person was on so the app reopens right there. */
export function rememberLastScreen(path: string) {
  if (typeof window === "undefined") return;
  if (
    !path ||
    path === "/" ||
    path.startsWith("/admin") ||
    path.startsWith("/session/") ||
    path.startsWith("/enrollment-video")
  )
    return;
  try {
    localStorage.setItem(LAST_SCREEN_KEY, path);
  } catch {
    /* ignore storage limits */
  }
}

export function lastScreen(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_SCREEN_KEY);
  } catch {
    return null;
  }
}
