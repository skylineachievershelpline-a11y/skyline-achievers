import skylineLogoAsset from "@/assets/skyline-logo.png.asset.json";
import pin01Asset from "@/assets/rank-pins-separate/pin-01.png.asset.json";
import pin02Asset from "@/assets/rank-pins-separate/pin-02.png.asset.json";
import pin03Asset from "@/assets/rank-pins-separate/pin-03.png.asset.json";
import pin04Asset from "@/assets/rank-pins-separate/pin-04.png.asset.json";
import pin05Asset from "@/assets/rank-pins-separate/pin-05.png.asset.json";
import pin06Asset from "@/assets/rank-pins-separate/pin-06.png.asset.json";
import pin07Asset from "@/assets/rank-pins-separate/pin-07.png.asset.json";
import pin08Asset from "@/assets/rank-pins-separate/pin-08.png.asset.json";
import pin09Asset from "@/assets/rank-pins-separate/pin-09.png.asset.json";
import { cn } from "@/lib/utils";

const PINS: Record<string, string> = {
  "personal-mentorship": skylineLogoAsset.url,
  "assistant-supervisor": pin01Asset.url,
  supervisor: pin02Asset.url,
  "assistant-manager": pin02Asset.url,
  manager: pin03Asset.url,
  "senior-manager": pin03Asset.url,
  "soaring-manager": pin04Asset.url,
  "sapphire-manager": pin05Asset.url,
  "diamond-sapphire-manager": pin06Asset.url,
  "diamond-manager": pin07Asset.url,
  "double-diamond-manager": pin08Asset.url,
  "triple-diamond-manager": pin09Asset.url,
};

export function formatRankName(value?: string | null) {
  return value?.replace(/\s+Training$/i, "").trim() || "Not assigned";
}

function normalizeRank(value: string) {
  return value
    .toLowerCase()
    .replace(/\btraining\b/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function RankPin({ rank, className }: { rank?: string | null | undefined; className?: string }) {
  if (!rank) return null;
  const source = PINS[normalizeRank(rank)];
  if (!source) return null;

  return (
    <img
      src={source}
      alt={`${formatRankName(rank)} pin`}
      className={cn("h-14 w-14 shrink-0 object-contain drop-shadow-[0_5px_8px_color-mix(in_oklab,var(--cyan)_22%,transparent)]", className)}
    />
  );
}