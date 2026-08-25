import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";

import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The logo doubles as the hidden staff entrance: five quick taps opens the
 * passcode screen. Members never see any admin affordance.
 * The mark is always rendered as a perfect circle.
 */
export function BrandLogo({
  size = "md",
  withWordmark = true,
  secretGesture = false,
  className,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  withWordmark?: boolean;
  secretGesture?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const clicks = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dimension =
    size === "xl"
      ? "h-24 w-24"
      : size === "lg"
        ? "h-16 w-16"
        : size === "sm"
          ? "h-8 w-8"
          : "h-11 w-11";

  function onTap() {
    if (!secretGesture) return;
    clicks.current += 1;
    if (timer.current) clearTimeout(timer.current);
    if (clicks.current >= 5) {
      clicks.current = 0;
      void navigate({ to: "/admin/login" });
      return;
    }
    timer.current = setTimeout(() => {
      clicks.current = 0;
    }, 1200);
  }

  return (
    <div
      onClick={onTap}
      className={cn("flex select-none items-center gap-3", secretGesture && "cursor-pointer", className)}
    >
      <img
        src={BRAND.logoUrl}
        alt={BRAND.logoAlt}
        className={cn(
          dimension,
          "shrink-0 rounded-full object-cover ring-1 ring-hairline",
          "shadow-[var(--shadow-brand)]",
        )}
        draggable={false}
      />
      {withWordmark ? (
        <div className="leading-tight">
          <p className="font-display text-base font-semibold tracking-tight text-foreground">
            {BRAND.name}
          </p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {BRAND.tagline}
          </p>
        </div>
      ) : null}
    </div>
  );
}
