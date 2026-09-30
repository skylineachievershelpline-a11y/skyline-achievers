import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BRAND } from "@/lib/brand";
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
  const [installing, setInstalling] = useState(false);

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

    setGuideOpen(true);
  };

  const beginInstall = async () => {
    const nativePrompt = prompt ?? getInstallPrompt();
    if (nativePrompt) {
      setInstalling(true);
      try {
        await nativePrompt.prompt();
        const choice = await nativePrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
          toast.success("Skyline Achievers installed successfully.");
        }
      } finally {
        setInstalling(false);
        clearInstallPrompt();
      }
      return;
    }

    if (isPreviewContext()) {
      window.open("https://skyline-achievers.lovable.app/", "_blank", "noopener,noreferrer");
      toast.info("Published Skyline app opened. Tap this install icon there.");
      return;
    }

    const message = isIosSafari()
      ? "Tap Share, then 'Add to Home Screen' to install the app."
      : "Open your browser menu and tap 'Install app' or 'Add to Home screen'.";
    toast.info(message, { duration: 5000 });
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleInstall}
        className={cn("landing-install-trigger group h-10 w-10 shrink-0 rounded-xl p-0", className)}
        aria-label="Install Skyline Achievers app"
        title="Install Skyline Achievers app"
      >
        <Download className="h-4.5 w-4.5" />
      </Button>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="install-app-dialog gap-5 rounded-2xl p-5 sm:max-w-md sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <div className="flex items-center gap-4">
              <img src={BRAND.logoUrl} alt={BRAND.logoAlt} className="h-16 w-16 rounded-2xl object-cover shadow-brand" />
              <div>
                <DialogTitle className="font-display text-xl">{BRAND.name}</DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">Official mobile app</p>
              </div>
            </div>
          </DialogHeader>
          <div className="install-app-dropzone">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-brand-glow">
              {installed ? <Smartphone className="h-6 w-6" /> : <Download className="h-6 w-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{installed ? "Installed on this device" : installing ? "Opening installer…" : "Ready to install"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{installed ? "Skyline Achievers is ready from your home screen." : "Fast one-tap access from your phone home screen."}</p>
            </div>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-xs font-medium">
              <span>{installed ? "Complete" : installing ? "Waiting for confirmation" : "Installation status"}</span>
              <span>{installed ? "100%" : "0%"}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full bg-primary transition-[width] duration-500", installed ? "w-full" : "w-0")} />
            </div>
          </div>
          {!prompt && !installed && !isPreviewContext() ? (
            <ol className="space-y-2 text-xs text-muted-foreground">
              {(isIosSafari()
                ? ["Open this page in Safari", "Tap Share", "Choose Add to Home Screen"]
                : ["Open the browser menu", "Choose Install app or Add to Home screen"]
              ).map((step, index) => <li key={step}>{index + 1}. {step}</li>)}
            </ol>
          ) : null}
          <Button variant="brand" size="xl" disabled={installed || installing} onClick={() => void beginInstall()}>
            {installed ? <Smartphone className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {installed ? "Installed" : installing ? "Installing…" : "Install app"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">Installation progress is confirmed by your browser and phone.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
