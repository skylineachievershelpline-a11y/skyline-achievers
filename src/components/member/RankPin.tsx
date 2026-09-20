import assistantSupervisorAsset from "@/assets/rank-pins-new/assistant-supervisor.png.asset.json";
import supervisorAsset from "@/assets/rank-pins-new/supervisor.png.asset.json";
import assistantManagerAsset from "@/assets/rank-pins-new/assistant-manager.png.asset.json";
import managerAsset from "@/assets/rank-pins-new/manager.png.asset.json";
import seniorManagerAsset from "@/assets/rank-pins-new/senior-manager.png.asset.json";
import soaringManagerAsset from "@/assets/rank-pins-new/soaring-manager.png.asset.json";
import sapphireManagerAsset from "@/assets/rank-pins-new/sapphire-manager.png.asset.json";
import diamondSapphireManagerAsset from "@/assets/rank-pins-new/diamond-sapphire-manager.png.asset.json";
import diamondManagerAsset from "@/assets/rank-pins-new/diamond-manager.png.asset.json";
import doubleDiamondManagerAsset from "@/assets/rank-pins-new/double-diamond-manager.png.asset.json";
import tripleDiamondManagerAsset from "@/assets/rank-pins-new/triple-diamond-manager.png.asset.json";
import centurionManagerAsset from "@/assets/rank-pins-new/centurion-manager.png.asset.json";
import { cn } from "@/lib/utils";

const PINS: Record<string, string> = {
  "assistant-supervisor": assistantSupervisorAsset.url,
  supervisor: supervisorAsset.url,
  "assistant-manager": assistantManagerAsset.url,
  manager: managerAsset.url,
  "senior-manager": seniorManagerAsset.url,
  "soaring-manager": soaringManagerAsset.url,
  "sapphire-manager": sapphireManagerAsset.url,
  "diamond-sapphire-manager": diamondSapphireManagerAsset.url,
  "diamond-manager": diamondManagerAsset.url,
  "double-diamond-manager": doubleDiamondManagerAsset.url,
  "triple-diamond-manager": tripleDiamondManagerAsset.url,
  "centurion-manager": centurionManagerAsset.url,
};

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
      alt={`${rank.replace(/\s+Training$/i, "")} pin`}
      className={cn("h-12 w-12 shrink-0 object-contain drop-shadow-[0_5px_8px_color-mix(in_oklab,var(--cyan)_22%,transparent)]", className)}
    />
  );
}