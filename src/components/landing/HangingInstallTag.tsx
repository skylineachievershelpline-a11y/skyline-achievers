import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  clearInstallPrompt,
  getInstallPrompt,
  isIosSafari,
  isPreviewContext,
  subscribeInstallPrompt,
  type InstallPromptEvent,
} from "@/lib/pwa-install";

/**
 * A "premium" hanging tag that sits beside the logo.
 * Uses the seat-tag-swing animation from styles.css.
 */
export function HangingInstallTag({ className }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const checkInstalled = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setInstalled(standalone);
    };

    checkInstalled();
    const unsubscribe = subscribeInstallPrompt(setPrompt);
    
    window.addEventListener("appinstalled", checkInstalled);
    return () => {
      unsubscribe();
      window.removeEventListener("appinstalled", checkInstalled);
    };
  }, []);

  // Don't show if already installed
  if (installed) return null;

  const handleInstall = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const nativePrompt = prompt ?? getInstallPrompt();
    if (nativePrompt) {
      try {
        await nativePrompt.prompt();
        const choice = await nativePrompt.userChoice;
        if (choice.outcome === "accepted") setInstalled(true);
      } finally {
        clearInstallPrompt();
      }
      return;
    }

    if (isPreviewContext()) {
      window.open("https://skyline-achievers.lovable.app/", "_blank", "noopener,noreferrer");
      toast.info("Published Skyline app opened for installation.");
      return;
    }

    const message = isIosSafari()
      ? "Tap Share, then 'Add to Home Screen' to install the app."
      : "Open your browser menu and tap 'Install app' or 'Add to Home screen'.";
    toast.info(message, { duration: 5000 });
    setGuideOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleInstall}
        className={cn("install-hanging-tag seat-tag-swing group h-[4.7rem] w-12 overflow-visible p-0", className)}
        aria-label="Install Skyline Achievers app"
        title="Install Skyline Achievers app"
      >
        <span className="install-tag-cord" aria-hidden />
        <span className="install-tag-body">
          <span className="install-tag-eyelet" aria-hidden />
          <Download className="h-4 w-4" />
          <span className="text-[8px] font-bold uppercase">Install</span>
        </span>
      </Button>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Install Skyline Achievers</DialogTitle>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            {(isIosSafari()
              ? ["Open this page in Safari.", "Tap the Share button.", "Choose Add to Home Screen, then tap Add."]
              : ["Open the published app link in Chrome.", "Tap the three-dot browser menu.", "Choose Install app or Add to Home screen."]
            ).map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">If Install is missing, update the browser and make sure the page is not open inside WhatsApp or Facebook.</p>
          <Button variant="brand" onClick={() => setGuideOpen(false)}>Got it</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
