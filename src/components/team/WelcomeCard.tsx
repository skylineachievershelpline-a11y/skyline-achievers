import { Copy, Download, PartyPopper, Share2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
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
  uplineAvatarUrl: string | null;
};

/**
 * The welcome card shown right after an ID is created. It can be copied,
 * saved as a picture, or shared straight to WhatsApp.
 */
export function WelcomeCard({ credentials }: { credentials: Credentials }) {
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterFailed, setPosterFailed] = useState(false);
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

  function loadImage(source: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image could not load"));
      image.src = source;
    });
  }

  function coverImage(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2;
    const sourceY = Math.max(0, (image.naturalHeight - sourceHeight) * 0.22);
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }

  /** Paints the premium welcome poster onto a picture the upline can save or send. */
  async function drawCard(): Promise<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Poster could not be created");

    const logo = await loadImage(BRAND.logoUrl).catch(() => null);

    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, "#06152f");
    bg.addColorStop(0.52, "#0b2f69");
    bg.addColorStop(1, "#071a3b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(850, 250, 30, 850, 250, 560);
    glow.addColorStop(0, "rgba(25,177,255,0.45)");
    glow.addColorStop(1, "rgba(25,177,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 900);

    ctx.strokeStyle = "rgba(119,213,255,0.12)";
    ctx.lineWidth = 2;
    for (let i = -300; i < 1400; i += 72) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 560, 1350);
      ctx.stroke();
    }

    const center = canvas.width / 2;
    ctx.textAlign = "center";

    if (logo) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, 105, 58, 0, Math.PI * 2);
      ctx.clip();
      coverImage(ctx, logo, center - 58, 47, 116, 116);
      ctx.restore();
    }
    ctx.fillStyle = "#dcecff";
    ctx.font = "700 25px system-ui, sans-serif";
    ctx.fillText(BRAND.name.toUpperCase(), center, 195);

    ctx.fillStyle = "rgba(5,17,40,0.78)";
    ctx.strokeStyle = "rgba(143,220,255,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(225, 245, 630, 66, 33);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#52d8ff";
    ctx.font = "700 23px system-ui, sans-serif";
    ctx.fillText("CONGRATULATIONS", center, 287);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 62px system-ui, sans-serif";
    ctx.fillText(`Welcome, ${credentials.fullName}!`, center, 405, 930);
    ctx.fillStyle = "#c4d3e8";
    ctx.font = "400 27px system-ui, sans-serif";
    ctx.fillText("Your seat in Skyline Achievers Beginners Training is reserved.", center, 475, 920);
    ctx.fillText("Save these details — they are your keys to the training dashboard.", center, 520, 920);

    const field = (label: string, value: string, top: number) => {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(43,132,255,0.16)";
      ctx.strokeStyle = "rgba(108,207,255,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(130, top, 820, 104, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#9ab3cf";
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.fillText(label, center, top + 34);
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 34px system-ui, sans-serif";
      ctx.fillText(value, center, top + 78, 730);
    };

    field("SKYLINE ID", credentials.traineeCode, 635);
    field("PASSWORD", credentials.password, 760);

    ctx.textAlign = "center";
    ctx.fillStyle = "#a9bdd4";
    ctx.font = "500 23px system-ui, sans-serif";
    ctx.fillText(
      `Registered by ${credentials.uplineName} · ${credentials.uplineCode}`,
      center,
      935,
      900,
    );
    ctx.fillStyle = "#52d8ff";
    ctx.font = "700 27px system-ui, sans-serif";
    ctx.fillText(BRAND.tagline.toUpperCase(), center, 1000);
    ctx.strokeStyle = "rgba(139,218,255,0.65)";
    ctx.beginPath();
    ctx.moveTo(260, 1042);
    ctx.lineTo(820, 1042);
    ctx.stroke();
    ctx.fillStyle = "#8399b4";
    ctx.font = "500 18px system-ui, sans-serif";
    ctx.fillText("SKYLINE ACHIEVERS • BEGINNERS TRAINING", center, 1085);

    return canvas;
  }

  function canvasBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Poster image could not be created"));
      }, "image/png");
    });
  }

  useEffect(() => {
    let cancelled = false;
    setPosterFile(null);
    setPosterFailed(false);
    void drawCard()
      .then(canvasBlob)
      .then((blob) => {
        if (!cancelled) {
          setPosterFile(
            new File([blob], `${credentials.traineeCode}-welcome.png`, { type: "image/png" }),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setPosterFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [credentials.traineeCode]);

  function downloadPoster(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function saveImage() {
    if (!posterFile) {
      toast.error(posterFailed ? "Picture could not be created." : "Picture is preparing — try again in a moment.");
      return;
    }
    downloadPoster(posterFile);
    toast.success("Picture saved to your phone");
  }

  async function share() {
    if (!posterFile) {
      toast.error(posterFailed ? "Picture could not be created." : "Picture is preparing — try again in a moment.");
      return;
    }
    try {
      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
      };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [posterFile] }))) {
        await nav.share({ files: [posterFile] });
        return;
      }
      downloadPoster(posterFile);
      toast.success("Picture saved — attach it from your gallery to share");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      downloadPoster(posterFile);
      toast.success("Picture saved — attach it from your gallery to share");
    }
  }

  return (
    <div className="raised-panel metal-edge relative overflow-hidden rounded-[28px] p-5 text-center animate-rise-in sm:p-8">
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
        <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
          Welcome, {credentials.fullName}!
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Your seat in {BRAND.name} Beginners Training is reserved. Save these details — they are
          your keys to the training dashboard.
        </p>

        <div className="mt-7 grid w-full gap-2 sm:grid-cols-2">
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
          <Button variant="secondary" size="xl" onClick={() => void saveImage()} disabled={!posterFile && !posterFailed}>
            <Download />
            Save picture
          </Button>
          <Button variant="outline" size="xl" onClick={() => void share()} disabled={!posterFile && !posterFailed}>
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
    <div className="rounded-xl border border-hairline bg-glass px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-semibold sm:text-lg">{value}</p>
    </div>
  );
}
