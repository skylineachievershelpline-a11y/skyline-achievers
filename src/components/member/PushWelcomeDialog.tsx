import { BellRing, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { currentPushStatus, enablePush, isPushRegistered } from "@/lib/push-client";

const KEY = "skyline-push-welcome-dismissed";

/**
 * Shown once when a signed-in person opens the site or the installed app and
 * notifications are not switched on yet. One tap asks the phone for permission.
 */
export function PushWelcomeDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(KEY)) return;
    if (currentPushStatus() !== "default") return;
    void isPushRegistered().then((registered) => {
      if (!registered) setOpen(true);
    });
  }, []);

  function close() {
    localStorage.setItem(KEY, String(Date.now()));
    setOpen(false);
  }

  async function allow() {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    if (result.status === "registered") toast.success("Notifications are on for this device");
    else toast.error(result.message);
    close();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="raised-panel metal-edge w-full max-w-sm rounded-3xl p-6 text-center animate-rise-in">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan/30 bg-surface-2 text-cyan">
          <BellRing className="h-7 w-7" />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold">Turn on notifications</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Get session times, review reminders, approvals, announcements, reels and daily
          motivation — even when the app is closed.
        </p>
        <Button
          variant="brand"
          size="xl"
          className="mt-5 w-full rounded-2xl"
          disabled={busy}
          onClick={() => void allow()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          Allow notifications
        </Button>
        <button
          type="button"
          onClick={close}
          className="mt-3 text-xs text-muted-foreground hover:text-foreground"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
