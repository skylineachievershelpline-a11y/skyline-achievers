import { useServerFn } from "@tanstack/react-start";
import { BellRing, Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { adminSavePushDevice } from "@/lib/admin.functions";
import { getPushKey } from "@/lib/push.functions";
import { getInstallPrompt, isIosSafari, isPreviewContext, subscribeInstallPrompt } from "@/lib/pwa-install";

function toKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * The separate Skyline Admin app: its own install and its own alert channel,
 * using a service worker registered only for the /admin area so a phone can
 * have the member app and the admin app side by side with separate alerts.
 */
export function AdminAppCard() {
  const save = useServerFn(adminSavePushDevice);
  const [canInstall, setCanInstall] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeInstallPrompt((event) => setCanInstall(Boolean(event))), []);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistration("/admin").then(async (reg) => {
      if (reg?.scope.endsWith("/admin") && (await reg.pushManager.getSubscription())) setOn(true);
    });
  }, []);

  async function enable() {
    if (isPreviewContext()) {
      toast.info("Open the admin panel in its own browser tab to turn on admin alerts.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("This browser cannot show notifications.");
      return;
    }
    setBusy(true);
    try {
      const { publicKey } = await getPushKey();
      if (!publicKey) throw new Error("Notifications are not set up yet.");
      const permission =
        Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications were blocked in the browser settings.");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/admin" });
      await navigator.serviceWorker.ready;
      const active = reg.active ?? reg.installing ?? reg.waiting;
      if (active && active.state !== "activated") {
        await new Promise<void>((resolve) => {
          active.addEventListener("statechange", () => active.state === "activated" && resolve());
          setTimeout(resolve, 4000);
        });
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
      const json = sub.toJSON() as any;
      await save({
        data: { endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, userAgent: navigator.userAgent.slice(0, 300) },
      });
      setOn(true);
      toast.success("Admin alerts are on for this device");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    const prompt = getInstallPrompt();
    if (prompt) {
      await prompt.prompt();
      return;
    }
    toast.info(
      isIosSafari()
        ? "Tap Share, then Add to Home Screen to install Skyline Admin."
        : "Open the browser menu and choose Install app / Add to Home screen.",
    );
  }

  return (
    <section className="raised-panel metal-edge mb-6 rounded-2xl p-4">
      <p className="font-display text-sm font-semibold">Skyline Admin app</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Install the admin panel as its own app and get admin alerts (payment proofs, course requests,
        leave applications) separately from your personal member app.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="rounded-xl" onClick={() => void install()}>
          <Download className="h-4 w-4" /> {canInstall ? "Install Skyline Admin" : "How to install"}
        </Button>
        <Button variant="brand" className="rounded-xl" disabled={busy || on} onClick={() => void enable()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          {on ? "Admin alerts are on" : "Turn on admin alerts"}
        </Button>
      </div>
    </section>
  );
}
