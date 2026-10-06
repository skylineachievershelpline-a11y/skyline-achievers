import { Check, Copy, CreditCard, QrCode, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import cardSlideSound from "@/assets/card-slide.mp3.asset.json";
import { detectPaymentBrand, formatAccountNumber } from "@/lib/payment-brands";
import type { PaymentMethod } from "@/lib/journey";

/** Plays the leather card-slide sound once per card pull. */
function useCardSound() {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio(cardSlideSound.url);
    audio.preload = "auto";
    audio.volume = 0.75;
    ref.current = audio;
    return () => {
      audio.pause();
      ref.current = null;
    };
  }, []);
  return () => {
    const audio = ref.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };
}

function BrandBadge({
  mark,
  accent,
  ink,
  size = "md",
}: {
  mark: string;
  accent: string;
  ink: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-7 w-7 text-[9px]" : "h-11 w-11 text-[11px]";
  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold tracking-tight`}
      style={{
        background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.45), rgba(255,255,255,0.05) 60%), ${accent}`,
        color: "#08122a",
        boxShadow: `0 6px 14px -6px ${accent}, inset 0 1px 0 rgba(255,255,255,0.6)`,
        border: `1px solid ${ink}33`,
      }}
    >
      {mark}
    </span>
  );
}

/**
 * The premium leather wallet: every payment account the office has added sits
 * inside it as its own branded card. Tapping a brand button slides that card
 * out with the wallet sound, showing the account title, number, copy button
 * and QR code.
 */
export function PaymentMethodWallet({
  methods,
  selectedName,
  onSelect,
}: {
  methods: PaymentMethod[];
  selectedName: string;
  onSelect: (name: string) => void;
}) {
  const play = useCardSound();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [madeQr, setMadeQr] = useState<string>("");

  const cards = useMemo(
    () => methods.map((entry) => ({ ...entry, brand: detectPaymentBrand(entry.name) })),
    [methods],
  );
  const active = cards.find((card) => card.name === selectedName) ?? null;

  // A QR code is drawn from the account number when the office has not uploaded one.
  useEffect(() => {
    setShowQr(false);
    setCopied(false);
    setMadeQr("");
    if (!active || active.qrUrl || !active.accountNumber) return;
    let alive = true;
    const qrText = `${active.name} | ${active.accountTitle} | ${active.accountNumber}`;
    void import("qrcode").then((m) => (m.default ?? m).toDataURL(qrText, {
      width: 480,
      margin: 1,
      color: { dark: "#04101f", light: "#ffffff" },
    }))
      .then((url) => {
        if (alive) setMadeQr(url);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [active?.name, active?.qrUrl, active?.accountNumber, active?.accountTitle]);

  if (cards.length === 0) return null;
  const qrSrc = active?.qrUrl || madeQr;

  return (
    <div className="space-y-3">
      {/* ---------- leather wallet with the cards inside ---------- */}
      <div
        className="relative overflow-hidden rounded-[26px] p-4 pb-5"
        style={{
          background:
            "linear-gradient(160deg,#101a38 0%,#081228 42%,#040a18 100%)",

          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -16px 30px -18px rgba(0,0,0,0.9), 0 26px 44px -26px rgba(0,0,0,0.85)",
          border: "1px solid rgba(120,170,255,0.18)",
        }}
      >
        {/* stitched border */}
        <span className="pointer-events-none absolute inset-[7px] rounded-[20px] border border-dashed border-cyan/25" />

        <div className="relative flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-brand-glow">
            <Wallet className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Skyline Payment Wallet
            </p>
            <p className="text-[11px] text-muted-foreground">
              Tap an account to pull its card out.
            </p>
          </div>
        </div>

        {/* ---------- brand buttons, one per account ---------- */}
        <div className="relative mt-4 flex flex-wrap gap-2">
          {cards.map((card) => {
            const on = card.name === selectedName;
            return (
              <button
                key={card.name}
                type="button"
                onClick={() => {
                  onSelect(card.name);
                  play();
                }}
                className="flex items-center gap-2 rounded-2xl px-3 py-2 text-left transition-transform duration-200 active:scale-95"
                style={{
                  background: on ? card.brand.gradient : "rgba(255,255,255,0.05)",
                  border: `1px solid ${on ? card.brand.accent : "rgba(255,255,255,0.12)"}`,
                  boxShadow: on ? `0 12px 24px -16px ${card.brand.accent}` : "none",
                }}
              >
                <BrandBadge
                  mark={card.brand.mark}
                  accent={card.brand.accent}
                  ink={card.brand.ink}
                  size="sm"
                />
                <span
                  className="text-xs font-semibold"
                  style={{ color: on ? card.brand.ink : undefined }}
                >
                  {card.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* ---------- the pulled-out card ---------- */}
        <div className="relative mt-4 min-h-[188px]">
          {active ? (
            <div
              key={active.name}
              className="animate-card-slide relative overflow-hidden rounded-3xl p-4"
              style={{
                background: active.brand.gradient,
                boxShadow: `0 24px 40px -22px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.35)`,
                border: `1px solid ${active.brand.accent}55`,
                color: active.brand.ink,
              }}
            >
              <span
                className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full opacity-25"
                style={{ background: `radial-gradient(circle, ${active.brand.accent}, transparent 70%)` }}
              />
              {showQr && qrSrc ? (
                <div className="relative flex flex-col items-center justify-center gap-2 py-2">
                  <img
                    src={qrSrc}
                    alt={`${active.name} QR code`}
                    className="h-40 w-40 rounded-2xl bg-white p-2 object-contain"
                  />
                  <p className="text-[11px] opacity-80">Scan this QR in your {active.name} app</p>
                  <button
                    type="button"
                    onClick={() => setShowQr(false)}
                    className="rounded-full border px-3 py-1 text-[11px] font-semibold"
                    style={{ borderColor: `${active.brand.accent}88` }}
                  >
                    Back to card
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BrandBadge
                        mark={active.brand.mark}
                        accent={active.brand.accent}
                        ink={active.brand.ink}
                      />
                      <div>
                        <p className="font-display text-sm font-semibold leading-tight">
                          {active.name}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">
                          {active.brand.kind === "wallet" ? "Mobile wallet" : "Bank account"}
                        </p>
                      </div>
                    </div>
                    <CreditCard className="h-5 w-5 opacity-60" />
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    {/* chip */}
                    <span
                      className="h-7 w-10 rounded-md"
                      style={{
                        background: `linear-gradient(135deg,#f6e4a8,${active.brand.accent})`,
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
                      }}
                    />
                    <span className="flex gap-[3px]">
                      {[10, 14, 18].map((h) => (
                        <span
                          key={h}
                          className="w-[3px] rounded-full opacity-70"
                          style={{ height: h, background: active.brand.accent }}
                        />
                      ))}
                    </span>
                  </div>

                  <p className="mt-3 font-mono text-lg font-semibold tracking-[0.12em] tabular-nums">
                    {formatAccountNumber(active.accountNumber) || "—"}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] opacity-70">
                    Account title
                  </p>
                  <p className="text-sm font-semibold">{active.accountTitle || "—"}</p>

                  {active.instructions ? (
                    <p className="mt-2 whitespace-pre-wrap text-[11px] opacity-80">
                      {active.instructions}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!active.accountNumber}
                      onClick={() => {
                        void navigator.clipboard
                          ?.writeText(active.accountNumber)
                          .then(() => undefined)
                          .catch(() => undefined);
                        setCopied(true);
                        toast.success("Account number copied");
                        window.setTimeout(() => setCopied(false), 1800);
                      }}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                      style={{
                        background: "rgba(255,255,255,0.16)",
                        border: `1px solid ${active.brand.accent}88`,
                      }}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? "Copied" : "Copy number"}
                    </button>
                    {qrSrc ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowQr(true);
                          play();
                        }}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
                        style={{
                          background: "rgba(255,255,255,0.16)",
                          border: `1px solid ${active.brand.accent}88`,
                        }}
                      >
                        <QrCode className="h-3.5 w-3.5" /> Show QR code
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-[188px] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-cyan/25 bg-white/5">
              {/* stacked cards peeking out of the wallet */}
              <div className="relative h-20 w-56">
                {cards.slice(0, 3).map((card, index) => (
                  <span
                    key={card.name}
                    className="absolute left-0 right-0 h-16 rounded-2xl"
                    style={{
                      top: index * 12,
                      transform: `scale(${1 - index * 0.05})`,
                      background: card.brand.gradient,
                      border: `1px solid ${card.brand.accent}55`,
                      boxShadow: "0 12px 22px -14px rgba(0,0,0,0.9)",
                      zIndex: 3 - index,
                    }}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Select an account above to see full details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
