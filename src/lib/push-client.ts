/**
 * Browser side of push notifications: asks for permission once and stores the
 * device with the backend so alerts arrive while the app is closed.
 */
import { getPushKey, removePushDevice, savePushDevice } from "./push.functions";
import { isPreviewContext } from "./pwa-install";

export type PushStatus =
  | "unsupported"
  | "preview"
  | "denied"
  | "default"
  | "granted"
  | "not-configured";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function currentPushStatus(): PushStatus {
  if (!pushSupported()) return "unsupported";
  if (isPreviewContext()) return "preview";
  return Notification.permission as PushStatus;
}

/** Returns true when this device is registered for background alerts. */
export async function isPushRegistered() {
  if (!pushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    return Boolean(existing);
  } catch {
    return false;
  }
}

export type EnableResult =
  | { status: "registered" }
  | { status: "unsupported" | "preview" | "denied" | "not-configured" | "failed"; message: string };

/** Must be called from a click: browsers ignore silent permission requests. */
export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) {
    return {
      status: "unsupported",
      message: "This browser cannot show notifications. Try Chrome on Android or install the app.",
    };
  }
  if (isPreviewContext()) {
    return {
      status: "preview",
      message: "Open the app in its own browser tab (not the editor preview) to switch alerts on.",
    };
  }

  const { publicKey } = await getPushKey();
  if (!publicKey) {
    return { status: "not-configured", message: "Notifications are not set up on the server yet." };
  }

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      status: "denied",
      message: "Notifications are blocked. Allow them in your browser site settings.",
    };
  }

  try {
    const registration =
      (await navigator.serviceWorker.getRegistration("/sw.js")) ??
      (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
      }));

    const json = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { status: "failed", message: "This device did not return valid notification keys." };
    }

    await savePushDevice({
      data: {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent.slice(0, 300),
      },
    } as never);
    return { status: "registered" };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Could not switch notifications on.",
    };
  }
}

/** Removes this device so it stops receiving alerts. */
export async function disablePush() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => undefined);
  await removePushDevice({ data: { endpoint } } as never).catch(() => undefined);
}
