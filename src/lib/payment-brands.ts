/**
 * Recognises the wallet or bank behind a payment account name so the payment
 * card can show that brand's own colours and mark. Nothing is hard-coded per
 * member: whatever the office types in the admin panel is matched here.
 */

export type PaymentBrand = {
  key: string;
  /** Short mark shown inside the round logo badge. */
  mark: string;
  /** Full brand name shown on the card and the selector button. */
  label: string;
  /** Card face gradient in the brand's own colours. */
  gradient: string;
  /** Accent colour used for the chip, number and glow. */
  accent: string;
  /** Text colour that stays readable on the gradient. */
  ink: string;
  kind: "wallet" | "bank";
};

const BRANDS: (PaymentBrand & { match: RegExp })[] = [
  {
    key: "jazzcash",
    match: /jazz\s*cash|jazzcash|mobilink/i,
    mark: "JC",
    label: "JazzCash",
    gradient: "linear-gradient(135deg,#8c0d16 0%,#c8102e 45%,#7a0a12 100%)",
    accent: "#ffcf4d",
    ink: "#fff6f6",
    kind: "wallet",
  },
  {
    key: "easypaisa",
    match: /easy\s*paisa|easypaisa|telenor\s*bank/i,
    mark: "EP",
    label: "Easypaisa",
    gradient: "linear-gradient(135deg,#0b5c36 0%,#17a95c 48%,#065c33 100%)",
    accent: "#d8ff9a",
    ink: "#f2fff6",
    kind: "wallet",
  },
  {
    key: "sadapay",
    match: /sada\s*pay/i,
    mark: "SP",
    label: "SadaPay",
    gradient: "linear-gradient(135deg,#0f2b2a 0%,#00d6b2 55%,#0a2423 100%)",
    accent: "#ffffff",
    ink: "#ecfffb",
    kind: "wallet",
  },
  {
    key: "nayapay",
    match: /naya\s*pay/i,
    mark: "NP",
    label: "NayaPay",
    gradient: "linear-gradient(135deg,#1b1147 0%,#5b3df5 52%,#150d38 100%)",
    accent: "#8dffe4",
    ink: "#f2efff",
    kind: "wallet",
  },
  {
    key: "upaisa",
    match: /u\s*paisa|ufone/i,
    mark: "UP",
    label: "UPaisa",
    gradient: "linear-gradient(135deg,#2b1836 0%,#8a2be2 50%,#241330 100%)",
    accent: "#ffd166",
    ink: "#f7f1ff",
    kind: "wallet",
  },
  {
    key: "nbp",
    match: /\bnbp\b|national\s*bank/i,
    mark: "NBP",
    label: "National Bank of Pakistan",
    gradient: "linear-gradient(135deg,#0a3a24 0%,#137a45 50%,#08301e 100%)",
    accent: "#ffd76a",
    ink: "#f1fff7",
    kind: "bank",
  },
  {
    key: "meezan",
    match: /meezan/i,
    mark: "MB",
    label: "Meezan Bank",
    gradient: "linear-gradient(135deg,#03231f 0%,#0a5f52 50%,#02201c 100%)",
    accent: "#e2c275",
    ink: "#eefffb",
    kind: "bank",
  },
  {
    key: "hbl",
    match: /\bhbl\b|habib\s*bank/i,
    mark: "HBL",
    label: "HBL",
    gradient: "linear-gradient(135deg,#2b0a12 0%,#00953b 50%,#1d060c 100%)",
    accent: "#7ee3a2",
    ink: "#f4fff8",
    kind: "bank",
  },
  {
    key: "ubl",
    match: /\bubl\b|united\s*bank/i,
    mark: "UBL",
    label: "UBL",
    gradient: "linear-gradient(135deg,#0d1b3a 0%,#1b4f9c 50%,#0a1530 100%)",
    accent: "#8fd0ff",
    ink: "#f1f7ff",
    kind: "bank",
  },
  {
    key: "alfalah",
    match: /alfalah|al\s*falah/i,
    mark: "BAF",
    label: "Bank Alfalah",
    gradient: "linear-gradient(135deg,#2a0f14 0%,#b8262f 50%,#1e0a0e 100%)",
    accent: "#ffd08a",
    ink: "#fff4f4",
    kind: "bank",
  },
  {
    key: "mcb",
    match: /\bmcb\b|muslim\s*commercial/i,
    mark: "MCB",
    label: "MCB Bank",
    gradient: "linear-gradient(135deg,#0d2a1f 0%,#0f7b4f 50%,#09201a 100%)",
    accent: "#ffe08a",
    ink: "#f1fff9",
    kind: "bank",
  },
  {
    key: "askari",
    match: /askari/i,
    mark: "AKBL",
    label: "Askari Bank",
    gradient: "linear-gradient(135deg,#101c2e 0%,#2a5e8c 50%,#0c1523 100%)",
    accent: "#a7d8ff",
    ink: "#f2f8ff",
    kind: "bank",
  },
  {
    key: "faysal",
    match: /faysal/i,
    mark: "FBL",
    label: "Faysal Bank",
    gradient: "linear-gradient(135deg,#1d1030 0%,#5a2d82 50%,#160c25 100%)",
    accent: "#ffcf6b",
    ink: "#f8f2ff",
    kind: "bank",
  },
  {
    key: "bop",
    match: /\bbop\b|bank\s*of\s*punjab/i,
    mark: "BOP",
    label: "Bank of Punjab",
    gradient: "linear-gradient(135deg,#0b2333 0%,#12708f 50%,#081a26 100%)",
    accent: "#ffe08a",
    ink: "#eefaff",
    kind: "bank",
  },
  {
    key: "allied",
    match: /allied|\babl\b/i,
    mark: "ABL",
    label: "Allied Bank",
    gradient: "linear-gradient(135deg,#0e2a1c 0%,#1f8a4c 50%,#0a1f15 100%)",
    accent: "#ffd76a",
    ink: "#f0fff6",
    kind: "bank",
  },
];

/** Skyline house style, used when the name does not match a known brand. */
const FALLBACK: PaymentBrand = {
  key: "skyline",
  mark: "SKY",
  label: "Payment account",
  gradient: "linear-gradient(135deg,#05122c 0%,#123f86 48%,#04101f 100%)",
  accent: "#64e6ff",
  ink: "#eef7ff",
  kind: "bank",
};

/** Picks the brand styling for an account name typed by the office. */
export function detectPaymentBrand(name: string): PaymentBrand {
  const clean = (name ?? "").trim();
  for (const brand of BRANDS) {
    if (brand.match.test(clean)) {
      const { match: _m, ...rest } = brand;
      return rest;
    }
  }
  const initials =
    clean
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || FALLBACK.mark;
  return { ...FALLBACK, mark: initials, label: clean || FALLBACK.label };
}

/** Groups a wallet or bank number in readable blocks. */
export function formatAccountNumber(value: string): string {
  const clean = (value ?? "").replace(/\s+/g, "");
  if (!clean) return "";
  if (/^\d{11}$/.test(clean)) return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
  if (/^[\d]+$/.test(clean)) return clean.replace(/(\d{4})(?=\d)/g, "$1 ");
  return clean.replace(/(.{4})(?=.)/g, "$1 ");
}
