import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Download, Loader2, Share2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

export type PaymentSlipData = {
  kind?: "course" | "mentorship" | "daily-report";
  title?: string;
  courseTitle?: string;
  buyerName: string;
  buyerId?: string | null;
  rank?: string | null;
  method?: string | null;
  amount: number;
  totalAmount?: number | null;
  remainingAmount?: number | null;
  reference?: string | null;
  phone?: string | null;
  status?: string | null;
  note?: string | null;
  receiptId?: string | null;
  rangeLabel?: string | null;
  reportRows?: Array<{
    date: string;
    leads: number;
    responses: number;
    enrollments: number;
    pending: number;
    twoCc: number;
    mentorshipPaid: number;
  }> | null;
  submittedAt: Date;
};

function money(value: number) {
  return `PKR ${Number(value).toLocaleString("en-PK")}`;
}

function cleanFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "receipt";
}

function slipTitle(data: PaymentSlipData) {
  if (data.kind === "daily-report") return data.title ?? "Daily Working Report";
  return data.title ?? data.courseTitle ?? "Personal Mentorship Amount";
}

function receiptNumber(data: PaymentSlipData) {
  if (data.receiptId) return data.receiptId;
  const prefix = data.kind === "mentorship" ? "PM" : "PAY";
  const time = data.submittedAt.getTime().toString().slice(-8);
  return `${prefix}-${time}`;
}

function details(data: PaymentSlipData): Array<[string, string]> {
  if (data.kind === "daily-report") {
    const rows = data.reportRows ?? [];
    const total = (key: keyof NonNullable<PaymentSlipData["reportRows"]>[number]) =>
      rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
    return [
      ["Member", data.buyerName],
      ["Skyline ID", data.buyerId ?? "—"],
      ["Report Period", data.rangeLabel ?? "—"],
      ["Total Days", String(rows.length)],
      ["Leads", String(total("leads"))],
      ["Response", String(total("responses"))],
      ["Enrollments", String(total("enrollments"))],
      ["Pending", String(total("pending"))],
      ["2CC", String(total("twoCc"))],
      ["PM Fee", String(total("mentorshipPaid"))],
    ];
  }
  if (data.kind === "mentorship") {
    return [
      ["Member", data.buyerName],
      ["Skyline ID", data.buyerId ?? "—"],
      ["Rank", data.rank ?? "—"],
      ["Payment For", slipTitle(data)],
      ["Total Amount", money(Number(data.totalAmount ?? data.amount))],
      ["Amount Received", money(data.amount)],
      ["Remaining", money(Number(data.remainingAmount ?? 0))],
      ["Status", data.status ?? "Under verification"],
    ];
  }
  return [
    ["Course", slipTitle(data)],
    ["Method", data.method ?? "—"],
    ["Transaction ID", data.reference ?? "—"],
    ["Contact", data.phone ?? "—"],
    ["Member", data.buyerName],
    ["Skyline ID", data.buyerId ?? "—"],
    ["Status", data.status ?? "Under verification"],
  ];
}

function slipPrimaryValue(data: PaymentSlipData) {
  if (data.kind === "daily-report") {
    const rows = data.reportRows ?? [];
    const totalLeads = rows.reduce((sum, row) => sum + row.leads, 0);
    return `${rows.length} DAY${rows.length === 1 ? "" : "S"} • ${totalLeads} LEADS`;
  }
  return money(data.amount);
}

function slipStatus(data: PaymentSlipData) {
  if (data.kind === "daily-report") return "DAILY WORKING REPORT";
  if (data.kind === "mentorship") return "PERSONAL MENTORSHIP RECEIPT";
  return "PAYMENT SUBMITTED";
}

function slipFooter(data: PaymentSlipData) {
  return data.kind === "daily-report" ? "REPORT PRINTED BY SKYLINE ACHIEVERS" : "THANK YOU FOR YOUR PAYMENT";
}

function playPrinterSound() {
  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return () => undefined;
  const context = new AudioContextCtor();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const oscillator = context.createOscillator();
  const bufferSize = context.sampleRate * 2.4;
  const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const channel = noiseBuffer.getChannelData(0);

  for (let index = 0; index < channel.length; index += 1) {
    const pulse = index % 900 < 160 ? 0.8 : 0.24;
    channel[index] = (Math.random() * 2 - 1) * pulse;
  }

  const noise = context.createBufferSource();
  noise.buffer = noiseBuffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(760, context.currentTime);
  filter.frequency.linearRampToValueAtTime(1180, context.currentTime + 1.7);
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(92, context.currentTime);
  oscillator.frequency.linearRampToValueAtTime(66, context.currentTime + 2.2);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 1.9);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 2.45);
  noise.connect(filter);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);

  void context.resume().catch(() => undefined);
  noise.start();
  oscillator.start();
  noise.stop(context.currentTime + 2.5);
  oscillator.stop(context.currentTime + 2.5);

  const timer = window.setTimeout(() => void context.close().catch(() => undefined), 2700);
  return () => {
    window.clearTimeout(timer);
    try {
      noise.stop();
    } catch {
      /* already stopped */
    }
    try {
      oscillator.stop();
    } catch {
      /* already stopped */
    }
    void context.close().catch(() => undefined);
  };
}

async function blobFromCanvas(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create receipt image."));
    }, "image/png", 0.96);
  });
}

async function createReceiptImage(data: PaymentSlipData) {
  const root = getComputedStyle(document.documentElement);
  const token = (name: string) => root.getPropertyValue(name).trim();
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1500;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Receipt image is not available on this device.");

  const scene = token("--receipt-scene");
  const paper = token("--receipt-paper");
  const ink = token("--receipt-ink");
  const muted = token("--receipt-muted");
  const line = token("--receipt-line");
  const blue = token("--brand");
  const cyan = token("--cyan");
  const silver = token("--silver");

  ctx.fillStyle = scene;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.shadowColor = token("--receipt-shadow");
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.roundRect(150, 120, 780, 1260, 26);
  ctx.fill();
  ctx.restore();

  const header = ctx.createLinearGradient(150, 120, 930, 320);
  header.addColorStop(0, blue);
  header.addColorStop(0.55, cyan);
  header.addColorStop(1, silver);
  ctx.fillStyle = header;
  ctx.beginPath();
  ctx.roundRect(150, 120, 780, 180, [26, 26, 0, 0]);
  ctx.fill();

  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.arc(250, 210, 55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = blue;
  ctx.font = "800 36px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SA", 250, 224);

  ctx.fillStyle = paper;
  ctx.textAlign = "left";
  ctx.font = "800 40px Outfit, sans-serif";
  ctx.fillText("SKYLINE ACHIEVERS", 330, 202);
  ctx.font = "700 19px Manrope, sans-serif";
  ctx.fillText("LEARN • EARN • LEAD", 333, 238);

  ctx.fillStyle = ink;
  ctx.font = "800 30px Outfit, sans-serif";
  ctx.fillText(slipStatus(data), 210, 380);
  ctx.fillStyle = blue;
  ctx.font = "800 66px Outfit, sans-serif";
  ctx.fillText(slipPrimaryValue(data), 210, 465);

  const stamp = data.submittedAt;
  const date = stamp.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = stamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  ctx.fillStyle = muted;
  ctx.font = "700 22px Manrope, sans-serif";
  ctx.fillText(`${date} • ${time} • ${receiptNumber(data)}`, 210, 512);

  let y = 610;
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(210, y - 34);
  ctx.lineTo(870, y - 34);
  ctx.stroke();

  ctx.font = "700 23px Manrope, sans-serif";
  for (const [label, value] of details(data)) {
    ctx.fillStyle = muted;
    ctx.textAlign = "left";
    ctx.fillText(label.toUpperCase(), 210, y);
    ctx.fillStyle = ink;
    ctx.textAlign = "right";
    ctx.fillText(String(value), 870, y);
    y += 62;
  }

  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.moveTo(210, y - 18);
  ctx.lineTo(870, y - 18);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = muted;
  ctx.font = "600 22px Manrope, sans-serif";
  ctx.fillText(data.note ?? "Keep this receipt for your record.", 540, y + 50);
  ctx.fillStyle = blue;
  ctx.font = "800 24px Outfit, sans-serif";
  ctx.fillText(slipFooter(data), 540, y + 105);

  return blobFromCanvas(canvas);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="slip-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/**
 * Receipt-printer animation shown after a course payment is submitted: the slip
 * slides out of the machine like a shop / ATM receipt, branded for Skyline.
 */
export function PaymentSlip({
  open,
  data,
  onClose,
}: {
  open: boolean;
  data: PaymentSlipData | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return playPrinterSound();
  }, [open, data?.receiptId, data?.submittedAt]);

  if (!mounted || !open || !data) return null;

  const stamp = data.submittedAt;
  const date = stamp.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = stamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const title = slipTitle(data);
  const number = receiptNumber(data);

  async function saveSlip() {
    if (!data) return;
    setBusy("save");
    try {
      const blob = await createReceiptImage(data);
      downloadBlob(blob, `skyline-${cleanFileName(number)}.png`);
      toast.success("Receipt saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save receipt.");
    } finally {
      setBusy(null);
    }
  }

  async function shareSlip() {
    if (!data) return;
    setBusy("share");
    try {
      const blob = await createReceiptImage(data);
      const file = new File([blob], `skyline-${cleanFileName(number)}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${BRAND.name} receipt`, text: `${title} receipt`, files: [file] });
        toast.success("Receipt shared");
      } else {
        downloadBlob(blob, file.name);
        toast.success("Sharing is not available here, so the receipt was saved.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Could not share receipt.");
    } finally {
      setBusy(null);
    }
  }

  return createPortal(
    <div className="slip-overlay" role="dialog" aria-modal="true" aria-label="Payment receipt">
      <Button type="button" variant="ghost" size="icon" className="slip-close" onClick={onClose} aria-label="Close receipt">
        <X className="h-4 w-4" />
      </Button>

      <div className="slip-machine">
        <div className="slip-printer" aria-hidden>
          <span className="slip-printer-cap" />
          <span className="slip-printer-slot" />
          <span className="slip-printer-led" />
        </div>

        <div className="slip-window">
          <div className="slip-paper">
            <div className="slip-paper-inner">
              <div className="slip-brand">
                <img src={BRAND.logoUrl} alt={BRAND.logoAlt} />
                <p className="slip-brand-name">SKYLINE ACHIEVERS</p>
                <p className="slip-brand-tag">LEARN • EARN • LEAD</p>
              </div>

              <p className="slip-status">
                {slipStatus(data)}
              </p>
              <p className="slip-amount">{slipPrimaryValue(data)}</p>
              <p className="slip-datetime">
                {date} • {time} • {number}
              </p>

              <div className="slip-divider" />

              {details(data).map(([label, value]) => (
                <Line key={label} label={label} value={String(value)} />
              ))}

              <div className="slip-divider" />

              <p className="slip-note">
                {data.note ?? "Keep this receipt for your record."}
              </p>
              <p className="slip-footer">{slipFooter(data)}</p>
            </div>
            <div className="slip-zigzag" aria-hidden />
          </div>
        </div>
      </div>

      <div className="slip-actions">
        <Button type="button" variant="outline" className="rounded-xl font-display" onClick={() => void saveSlip()} disabled={busy !== null}>
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Save
        </Button>
        <Button type="button" variant="brand" className="rounded-xl font-display" onClick={() => void shareSlip()} disabled={busy !== null}>
          {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Share
        </Button>
        <Button type="button" variant="secondary" className="rounded-xl font-display" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>,
    document.body,
  );
}
