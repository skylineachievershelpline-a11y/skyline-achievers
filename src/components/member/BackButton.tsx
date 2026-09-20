import { useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Universal back control. Steps back through history when there is somewhere to
 * go, otherwise lands on a safe fallback screen so users never get stuck.
 */
export function BackButton({
  fallback = "/dashboard",
  onBack,
  className,
  label = "Go back",
}: {
  fallback?: string;
  onBack?: () => void;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const navigate = useNavigate();

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    const canGoBack = router.history.canGoBack?.() ?? false;
    if (canGoBack) {
      router.history.back();
      return;
    }
    void navigate({ to: fallback });
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-metal/30 bg-surface text-foreground shadow-glass transition-colors hover:border-cyan/40 hover:bg-surface-2",
        className,
      )}
    >
      <ArrowLeft className="h-4.5 w-4.5" />
    </button>
  );
}
