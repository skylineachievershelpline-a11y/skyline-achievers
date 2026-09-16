import { Copy, Download, PartyPopper, Share2, Sparkles } from "lucide-react";
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
 * The welcome card shown right after an ID is created. It can be copied,
 * saved as a picture, or shared straight to WhatsApp.
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
      toast.error("Could not copy — please save the picture instead.");
    }
  }

  /** Paints the card onto a picture the upline can save or send. */
  function drawCard(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d")!;

    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, "#070b16");
    bg.addColorStop(1, "#0b1striped".slice(0, 7));
    ctx.fillStyle = "#070b16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    // Glow accent
    const glow = ctx.createRadialGradient(880, 200, 20, 880, 200, 420);
    glow.addColorStop(0, "rgba(37,99,255,0.55)");
    glow.addColorStop(1, "rgba(37,99,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Panel
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.strokeStyle = "rgba(160,176,200,0.35)";
    ctx.lineWidth = 3;
    const x = 70;
    const y = 150;
    const w = canvas.width - 140;
    const h = canvas.height - 300;
    const r = 48;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const center = canvas.width / 2;
    ctx.textAlign = "center";

    ctx.fillStyle = "#4da3ff";
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.fillText(BRAND.name.toUpperCase(), center, y + 110);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 62px system-ui, sans-serif";
    ctx.fillText("Congratulations!", center, y + 210);
    ctx.font = "500 40px system-ui, sans-serif";
    ctx.fillText(credentials.fullName, center, y + 275);

    ctx.fillStyle = "#a9b6cc";
    ctx.font = "400 28px system-ui, sans-serif";
    ctx.fillText("Your training seat is reserved", center, y + 330);

    const field = (label: string, value: string, top: number) => {
      ctx.fillStyle = "rgba(37,99,255,0.14)";
      ctx.strokeStyle = "rgba(77,163,255,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 60, top, w - 120, 140, 28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#a9b6cc";
      ctx.font = "600 24px system-ui, sans-serif";
      ctx.fillText(label, center, top + 52);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 52px system-ui, sans-serif";
      ctx.fillText(value, center, top + 110);
    };

    field("SKYLINE ID", credentials.traineeCode, y + 390);
    field("PASSWORD", credentials.password, y + 560);

    ctx.fillStyle = "#a9b6cc";
    ctx.font = "400 26px system-ui, sans-serif";
    ctx.fillText(
      `Registered by ${credentials.uplineName} · ${credentials.uplineCode}`,
      center,
      y + 780,
    );
    ctx.fillStyle = "#4da3ff";
    ctx.font = "600 26px system-ui, sans-serif";
    ctx.fillText(BRAND.tagline, center, y + 840);

    return canvas;
  }

  async function saveImage() {
    try {
      const canvas = drawCard();
      const link = document.createElement("a");
      link.download = `${credentials.traineeCode}-welcome.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Picture saved");
    } catch {
      toast.error("Could not save the picture — please take a screenshot.");
    }
  }

  async function share() {
    try {
      const canvas = drawCard();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((value) => resolve(value), "image/png"),
      );
      const file = blob ? new File([blob], `${credentials.traineeCode}.png`, { type: "image/png" }) : null;
      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
      };
      if (file && nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: shareText });
        return;
      }
      if (nav.share) {
        await nav.share({ text: shareText });
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
    } catch {
      /* the person closed the share sheet — nothing to report */
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
          Copy the details, save the picture, or send it straight to the new member.
        </p>

        <div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="brand" size="xl" onClick={() => void copy()}>
            <Copy />
            Copy details
          </Button>
          <Button variant="secondary" size="xl" onClick={() => void saveImage()}>
            <Download />
            Save picture
          </Button>
          <Button variant="outline" size="xl" onClick={() => void share()}>
            <Share2 />
            Send
          </Button>
        </div>
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
