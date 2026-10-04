import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { STEPS, useFounderTraining } from "@/lib/trainer-demo";

export function FounderTrainingBar() {
  const training = useFounderTraining();
  if (!training.ready) return null;

  return (
    <div className="sticky top-[65px] z-20 mx-auto mb-4 flex max-w-6xl items-center gap-2 border-b border-cyan/20 bg-background/95 px-4 py-2 shadow-glass backdrop-blur-md">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase text-cyan">Founder Training · Step {training.state.step} of 7</p>
        <p className="truncate text-xs text-muted-foreground">{STEPS[training.state.step - 1]}</p>
      </div>
      <Button type="button" variant="outline" size="icon" disabled={!training.canBack} onClick={training.back} aria-label="Previous training step">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button type="button" variant="outline" size="icon" disabled={!training.canForward} onClick={training.forward} aria-label="Next training step">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button type="button" variant="destructive" size="icon" onClick={training.reset} aria-label="Reset training journey">
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}