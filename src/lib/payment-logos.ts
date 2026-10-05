/** Official wallet and bank marks (cropped from the office's supplied artwork) plus card colours. */
export type CardBrand = { key: string; label: string; logo: string; gradient: string };

const b = (key: string, label: string, gradient: string): CardBrand => ({
  key,
  label,
  logo: `/payment-logos/${key}.png`,
  gradient,
});

export const WALLETS: CardBrand[] = [
  b("easypaisa", "Easypaisa", "linear-gradient(135deg,#04331f 0%,#0e8a4b 48%,#032a19 100%)"),
  b("jazzcash", "JazzCash", "linear-gradient(135deg,#3d0508 0%,#b3121f 50%,#2e0406 100%)"),
];

export const BANKS: CardBrand[] = [
  b("hbl", "HBL Habib Bank", "linear-gradient(135deg,#02332c,#0a7a68,#022a24)"),
  b("meezan", "Meezan Bank", "linear-gradient(135deg,#2a0f3d,#6d2a8f,#1f0a2e)"),
  b("ubl", "UBL", "linear-gradient(135deg,#041a45,#0d4fb3,#03153a)"),
  b("mcb", "MCB Bank", "linear-gradient(135deg,#033318,#0b7a3a,#022812)"),
  b("alfalah", "Bank Alfalah", "linear-gradient(135deg,#3a0606,#b31616,#2a0404)"),
  b("allied", "Allied Bank", "linear-gradient(135deg,#0a1840,#1f3d99,#3a1f05)"),
  b("nbp", "National Bank of Pakistan", "linear-gradient(135deg,#032b1c,#0f6e45,#022216)"),
  b("bop", "The Bank of Punjab", "linear-gradient(135deg,#2a1505,#b3561a,#1f0f03)"),
  b("bopislamic", "BOP Islamic", "linear-gradient(135deg,#2a1505,#a34d14,#1f0f03)"),
  b("faysal", "Faysal Bank", "linear-gradient(135deg,#061a40,#173f99,#04122e)"),
  b("askari", "Askari Bank", "linear-gradient(135deg,#061a40,#1a4fb3,#04122e)"),
  b("scb", "Standard Chartered", "linear-gradient(135deg,#032036,#0a6aa8,#2a5212)"),
  b("js", "JS Bank", "linear-gradient(135deg,#061636,#123a8f,#3a1d05)"),
  b("soneri", "Soneri Bank", "linear-gradient(135deg,#2a2405,#8f7a10,#1f1a03)"),
  b("bankislami", "BankIslami", "linear-gradient(135deg,#06203a,#145a99,#0b2e14)"),
  b("albaraka", "Al Baraka Bank", "linear-gradient(135deg,#2a1205,#a33a14,#1f0d03)"),
  b("dib", "Dubai Islamic Bank", "linear-gradient(135deg,#0a2a14,#1f7a3a,#2a2405)"),
  b("habibmetro", "HabibMetro", "linear-gradient(135deg,#032b18,#0d6e3a,#022212)"),
  b("silk", "Silkbank", "linear-gradient(135deg,#200a36,#5a1f8f,#18072a)"),
  b("summit", "Summit Bank", "linear-gradient(135deg,#3a0610,#a3142f,#1f0306)"),
  b("sindh", "Sindh Bank", "linear-gradient(135deg,#052a16,#106e3a,#032012)"),
  b("khyber", "The Bank of Khyber", "linear-gradient(135deg,#061a40,#1f3d99,#3a1f05)"),
  b("zkb", "Zarai Taraqiati Bank", "linear-gradient(135deg,#052a12,#147a33,#03200d)"),
  b("fwbl", "First Women Bank", "linear-gradient(135deg,#2a0a36,#8f1f7a,#1f072a)"),
  b("khushhali", "Khushhali Microfinance", "linear-gradient(135deg,#052a24,#0f6e5a,#03201b)"),
  b("telenor", "Telenor Microfinance", "linear-gradient(135deg,#04203a,#0a7ab3,#03182e)"),
  b("hblmfb", "HBL Microfinance", "linear-gradient(135deg,#02332c,#0a7a68,#022a24)"),
  b("umfb", "U Microfinance Bank", "linear-gradient(135deg,#061a40,#1a3fa3,#04122e)"),
  b("finca", "FINCA Microfinance", "linear-gradient(135deg,#04203a,#0d6aa3,#0b2e14)"),
  b("pakoman", "Pak Oman Microfinance", "linear-gradient(135deg,#052a16,#0f6e3a,#032012)"),
  b("nrsp", "NRSP Bank", "linear-gradient(135deg,#061a40,#1a4fb3,#04122e)"),
];

const FALLBACK: CardBrand = {
  key: "skyline",
  label: "Bank Transfer",
  logo: "",
  gradient: "linear-gradient(135deg,#050b1f 0%,#123a9e 50%,#04091a 100%)",
};

/** Resolves the card brand from the saved provider + optional bank key. */
export function cardBrandFor(provider: string, bank?: string | null): CardBrand {
  const p = provider.toLowerCase().replace(/\s+/g, "");
  const wallet = WALLETS.find((w) => p.includes(w.key));
  if (wallet) return wallet;
  return BANKS.find((x) => x.key === bank) ?? FALLBACK;
}
