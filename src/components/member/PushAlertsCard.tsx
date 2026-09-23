import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { sendTestPush } from "@/lib/push.functions";
import {
  currentPushStatus,
  disablePush,
  enablePush,
  isPushRegistered,
  type PushStatus,
} from "@/lib/push-client";
import { cn } from "@/lib/utils";

/**
 * One-tap control for background alerts. Shown on the dashboard and the
 * announcements page so a member can switch phone notifications on.
 */
export function PushAlertsCard({ className }: { className?: string }) {
  const [status, setStatus] = useState<PushStatus>("default");
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const test = useServerFn(sendTestPush);

  useEffect(() => {
    setStatus(currentPushStatus());
    void isPushRegistered().then(setRegistered);
  }, []);

  const sendTest = useMutation({
    mutationFn: () => test(),
    onSuccess: (result: { sent: number }) => {
      if (result.sent > 0) toast.success("Test alert sent to your device");
      else toast.error("No device is registered yet — switch alerts on first");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function turnOn() {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    setStatus(currentPushStatus());
    if (result.status === "registered") {
      setRegistered(true);
      toast.success("Notifications are on for this device");
      return;
    }
    toast.error(result.message);
  }

  async function turnOff() {
    setBusy(true);
    await disablePush();
    setBusy(false);
    setRegistered(false);
    toast.success("Notifications switched off for this device");
  }

  const unavailable = status === "unsupported";

  return (
    <div className={cn("glass-panel rounded-2xl p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/30 bg-surface-2 text-cyan">
          {registered ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-foreground">
            Phone notifications {registered ? "on" : "off"}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            {unavailable
              ? "This browser cannot show alerts. Install the app or use Chrome."
              : status === "preview"
                ? "Open the app in its own browser tab to switch alerts on."
                : registered
                  ? "You get session, review, payment and reminder alerts even when the app is closed."
                  : "Turn this on to receive alerts on your lock screen — even when the app is closed."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {registered ? (
              <>
                <button
                  type="button"
                  onClick={() => void turnOff()}
                  disabled={busy}
                  className="rounded-xl border border-metal/30 bg-surface px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:border-cyan/40 disabled:opacity-60"
                >
                  Turn off
                </button>
                <button
                  type="button"
                  onClick={() => sendTest.mutate()}
                  disabled={sendTest.isPending}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan/30 bg-surface-2 px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:border-cyan/50 disabled:opacity-60"
                >
                  {sendTest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Send test alert
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void turnOn()}
                disabled={busy || unavailable}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan/30 brand-gradient px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-brand transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
                Turn on notifications
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
