import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Public landing install platform: round brand app icon plus a single install button. */
export function LandingInstallSection() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

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

  const install = async () => {
    if (!prompt) {
      toast.info("Tap your browser menu, then “Install app”.");
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  return (
    <section
      id="install"
      className="infographic-grid border-b border-hairline px-5 py-16 sm:px-8 sm:py-24"
    >
      <div className="raised-panel metal-edge mx-auto flex max-w-4xl flex-col items-center gap-7 rounded-3xl p-6 text-center sm:p-10">
        <div className="flex h-32 w-32 items-center justify-center rounded-full border border-cyan/30 bg-background shadow-brand sm:h-36 sm:w-36">
          <img
            src="/app-icon-512.png"
            alt={`${BRAND.name} app icon`}
            width={512}
            height={512}
            className="h-[86%] w-[86%] rounded-full object-contain"
          />
        </div>

        <h2 className="font-display text-3xl font-semibold sm:text-4xl">
          Install {BRAND.shortName} app
        </h2>

        {installed ? (
          <p className="inset-panel flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold">
            <Smartphone className="h-4 w-4 text-brand-glow" /> App installed
          </p>
        ) : (
          <Button variant="brand" size="xl" className="w-full sm:w-auto sm:min-w-56" onClick={install}>
            <Download className="h-4 w-4" />
            Install app
          </Button>
        )}
      </div>
    </section>
  );
}
