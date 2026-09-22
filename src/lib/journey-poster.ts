import { BRAND } from "./brand";
import { formatDateTime12, formatTime12 } from "./format";

export type PosterSession = {
  sessionNumber: number;
  dayNumber: number;
  title: string;
  thumbnailUrl: string | null;
  scheduledAt: string | null;
};

async function loadBitmap(url: string | null): Promise<ImageBitmap | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    return await createImageBitmap(await response.blob());
  } catch {
    return null;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * Draws the branded training schedule poster: the trainee's picture and name at
 * the top, then every scheduled session with its cover, date and time.
 */
export async function createSchedulePoster(input: {
  traineeName: string;
  traineeCode: string;
  avatarUrl: string | null;
  uplineName: string;
  sessions: PosterSession[];
}): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Poster is not available on this device.");

  await document.fonts.ready;
  const [logo, avatar] = await Promise.all([loadBitmap(BRAND.logoUrl), loadBitmap(input.avatarUrl)]);
  const thumbs = await Promise.all(input.sessions.map((item) => loadBitmap(item.thumbnailUrl)));

  const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#04070f");
  background.addColorStop(0.55, "#071227");
  background.addColorStop(1, "#02040a");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (logo) {
    ctx.drawImage(logo, (canvas.width - 150) / 2, 48, 150, 150);
    logo.close();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 52px Outfit, sans-serif";
  ctx.fillText("SKYLINE ACHIEVERS", 540, 258);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "800 26px Manrope, sans-serif";
  ctx.fillText(BRAND.tagline.toUpperCase(), 540, 302);
  ctx.fillStyle = "#e2e8f5";
  ctx.font = "800 34px Outfit, sans-serif";
  ctx.fillText("YOUR TRAINING SCHEDULE", 540, 368);

  // trainee identity block
  ctx.save();
  roundRect(ctx, 80, 402, 920, 150, 28);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  if (avatar) {
    ctx.save();
    roundRect(ctx, 108, 430, 94, 94, 22);
    ctx.clip();
    ctx.drawImage(avatar, 108, 430, 94, 94);
    ctx.restore();
    avatar.close();
  } else {
    ctx.save();
    roundRect(ctx, 108, 430, 94, 94, 22);
    ctx.fillStyle = "rgba(56,189,248,0.2)";
    ctx.fill();
    ctx.restore();
  }

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 38px Outfit, sans-serif";
  ctx.fillText(input.traineeName.slice(0, 26), 226, 468);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 24px Manrope, sans-serif";
  ctx.fillText(input.traineeCode, 226, 504);
  ctx.fillText(`Trainer: ${input.uplineName.slice(0, 24)}`, 226, 536);

  // session rows
  let y = 596;
  input.sessions.forEach((session, index) => {
    const height = 158;
    ctx.save();
    roundRect(ctx, 80, y, 920, height, 26);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(56,189,248,0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const thumb = thumbs[index];
    ctx.save();
    roundRect(ctx, 104, y + 22, 190, 114, 18);
    ctx.clip();
    if (thumb) {
      ctx.drawImage(thumb, 104, y + 22, 190, 114);
    } else {
      ctx.fillStyle = "rgba(37,99,235,0.25)";
      ctx.fillRect(104, y + 22, 190, 114);
    }
    ctx.restore();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "800 22px Manrope, sans-serif";
    ctx.fillText(
      `DAY ${String(session.dayNumber).padStart(2, "0")} · SESSION ${String(session.sessionNumber).padStart(2, "0")}`,
      320,
      y + 56,
    );
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 30px Outfit, sans-serif";
    ctx.fillText(session.title.slice(0, 30), 320, y + 98);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "700 24px Manrope, sans-serif";
    ctx.fillText(
      session.scheduledAt ? formatDateTime(session.scheduledAt) : "Timing to be confirmed",
      320,
      y + 132,
    );

    thumb?.close();
    y += height + 14;
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 22px Manrope, sans-serif";
  ctx.fillText("Be on time. Every session opens at its scheduled time.", 540, 1868);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the poster."))),
      "image/png",
      0.96,
    );
  });
}
