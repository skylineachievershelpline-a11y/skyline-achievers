import { Download, Smartphone } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BRAND } from "@/lib/brand";
import { clearInstallPrompt, getInstallPrompt, isIosSafari, isPreviewContext, subscribeInstallPrompt, type InstallPromptEvent } from "@/lib/pwa-install";
import { cn } from "@/lib/utils";

/** One native PWA installer shared by the landing page and dashboard Settings. */
export function AppInstallDialog({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const check = () => setInstalled(window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    check();
    const unsubscribe = subscribeInstallPrompt(setPrompt);
    window.addEventListener("appinstalled", check);
    return () => { unsubscribe(); window.removeEventListener("appinstalled", check); };
  }, []);

  const instructions = isIosSafari()
    ? ["Open this page in Safari", "Tap Share", "Choose Add to Home Screen"]
    : ["Open your browser menu", "Choose Install app or Add to Home screen", "Confirm Install"];

  async function install() {
    if (installed) return;
    const nativePrompt = prompt ?? getInstallPrompt();
    if (nativePrompt) {
      setInstalling(true);
      try {
        await nativePrompt.prompt();
        const choice = await nativePrompt.userChoice;
        if (choice.outcome === "accepted") { setInstalled(true); toast.success("Skyline Achievers installed successfully."); }
      } finally { setInstalling(false); clearInstallPrompt(); }
      return;
    }
    if (isPreviewContext()) {
      window.open("https://skyline-achievers.lovable.app/", "_blank", "noopener,noreferrer");
      toast.info("Published Skyline app opened. Use Install App there.");
      return;
    }
    toast.info(instructions.join(" — "), { duration: 6000 });
  }

  const manual = !prompt && !installed && !isPreviewContext();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="install-app-dialog gap-0 overflow-hidden rounded-2xl border-metal/30 p-0 sm:max-w-xl">
        <div className="px-5 pb-5 pt-6 sm:px-8 sm:pb-7 sm:pt-8">
          <DialogHeader className="pr-9 text-left">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="install-app-logo-stage shrink-0">
                <img src={BRAND.logoUrl} alt={BRAND.logoAlt} className="h-full w-full rounded-2xl object-cover" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-display text-xl font-semibold sm:text-2xl">{BRAND.name.toUpperCase()}</DialogTitle>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">Install the official Skyline Achievers app</p>
              </div>
            </div>
          </DialogHeader>
        </div>
        <div className="install-app-zone mx-4 mb-4 px-5 py-7 text-center sm:mx-7 sm:mb-7 sm:px-8 sm:py-8">
          <span className="install-app-status-icon mx-auto flex h-11 w-11 items-center justify-center rounded-xl">
            {installed ? <Smartphone className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          </span>
          <p className="mt-4 text-sm font-semibold">{installed ? "Skyline Achievers is installed on this device" : "Install Skyline Achievers on your device for a faster and smoother experience."}</p>
          {manual ? <ol className="mx-auto mt-4 max-w-sm space-y-1 text-xs leading-relaxed text-muted-foreground">{instructions.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}</ol> : null}
          <Button variant="brand" size="xl" disabled={installed || installing} onClick={() => void install()} className={cn("install-app-action mt-5 min-w-40 rounded-full px-7", installed && "opacity-100")}>
            {installed ? <Smartphone /> : <Download />}
            {installed ? "App Installed" : installing ? "Opening installer…" : "Install App"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}