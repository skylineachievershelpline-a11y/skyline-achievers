import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { Download, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cardBrandFor } from "@/lib/payment-logos";

export type AtmMethod = {
  provider: string;
  bank?: string | null | undefined;
  accountTitle: string;
  accountNumber: string;
  note?: string | null | undefined;
  qr?: string | null | undefined;
};

/* Real-card art uses fixed metallic colours on purpose: the card must look identical in light and dark mode and in the downloaded picture. */
const INK = "#f4f7ff";

function Chip() {
  return (
    <div
      className="relative h-9 w-12 overflow-hidden rounded-md"
      style={{ background: "linear-gradient(135deg,#f7e3a1,#c9a14a 45%,#f3d98a 60%,#a8812f)" }}
    >
      <div className="absolute inset-y-0 left-1/3 w-px" style={{ background: "#7a5a1c" }} />
      <div className="absolute inset-y-0 right-1/3 w-px" style={{ background: "#7a5a1c" }} />
      <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: "#7a5a1c" }} />
      <div className="absolute left-1/3 right-1/3 top-1/4 bottom-1/4 rounded-sm border" style={{ borderColor: "#7a5a1c" }} />
    </div>
  );
}

function Wave() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" opacity={0.85}>
      <path d="M8 8a6 6 0 0 1 0 8" /><path d="M12 5a10 10 0 0 1 0 14" /><path d="M16 2.5a14 14 0 0 1 0 19" />
    </svg>
  );
}

function group(n: string) {
  const clean = n.replace(/\s+/g, "");
  return clean.length > 11 ? clean.replace(/(.{4})/g, "$1 ").trim() : clean;
}

export function AtmPaymentCard({ method, ownerName }: { method: AtmMethod; ownerName?: string | null | undefined }) {
  const brand = cardBrandFor(method.provider, method.bank);
  const [flipped, setFlipped] = useState(false);
  const [qr, setQr] = useState<string | null>(method.qr ?? null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (method.qr) return setQr(method.qr);
    const text = `${brand.label}\nAccount Title: ${method.accountTitle}\nAccount Number: ${method.accountNumber}`;
    QRCode.toDataURL(text, { margin: 1, width: 360 }).then(setQr).catch(() => setQr(null));
  }, [method.qr, method.accountTitle, method.accountNumber, brand.label]);

  const copy = (v: string, label: string) => {
    void navigator.clipboard.writeText(v);
    toast.success(`${label} copied`);
  };

  const download = async () => {
    const node = flipped ? backRef.current : frontRef.current;
    if (!node) return;
    try {
      const url = await toPng(node, { pixelRatio: 3, cacheBust: true, style: { transform: "none" } });
      const a = document.createElement("a");
      a.href = url;
      a.download = `skyline-${brand.key}-card${flipped ? "-qr" : ""}.png`;
      a.click();
    } catch {
      toast.error("Could not create the picture. Please try again.");
    }
  };

  const share = () => {
    const msg = `Payment details (${brand.label})\nAccount Title: ${method.accountTitle}\nAccount Number: ${method.accountNumber}${method.note ? `\n${method.note}` : ""}\n— Skyline Achievers`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  const face = "absolute inset-0 overflow-hidden rounded-[18px] [backface-visibility:hidden]";
  const faceStyle = { background: brand.gradient, color: INK, boxShadow: "0 18px 40px -12px rgba(0,0,0,.6)" };
  const sheen = (
    <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(115deg,transparent 30%,rgba(255,255,255,.18) 45%,transparent 60%), radial-gradient(circle at 85% 0%,rgba(255,255,255,.18),transparent 45%)" }} />
  );

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-[400px] [perspective:1200px]">
        <div
          className="relative aspect-[1.586] w-full transition-transform duration-700 [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
        >
          {/* FRONT */}
          <div ref={frontRef} className={face} style={faceStyle}>
            {sheen}
            <div className="relative flex h-full flex-col justify-between p-[6%]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-extrabold tracking-[0.22em]" style={{ background: "linear-gradient(180deg,#ffffff,#b9c3d6)", WebkitBackgroundClip: "text", color: "transparent" }}>
                    SKYLINE ACHIEVERS
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.3em] opacity-70">{brand.label}</p>
                </div>
                {brand.logo ? (
                  <div className="flex h-10 w-[84px] items-center justify-center rounded-lg p-1" style={{ background: "#ffffff" }}>
                    <img src={brand.logo} alt={brand.label} className="max-h-full max-w-full object-contain" crossOrigin="anonymous" />
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Chip />
                <Wave />
                {qr ? (
                  <button type="button" onClick={() => setFlipped(true)} aria-label="Show QR code" className="ml-auto rounded-md p-1" style={{ background: "#ffffff" }}>
                    <img src={qr} alt="Payment QR" className="h-12 w-12" />
                  </button>
                ) : null}
              </div>
              <button type="button" onClick={() => copy(method.accountNumber, "Account number")} className="text-left font-mono text-[clamp(15px,5vw,21px)] font-semibold tracking-[0.12em]" style={{ textShadow: "0 1px 0 rgba(255,255,255,.35), 0 -1px 0 rgba(0,0,0,.6)" }}>
                {group(method.accountNumber)}
              </button>
              <div className="flex items-end justify-between gap-2">
                <button type="button" onClick={() => copy(method.accountTitle, "Account title")} className="min-w-0 text-left">
                  <p className="text-[8px] uppercase tracking-[0.25em] opacity-70">Account Title</p>
                  <p className="truncate font-mono text-sm font-semibold uppercase tracking-wider" style={{ textShadow: "0 -1px 0 rgba(0,0,0,.6)" }}>{method.accountTitle}</p>
                </button>
                {ownerName ? <p className="shrink-0 text-[8px] uppercase tracking-[0.2em] opacity-70">FBO · {ownerName}</p> : null}
              </div>
            </div>
          </div>

          {/* BACK */}
          <div ref={backRef} className={face} style={{ ...faceStyle, transform: "rotateY(180deg)" }}>
            {sheen}
            <div className="relative mt-[7%] h-[16%] w-full" style={{ background: "#0a0a0a" }} />
            <div className="relative flex h-[70%] items-center gap-3 px-[6%] pt-2">
              <div className="flex-1 space-y-2">
                <div className="h-7 rounded-sm px-2 text-[9px] italic leading-7" style={{ background: "repeating-linear-gradient(45deg,#f1f1f1,#f1f1f1 4px,#e3e3e3 4px,#e3e3e3 8px)", color: "#333" }}>
                  Authorized Signature
                </div>
                <p className="text-[9px] uppercase tracking-[0.2em] opacity-80">Scan to pay · {brand.label}</p>
                <p className="text-[11px] font-extrabold tracking-[0.2em]">SKYLINE ACHIEVERS</p>
              </div>
              {qr ? (
                <div className="rounded-lg p-1.5" style={{ background: "#ffffff" }}>
                  <img src={qr} alt="Payment QR" className="h-[clamp(90px,28vw,130px)] w-[clamp(90px,28vw,130px)]" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[400px] flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setFlipped((v) => !v)}><RefreshCw className="mr-1 h-4 w-4" /> {flipped ? "Front" : "Scan QR"}</Button>
        <Button size="sm" variant="outline" onClick={download}><Download className="mr-1 h-4 w-4" /> Download Card</Button>
        <Button size="sm" variant="outline" onClick={share}><Share2 className="mr-1 h-4 w-4" /> WhatsApp</Button>
      </div>
      {method.note ? <p className="mx-auto max-w-[400px] whitespace-pre-line text-center text-xs text-muted-foreground">{method.note}</p> : null}
    </div>
  );
}
