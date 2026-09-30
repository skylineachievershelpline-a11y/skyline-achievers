import { Download } from "lucide-react";
import { AppInstallDialog } from "@/components/pwa/AppInstallDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A "premium" hanging tag that sits beside the logo.
 * Uses the seat-tag-swing animation from styles.css.
 */
export function HangingInstallTag({ className }: { className?: string }) {
  return (
    <AppInstallDialog>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("landing-install-trigger group h-10 w-10 shrink-0 rounded-xl p-0", className)}
        aria-label="Install Skyline Achievers app"
        title="Install Skyline Achievers app"
      >
        <Download className="h-4.5 w-4.5" />
      </Button>
    </AppInstallDialog>
  );
}
