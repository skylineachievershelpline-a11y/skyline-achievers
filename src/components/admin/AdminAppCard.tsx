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
    if (installed) {
      toast.info("Skyline Admin is already installed on this device.");
      return;
    }
    if (isPreviewContext()) {
      toast.info("Open the admin panel in its own browser tab, then press Install again.");
      setGuideOpen(true);
      return;
    }
    const prompt = getInstallPrompt();
    if (prompt) {
      try {
        await prompt.prompt();
        return;
      } catch {
        // fall through to the manual guide
      }
    }
    setGuideOpen(true);
  }

  const steps = isIosSafari()
    ? [
        "Tap the Share button at the bottom of Safari.",
        "Scroll down and tap “Add to Home Screen”.",
        "Name it Skyline Admin, then tap Add.",
      ]
    : [
        "Tap the three-dot menu at the top right of the browser.",
        "Tap “Install app” (or “Add to Home screen”).",
        "Confirm Install — Skyline Admin appears as its own icon.",
      ];

  return (
    <section className="raised-panel metal-edge mb-6 rounded-2xl p-4">
      <p className="font-display text-sm font-semibold">Skyline Admin app</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Install the admin panel as its own app and get admin alerts (payment proofs, course requests,
        leave applications) separately from your personal member app.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="rounded-xl" onClick={() => void install()}>
          <Download className="h-4 w-4" />
          {installed ? "Admin app installed" : "Install Skyline Admin app"}
        </Button>
        <Button variant="brand" className="rounded-xl" disabled={busy || on} onClick={() => void enable()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          {on ? "Admin alerts are on" : "Turn on admin alerts"}
        </Button>
      </div>
      {!installed && !canInstall ? (
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="mt-2 text-[11px] font-medium text-primary underline-offset-4 hover:underline"
        >
          How to install
        </button>
      ) : null}

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Install Skyline Admin</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-muted-foreground">
            Skyline Admin installs as its own app, separate from the member app. Three quick steps:
          </p>
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-muted-foreground">
            After installing, open Skyline Admin and sign in once with your admin username and
            password. It stays signed in after that.
          </p>
          <Button variant="brand" className="rounded-xl" onClick={() => setGuideOpen(false)}>
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

