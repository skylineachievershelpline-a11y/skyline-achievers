import { Link } from "@tanstack/react-router";

import robotUrl from "@/assets/skyline-ai-robot-clean.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SkylineAiMascotState = "idle" | "flying" | "thinking" | "answer";

function RobotArtwork({ state, className }: { state: SkylineAiMascotState; className?: string }) {
  return (
    <span className={cn("skyline-ai-robot", `is-${state}`, className)} aria-hidden>
      <span className="skyline-ai-robot-glow" />
      <img className="skyline-ai-robot-image" src={robotUrl} alt="" draggable={false} />
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

export function FlyingSkylineAiMascot({ onActivate }: { onActivate?: () => void }) {
  const artwork = (
    <>
      <RobotArtwork state="flying" />
      <span className="skyline-ai-flight-label">Ask Skyline AI</span>
    </>
  );

  return (
    <div className="skyline-ai-flight pointer-events-none absolute inset-0 z-20" aria-label="Skyline Achievers AI shortcut">
      {onActivate ? (
        <Button
          type="button"
          variant="ghost"
          className="skyline-ai-flight-button pointer-events-auto h-auto w-auto border-transparent bg-transparent p-0 shadow-none hover:border-transparent hover:bg-transparent"
          onClick={onActivate}
          aria-label="Ask Skyline Achievers AI"
        >
          {artwork}
        </Button>
      ) : (
        <Button
          asChild
          variant="ghost"
          className="skyline-ai-flight-button pointer-events-auto h-auto w-auto border-transparent bg-transparent p-0 shadow-none hover:border-transparent hover:bg-transparent"
        >
          <Link to="/ai" aria-label="Chat with Skyline Achievers AI">{artwork}</Link>
        </Button>
      )}
    </div>
  );
}