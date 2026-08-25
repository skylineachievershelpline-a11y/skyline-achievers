import { Download, Share2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** "Install app" card: uses the native prompt where it exists, iOS steps otherwise. */
export function InstallApp() {
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

  if (installed) {
    return (
      <div className="glass-panel rounded-3xl p-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="h-4 w-4 text-brand-glow" /> App installed
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          You are already using the Skyline Achievers app on this device.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-3xl p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Smartphone className="h-4 w-4 text-brand-glow" /> Install the app
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Add Skyline Achievers to your home screen for full-screen, one-tap access to your training.
      </p>

      {prompt ? (
        <Button
          variant="brand"
          size="xl"
          className="mt-4 w-full"
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
        <ol className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <Share2 className="h-3.5 w-3.5 text-brand-glow" /> 1. Tap the Share button in Safari
          </li>
          <li>2. Choose “Add to Home Screen”</li>
          <li>3. Tap “Add” — the app icon appears on your home screen</li>
        </ol>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Open your browser menu and choose “Install app” or “Add to Home screen”.
        </p>
      )}
    </div>
  );
}
