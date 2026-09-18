import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Props = {
  /** page = centered full-height cinematic loader, inline = compact mark only */
  variant?: "page" | "inline";
  label?: string;
  className?: string;
};

/**
 * Premium Skyline Achievers loader: the official logo is revealed step by step
 * (ring draws in, mark wipes up, silver glint sweeps across) instead of a
 * generic spinning circle. The logo asset itself is never altered.
 */
export function SkylineLoader({ variant = "inline", label, className }: Props) {
  const mark = (
    <div className={cn("skyline-loader-mark", variant === "page" && "skyline-loader-mark-lg")}>
      <svg className="skyline-loader-ring" viewBox="0 0 100 100" aria-hidden>
        <circle className="skyline-loader-ring-track" cx="50" cy="50" r="46" />
        <circle className="skyline-loader-ring-arc" cx="50" cy="50" r="46" />
      </svg>
      <div className="skyline-loader-logo">
        <img src={BRAND.logoUrl} alt={BRAND.logoAlt} className="skyline-loader-img" />
        <span className="skyline-loader-glint" aria-hidden />
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className={cn("skyline-loader", className)} role="status" aria-label={label ?? "Loading"}>
        {mark}
      </div>
    );
  }

  return (
    <div className={cn("skyline-loader skyline-loader-page", className)} role="status" aria-label={label ?? "Loading"}>
      <span className="skyline-loader-halo" aria-hidden />
      {mark}
      <div className="skyline-loader-text">
        <p className="skyline-loader-name">Skyline Achievers</p>
        <p className="skyline-loader-tagline">Learn • Earn • Lead</p>
      </div>
      <div className="skyline-loader-bar" aria-hidden>
        <span />
      </div>
      {label ? <p className="skyline-loader-status">{label}</p> : null}
    </div>
  );
}

export default SkylineLoader;
