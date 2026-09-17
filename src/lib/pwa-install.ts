/**
 * Captures the browser install prompt as early as possible.
 *
 * `beforeinstallprompt` can fire before React mounts, so we listen at module
 * scope and let components subscribe to the captured event.
 */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let captured: InstallPromptEvent | null = null;
const listeners = new Set<(event: InstallPromptEvent | null) => void>();

function emit() {
  listeners.forEach((listener) => listener(captured));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    captured = event as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    captured = null;
    emit();
  });
}

export function getInstallPrompt() {
  return captured;
}

export function clearInstallPrompt() {
  captured = null;
  emit();
}

export function subscribeInstallPrompt(listener: (event: InstallPromptEvent | null) => void) {
  listeners.add(listener);
  listener(captured);
  return () => {
    listeners.delete(listener);
  };
}

/** True inside the Lovable editor preview, where browsers block install prompts. */
export function isPreviewContext() {
  if (typeof window === "undefined") return false;
  if (window.self !== window.top) return true;
  const host = window.location.hostname;
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovableproject-dev.com")
  );
}

export function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
}
