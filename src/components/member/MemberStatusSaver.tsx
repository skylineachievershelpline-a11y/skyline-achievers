import { ChevronRight, Download, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

type StatusMember = {
  fullName: string;
  memberId: string;
  avatarUrl: string | null;
  bio: string | null;
  levelName: string;
};

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = source;
  });
}

function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("picture"))), "image/png");
  });
}

function wrapText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = value.split(/\s+/);
  let line = "";
  let currentY = y;
  for (const word of words) {
    const test = `${line}${word} `;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, currentY);
      line = `${word} `;
      currentY += lineHeight;
    } else line = test;
  }
  if (line) ctx.fillText(line.trim(), x, currentY);
  return currentY;
}

export function MemberStatusSaver({ member }: { member: StatusMember }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    setBusy(true);
    void (async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("picture");
      const [logo, avatar] = await Promise.all([
        loadImage(BRAND.logoUrl).catch(() => null),
        member.avatarUrl ? loadImage(member.avatarUrl).catch(() => null) : Promise.resolve(null),
      ]);

      const background = ctx.createLinearGradient(0, 0, 1080, 1920);
      background.addColorStop(0, "#080B10");
      background.addColorStop(0.58, "#101722");
      background.addColorStop(1, "#080B10");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 1080, 1920);
      const glow = ctx.createRadialGradient(860, 220, 20, 860, 220, 720);
      glow.addColorStop(0, "rgba(0,200,255,.32)");
      glow.addColorStop(1, "rgba(0,200,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 1080, 1000);

      if (logo) ctx.drawImage(logo, 76, 72, 94, 94);
      ctx.fillStyle = "#E8EEF7";
      ctx.font = "800 34px Sora, sans-serif";
      ctx.fillText(BRAND.name.toUpperCase(), 190, 112);
      ctx.fillStyle = "#00C8FF";
      ctx.font = "700 17px Manrope, sans-serif";
      ctx.fillText(BRAND.tagline.toUpperCase(), 190, 143);

      const avatarX = 160;
      const avatarY = 400;
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, 100, 0, Math.PI * 2);
      ctx.clip();
      if (avatar) {
        const size = Math.min(avatar.naturalWidth, avatar.naturalHeight);
        ctx.drawImage(avatar, (avatar.naturalWidth - size) / 2, (avatar.naturalHeight - size) / 2, size, size, 60, 300, 200, 200);
      } else {
        ctx.fillStyle = "#232B38";
        ctx.fillRect(60, 300, 200, 200);
      }
      ctx.restore();
      ctx.strokeStyle = "#00C8FF";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, 104, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#E8EEF7";
      ctx.font = "800 52px Sora, sans-serif";
      ctx.fillText(member.fullName, 310, 365, 690);
      ctx.fillStyle = "#00C8FF";
      ctx.font = "700 28px Sora, sans-serif";
      ctx.fillText(member.memberId, 310, 430);
      ctx.fillStyle = "rgba(232,238,247,.55)";
      ctx.font = "700 19px Manrope, sans-serif";
      ctx.fillText(`${member.levelName.toUpperCase()}  •  SKYLINE ACHIEVER`, 310, 470);

      ctx.fillStyle = "rgba(35,43,56,.94)";
      ctx.strokeStyle = "rgba(0,200,255,.24)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(60, 610, 960, 560, 36);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#00C8FF";
      ctx.font = "700 19px Manrope, sans-serif";
      ctx.fillText("MY SKYLINE JOURNEY", 110, 690);
      ctx.fillStyle = "#E8EEF7";
      ctx.font = "700 43px Sora, sans-serif";
      wrapText(ctx, member.bio || "Learning today. Earning with purpose. Leading by example.", 110, 780, 850, 66);

      ctx.fillStyle = "rgba(232,238,247,.45)";
      ctx.font = "600 22px Manrope, sans-serif";
      ctx.fillText("OFFICIAL MEMBER PROFILE", 110, 1095);
      ctx.strokeStyle = "#00C8FF";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(60, 1315);
      ctx.lineTo(1020, 1315);
      ctx.stroke();
      ctx.fillStyle = "#E8EEF7";
      ctx.font = "800 50px Sora, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("BUILD YOUR FUTURE", 540, 1435);
      ctx.fillStyle = "#00C8FF";
      ctx.font = "800 27px Manrope, sans-serif";
      ctx.fillText(BRAND.tagline.toUpperCase(), 540, 1490);
      ctx.fillStyle = "rgba(232,238,247,.45)";
      ctx.font = "500 20px Manrope, sans-serif";
      ctx.fillText("SKYLINE ACHIEVERS • OFFICIAL STATUS", 540, 1770);

      const blob = await toBlob(canvas);
      if (active) setFile(new File([blob], `${member.memberId}-skyline-status.png`, { type: "image/png" }));
    })().catch(() => active && setFile(null)).finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [member.avatarUrl, member.bio, member.fullName, member.levelName, member.memberId]);

  function download(target: File) {
    const url = URL.createObjectURL(target);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = target.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function save() {
    if (!file) {
      toast.error(busy ? "Status picture is preparing…" : "Status picture could not be created.");
      return;
    }
    download(file);
    toast.success("Status picture saved to your gallery");
  }

  async function share() {
    if (!file) {
      toast.error(busy ? "Status picture is preparing…" : "Status picture could not be created.");
      return;
    }
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: `${member.fullName} — ${BRAND.name}` });
      } else {
        download(file);
        toast.success("Picture saved — open it from your gallery to post as status");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Could not share this picture.");
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl bg-cyan p-5 text-background shadow-brand">
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-achiever-display text-base font-extrabold">Status Saver</p>
          <p className="mt-1 text-[11px] font-bold uppercase text-background/60">Your branded profile picture</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0" />
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => void save()} disabled={busy} className="border-background/15 bg-background text-foreground hover:bg-background/90">
          <Download /> Gallery
        </Button>
        <Button variant="secondary" onClick={() => void share()} disabled={busy} className="border-background/15 bg-background text-foreground hover:bg-background/90">
          <Share2 /> Status
        </Button>
      </div>
    </section>
  );
}