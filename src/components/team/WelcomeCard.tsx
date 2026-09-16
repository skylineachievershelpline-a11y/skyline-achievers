import { Copy, PartyPopper, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

export type Credentials = {
  traineeCode: string;
  password: string;
  fullName: string;
  uplineName: string;
  uplineCode: string;
};

/**
 * The screenshot-friendly welcome card shown right after an ID is created.
 */
export function WelcomeCard({ credentials }: { credentials: Credentials }) {
  const shareText = [
    `🎉 Congratulations ${credentials.fullName}!`,
    `Welcome to ${BRAND.name} — ${BRAND.tagline}`,
    "",
    `Skyline ID: ${credentials.traineeCode}`,
    `Password: ${credentials.password}`,
    `Registered by: ${credentials.uplineName} (${credentials.uplineCode})`,
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Details copied");
    } catch {
      toast.error("Could not copy — please take a screenshot instead.");
    }
  }

  return (
    <div className="glass-panel-strong relative overflow-hidden rounded-[28px] p-6 text-center animate-rise-in sm:p-8">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand/25 blur-3xl animate-glow"
        aria-hidden
      />
      <div className="relative flex flex-col items-center">
        <BrandLogo size="md" />
        <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-hairline bg-glass px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-brand-glow">
          <PartyPopper className="h-3.5 w-3.5" />
          Congratulations
        </span>
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome, {credentials.fullName}!
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Your seat in {BRAND.name} Beginners Training is reserved. Save these details — they are
          your keys to the training dashboard.
        </p>

        <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
          <Field label="Skyline ID" value={credentials.traineeCode} />
          <Field label="Password" value={credentials.password} />
        </div>

        <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Registered by {credentials.uplineName} · {credentials.uplineCode}
        </p>

        <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-brand-glow" />
          Take a screenshot of this card and share it with the new member.
        </p>

        <Button variant="brand" size="xl" className="mt-5 w-full sm:w-auto" onClick={() => void copy()}>
          <Copy />
          Copy details
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-glass p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
