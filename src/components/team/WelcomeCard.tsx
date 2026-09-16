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
  uplineAvatarUrl: string | null;
};

const welcomeMessage = [
  "Today marks the beginning of a new journey filled with learning,",
  "growth, confidence, and meaningful opportunities. Skyline Achievers",
  "is proud to welcome you into a community built on vision, discipline,",
  "teamwork, and consistent action. Your training seat is now reserved,",
  "and your personal Skyline ID is ready. Learn every lesson with focus,",
  "practice what you discover, and keep moving forward one step at a time.",
  "Success is not created in a single day; it is built through the small",
  "decisions you make every day. Stay connected with your upline, ask",
  "questions whenever you need guidance, and complete your training with",
  "full commitment. We believe this can be the start of a powerful chapter",
  "in your life. Congratulations once again, and welcome to the Skyline",
  "Achievers family. Your journey starts now — make it extraordinary.",
];

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
    canvas.height = 1700;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Poster could not be created");

    const [uplineAvatar, logo] = await Promise.all([
      credentials.uplineAvatarUrl
        ? loadImage(credentials.uplineAvatarUrl).catch(() => null)
        : Promise.resolve(null),
      loadImage(BRAND.logoUrl).catch(() => null),
    ]);

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
      ctx.lineTo(i + 700, 1700);
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

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 70px system-ui, sans-serif";
    ctx.fillText("CONGRATULATIONS!", center, 290);
    ctx.fillStyle = "#52d8ff";
    ctx.font = "italic 600 48px Georgia, serif";
    ctx.fillText(`Welcome, ${credentials.fullName}`, center, 355, 920);

    ctx.fillStyle = "rgba(5,17,40,0.82)";
    ctx.strokeStyle = "rgba(143,220,255,0.78)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(75, 445, 930, 670, 42);
    ctx.fill();
    ctx.stroke();

    if (uplineAvatar) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(238, 445, 108, 0, Math.PI * 2);
      ctx.clip();
      coverImage(ctx, uplineAvatar, 130, 337, 216, 216);
      ctx.restore();
      ctx.strokeStyle = "#7bdcff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(238, 445, 110, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 29px system-ui, sans-serif";
    ctx.fillText(credentials.uplineName.toUpperCase(), 238, uplineAvatar ? 590 : 500, 290);

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 42px system-ui, sans-serif";
    ctx.fillText("WELCOME TO THE SKYLINE FAMILY", 410, 510, 540);
    ctx.fillStyle = "#c4d3e8";
    ctx.font = "400 21px system-ui, sans-serif";
    welcomeMessage.forEach((line, index) => ctx.fillText(line, 410, 565 + index * 37, 530));

    const field = (label: string, value: string, top: number) => {
      ctx.fillStyle = "rgba(43,132,255,0.16)";
      ctx.strokeStyle = "rgba(108,207,255,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(130, top, 820, 112, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#9ab3cf";
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.fillText(label, center, top + 38);
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 39px system-ui, sans-serif";
      ctx.fillText(value, center, top + 86, 730);
    };

    field("SKYLINE ID", credentials.traineeCode, 1145);
    field("PASSWORD", credentials.password, 1275);

    ctx.fillStyle = "#a9bdd4";
    ctx.font = "500 23px system-ui, sans-serif";
    ctx.fillText(
      `Registered by ${credentials.uplineName} · ${credentials.uplineCode}`,
      center,
      1475,
      900,
    );
    ctx.fillStyle = "#52d8ff";
    ctx.font = "700 27px system-ui, sans-serif";
    ctx.fillText(BRAND.tagline.toUpperCase(), center, 1530);
    ctx.strokeStyle = "rgba(139,218,255,0.65)";
    ctx.beginPath();
    ctx.moveTo(260, 1572);
    ctx.lineTo(820, 1572);
    ctx.stroke();
    ctx.fillStyle = "#8399b4";
    ctx.font = "500 18px system-ui, sans-serif";
    ctx.fillText("SKYLINE ACHIEVERS • BEGINNERS TRAINING", center, 1615);

    return canvas;
  }

  async function saveImage() {
    try {
      const canvas = await drawCard();
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
      const canvas = await drawCard();
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

        <div className="mt-6 grid w-full gap-5 rounded-2xl border border-cyan/30 bg-primary/10 p-5 text-left sm:grid-cols-[9rem_1fr]">
          <div className="text-center">
            {credentials.uplineAvatarUrl ? (
              <img
                src={credentials.uplineAvatarUrl}
                alt={`${credentials.uplineName}'s profile`}
                className="mx-auto aspect-square w-28 rounded-full border-2 border-cyan object-cover object-top shadow-brand"
              />
            ) : null}
            <p className={`${credentials.uplineAvatarUrl ? "mt-3" : "mt-0"} font-display text-base font-bold`}>
              {credentials.uplineName}
            </p>
          </div>
          <div>
            <h3 className="font-display text-xl font-bold">Welcome to the Skyline family</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Today begins a new journey of learning, growth, confidence and opportunity. Your
              training seat is reserved and your Skyline ID is ready. Learn each lesson with focus,
              practise consistently, stay connected with your upline and keep moving forward one
              step at a time. Success is built through daily action, patience and discipline. Ask
              questions whenever you need guidance and complete your training with full commitment.
              We believe this can be the start of a powerful new chapter in your life.
              Congratulations once again — your Skyline Achievers journey starts now.
            </p>
          </div>
        </div>

        <div className="mt-4 grid w-full gap-3 sm:grid-cols-2">
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
