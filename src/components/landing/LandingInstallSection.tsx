import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import {
  clearInstallPrompt,
  isIosSafari,
  isPreviewContext,
  subscribeInstallPrompt,
  type InstallPromptEvent,
} from "@/lib/pwa-install";

/** Public landing install platform: round brand app icon plus a single install button. */
export function LandingInstallSection() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const unsubscribe = subscribeInstallPrompt(setPrompt);
    const onInstalled = () => {
      setInstalled(true);
      setHint(null);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      unsubscribe();
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") setInstalled(true);
      } finally {
        clearInstallPrompt();
      }
      return;
    }

    if (isPreviewContext()) {
      const message = "Open the published app link in Chrome to install with one tap.";
      setHint(message);
      toast.info(message);
      return;
    }

    const message = isIosSafari()
      ? "In Safari tap Share, then “Add to Home Screen”."
      : "Open your browser menu, then tap “Install app” / “Add to Home screen”.";
    setHint(message);
    toast.info(message);
  };

  return (
    <section
      id="install"
      className="section-flow infographic-grid border-b border-hairline px-5 py-16 sm:px-8 sm:py-24"
    >
      <div data-reveal className="cinematic-card raised-panel metal-edge mx-auto flex max-w-4xl flex-col items-center gap-7 rounded-3xl p-6 text-center sm:p-10">
        <div className="app-icon-stage flex h-32 w-32 items-center justify-center rounded-full border border-cyan/30 bg-background shadow-brand sm:h-36 sm:w-36">
          <img
            src="/app-icon-512.png"
            alt={`${BRAND.name} app icon`}
            width={512}
            height={512}
            className="h-[86%] w-[86%] rounded-full object-contain"
          />
        </div>

        <h2 className="font-display text-3xl font-semibold sm:text-4xl">
          Install {BRAND.name} app
        </h2>

        {installed ? (
          <p className="inset-panel flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold">
            <Smartphone className="h-4 w-4 text-brand-glow" /> App installed
          </p>
        ) : (
          <>
            <Button
              variant="brand"
              size="xl"
              className="w-full sm:w-auto sm:min-w-56"
              onClick={install}
            >
              <Download className="h-4 w-4" />
              Install app
            </Button>
            {hint ? (
              <p className="inset-panel rounded-xl px-4 py-3 text-sm text-muted-foreground">{hint}</p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
