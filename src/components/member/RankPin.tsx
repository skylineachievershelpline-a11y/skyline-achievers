import assistantSupervisor from "@/assets/rank-pins/assistant-supervisor.png";
import supervisor from "@/assets/rank-pins/supervisor.png";
import assistantManager from "@/assets/rank-pins/assistant-manager.png";
import manager from "@/assets/rank-pins/manager.png";
import seniorManager from "@/assets/rank-pins/senior-manager.png";
import soaringManager from "@/assets/rank-pins/soaring-manager.png";
import sapphireManager from "@/assets/rank-pins/sapphire-manager.png";
import diamondSapphireManager from "@/assets/rank-pins/diamond-sapphire-manager.png";
import diamondManager from "@/assets/rank-pins/diamond-manager.png";
import doubleDiamondManager from "@/assets/rank-pins/double-diamond-manager.png";
import tripleDiamondManager from "@/assets/rank-pins/triple-diamond-manager.png";
import centurionManager from "@/assets/rank-pins/centurion-manager.png";
import { cn } from "@/lib/utils";

const PINS: Record<string, string> = {
  "assistant-supervisor": assistantSupervisor,
  supervisor,
  "assistant-manager": assistantManager,
  manager,
  "senior-manager": seniorManager,
  "soaring-manager": soaringManager,
  "sapphire-manager": sapphireManager,
  "diamond-sapphire-manager": diamondSapphireManager,
  "diamond-manager": diamondManager,
  "double-diamond-manager": doubleDiamondManager,
  "triple-diamond-manager": tripleDiamondManager,
  "centurion-manager": centurionManager,
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
      className={cn("h-8 w-8 shrink-0 object-contain drop-shadow-[0_5px_8px_color-mix(in_oklab,var(--cyan)_22%,transparent)]", className)}
    />
  );
}