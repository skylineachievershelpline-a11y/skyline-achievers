import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Clear reminder that the trainee must also send the session review to their
 * upline on WhatsApp, with a one-tap share button that pre-fills the message.
 */
export function ReviewShareNotice({
  sessionTitle,
  sessionCode,
  phone,
  className = "",
}: {
  sessionTitle: string;
  sessionCode?: string | null;
  /** Upline WhatsApp number in international digits, when known. */
  phone?: string | null;
  className?: string;
}) {
  const text = [
    "Skyline Achievers — Session Review",
    `Session: ${sessionTitle}`,
    sessionCode ? `Code: ${sessionCode}` : null,
    "",
    "Mera review:",
  ]
    .filter(Boolean)
    .join("\n");

  const digits = (phone ?? "").replace(/\D/g, "");
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;

  return (
    <div
      className={`rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center ${className}`}
    >
      <p className="text-sm font-bold text-emerald-200">
        Reviews upline ko WhatsApp par share karein
      </p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-emerald-100/80">
        Session review yahan submit karein aur uski copy apne upline ko WhatsApp par bhi bhej dein.
      </p>
      <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-block">
        <Button type="button" variant="outline" size="sm" className="rounded-full">
          <MessageCircle className="h-3.5 w-3.5" />
          Share review on WhatsApp
        </Button>
      </a>
    </div>
  );
}
