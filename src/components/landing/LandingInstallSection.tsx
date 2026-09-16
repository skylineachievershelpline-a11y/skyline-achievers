import { Download, Share2, Smartphone, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Public landing "install our app" platform with the round brand app icon. */
export function LandingInstallSection() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <section
      id="install"
      className="infographic-grid border-b border-hairline px-5 py-16 sm:px-8 sm:py-24"
    >
      <div className="raised-panel metal-edge mx-auto flex max-w-4xl flex-col items-center gap-8 rounded-3xl p-6 text-center sm:p-10">
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-cyan/30 bg-background shadow-brand sm:h-36 sm:w-36">
          <img
            src="/app-icon-512.png"
            alt={`${BRAND.name} app icon`}
            width={512}
            height={512}
            className="h-[86%] w-[86%] rounded-full object-contain"
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-glow">
            Get the app
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            Install {BRAND.shortName} on your phone
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Add {BRAND.name} to your home screen for full-screen, one-tap access to your training —
            no app store needed.
          </p>
        </div>

        {installed ? (
          <p className="inset-panel flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold">
            <Smartphone className="h-4 w-4 text-brand-glow" /> App already installed on this device
          </p>
        ) : prompt ? (
          <Button
            variant="brand"
            size="xl"
            className="w-full sm:w-auto sm:min-w-56"
            onClick={async () => {
              await prompt.prompt();
              const choice = await prompt.userChoice;
              if (choice.outcome === "accepted") setInstalled(true);
              setPrompt(null);
            }}
          >
            <Download className="h-4 w-4" />
            Install app
          </Button>
        ) : isIos ? (
          <ol className="inset-panel w-full max-w-sm space-y-2 rounded-xl p-4 text-left text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <Share2 className="h-3.5 w-3.5 text-brand-glow" /> 1. Tap the Share button in Safari
            </li>
            <li>2. Choose “Add to Home Screen”</li>
            <li>3. Tap “Add” — the round app icon appears on your home screen</li>
          </ol>
        ) : (
          <p className="inset-panel flex items-center gap-2 rounded-xl px-4 py-3 text-xs text-muted-foreground">
            <Wifi className="h-3.5 w-3.5 text-brand-glow" />
            Open your browser menu and choose “Install app” or “Add to Home screen”.
          </p>
        )}
      </div>
    </section>
  );
}
