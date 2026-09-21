import { Link } from "@tanstack/react-router";

import robotAsset from "@/assets/skyline-ai-robot.png.asset.json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SkylineAiMascotState = "idle" | "flying" | "thinking" | "answer";

function RobotArtwork({ state, className }: { state: SkylineAiMascotState; className?: string }) {
  return (
    <span className={cn("skyline-ai-robot", `is-${state}`, className)} aria-hidden>
      <span className="skyline-ai-robot-glow" />
      <img className="skyline-ai-part skyline-ai-torso" src={robotAsset.url} alt="" draggable={false} />
      <img className="skyline-ai-part skyline-ai-head" src={robotAsset.url} alt="" draggable={false} />
      <img className="skyline-ai-part skyline-ai-arm-left" src={robotAsset.url} alt="" draggable={false} />
      <img className="skyline-ai-part skyline-ai-arm-right" src={robotAsset.url} alt="" draggable={false} />
      <img className="skyline-ai-part skyline-ai-leg-left" src={robotAsset.url} alt="" draggable={false} />
      <img className="skyline-ai-part skyline-ai-leg-right" src={robotAsset.url} alt="" draggable={false} />
      {state === "thinking" ? (
        <span className="skyline-ai-thought" aria-hidden><i /><i /><strong>?</strong></span>
      ) : null}
      {state === "answer" ? <span className="skyline-ai-answer" aria-hidden>!</span> : null}
    </span>
  );
}

export function SkylineAiMascot({
  state = "idle",
  className,
  label,
}: {
  state?: SkylineAiMascotState;
  className?: string;
  label?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col items-center", className)}>
      <RobotArtwork state={state} />
      {label ? <span className="mt-1 text-center text-xs font-semibold text-cyan">{label}</span> : null}
    </span>
  );
}

export function FlyingSkylineAiMascot() {
  return (
    <div className="skyline-ai-flight pointer-events-none fixed inset-0 z-20" aria-label="Skyline Achievers AI shortcut">
      <Button
        asChild
        variant="ghost"
        className="skyline-ai-flight-button pointer-events-auto h-auto w-auto border-transparent bg-transparent p-0 shadow-none hover:border-transparent hover:bg-transparent"
      >
        <Link to="/ai" aria-label="Chat with Skyline Achievers AI">
          <RobotArtwork state="flying" />
          <span className="skyline-ai-flight-label">Ask Skyline AI</span>
        </Link>
      </Button>
    </div>
  );
}