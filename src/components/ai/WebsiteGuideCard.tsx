import { useServerFn } from "@tanstack/react-start";
import { Compass, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useGuideProgress } from "@/components/ai/WebsiteGuideOverlay";
import { Button } from "@/components/ui/button";
import { GUIDE_STEPS, writeGuide, type GuideLevel, type GuideRole } from "@/lib/ai-guide";
import { getSessionRole } from "@/lib/member.functions";

/** Website Guide entry inside Skyline Achievers AI. */
export function WebsiteGuideCard() {
  const guide = useGuideProgress();
  const loadRole = useServerFn(getSessionRole);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<GuideLevel | null>(null);
  const chosen: GuideLevel = level ?? guide?.level ?? "standard";
  const total = GUIDE_STEPS.length;
  const canResume = guide && (guide.active || guide.stepIndex > 0) && guide.completed.length < total;

  async function start(fresh: boolean) {
    setBusy(true);
    try {
      const { role } = await loadRole();
      const r: GuideRole = role === "member" || role === "trainee" ? role : "none";
      writeGuide(fresh || !guide
        ? { active: true, paused: false, stepIndex: 0, completed: [], role: r, updatedAt: "", level: level ?? (r === "trainee" ? "beginner" : "standard"), checks: {}, questions: [], struggled: [], skipped: [] }
        : { ...guide, active: true, paused: false, role: r, level: chosen, resumed: true });
    } catch {
      toast.error("Guide shuru nahi ho saka. Dobara try karein.");
    } finally { setBusy(false); }
  }

  return (
    <div className="glass-panel-strong metal-edge mb-5 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Compass className="mt-0.5 h-6 w-6 shrink-0 text-cyan" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold">Website Guide</h2>
          <p className="text-sm text-muted-foreground">Skyline AI aap ko website ka har hissa step-by-step dikhayega aur samjhayega — {total} steps.</p>
          {canResume ? <p className="mt-1 text-xs font-semibold text-cyan">Step {guide.stepIndex + 1} of {total} par ruke the</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Explanation level">
        {(["beginner", "standard", "advanced"] as GuideLevel[]).map((l) => (
          <button key={l} type="button" role="radio" aria-checked={chosen === l} onClick={() => setLevel(l)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${chosen === l ? "border-cyan/50 bg-primary/20 text-foreground" : "border-hairline text-muted-foreground"}`}>
            {l === "beginner" ? "Bilkul naya" : l === "standard" ? "Thora jaanta hoon" : "Experienced FBO"}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Bolkar ya likh kar baat karein — AI awaaz mein samjhayega aur aap ki baat sunega.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {canResume ? (
          <>
            <Button variant="brand" disabled={busy} onClick={() => void start(false)}><Play /> Resume Tour</Button>
            <Button variant="outline" disabled={busy} onClick={() => void start(true)}><RotateCcw /> Start again</Button>
          </>
        ) : (
          <Button variant="brand" disabled={busy} onClick={() => void start(true)}><Play /> Start Website Tour</Button>
        )}
      </div>
    </div>
  );
}
