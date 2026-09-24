import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  clearInstallPrompt,
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
      toast.info("Install Skyline by opening the link in your mobile browser.");
      return;
    }

    const message = isIosSafari()
      ? "Tap Share, then 'Add to Home Screen' to install the app."
      : "Open your browser menu and tap 'Install app' or 'Add to Home screen'.";
    toast.info(message, { duration: 5000 });
  };

  return (
    <button
      onClick={handleInstall}
      className={cn(
        "seat-tag-swing flex flex-col items-center group touch-none select-none",
        className
      )}
      aria-label="Install App"
    >
      <div className="h-3 w-px bg-white/20 group-hover:bg-brand/40 transition-colors" />
      <div className="relative flex flex-col items-center justify-center w-9 h-11 bg-brand-gradient rounded-b-lg rounded-t-[2px] shadow-brand text-brand-foreground border border-white/10">
        <Download className="h-4 w-4" />
        <span className="mt-0.5 text-[7px] font-black uppercase tracking-tighter leading-none">App</span>
        
        {/* The "hole" for the string */}
        <div className="absolute top-1 w-1.5 h-1.5 rounded-full bg-background/30 shadow-inner" />
        
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg" />
      </div>
    </button>
  );
}
