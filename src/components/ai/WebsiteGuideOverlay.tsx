import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Lock, MessageCircleQuestion, Pause, Send, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { guideAssist } from "@/lib/ai-guide.functions";
import {
  GUIDE_STEPS, emitGuideEvent, readGuide, stepAllowed, stepContext, subscribeGuide, writeGuide, type GuideProgress, type GuideStep,
} from "@/lib/ai-guide";

let snapshot: string | null = null;
function getSnap() {
  const g = readGuide();
  snapshot = g ? JSON.stringify(g) : null;
  return snapshot;
}

export function useGuideProgress(): GuideProgress | null {
  const raw = useSyncExternalStore(subscribeGuide, getSnap, () => null);
  return raw ? (JSON.parse(raw) as GuideProgress) : null;
}

/** Floating step card shown on every page while the Website Guide runs. */
export function WebsiteGuideOverlay() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const guide = useGuideProgress();
  if (!mounted || !guide?.active || guide.paused) return null;
  return createPortal(<GuideCard guide={guide} />, document.body);
}

function GuideCard({ guide }: { guide: GuideProgress }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const assist = useServerFn(guideAssist);
  const step = (GUIDE_STEPS[guide.stepIndex] ?? GUIDE_STEPS[0]) as GuideStep;
  const allowed = stepAllowed(step, guide.role);
  const [open, setOpen] = useState(true);
  const [phase, setPhase] = useState<"explain" | "question" | "ask">("explain");
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);

  // Reset per step, open the right screen and tell voice listeners.
  useEffect(() => {
    setPhase("explain"); setText(""); setReply(null); setPassed(false); setLocked(false); setOpen(true);
    emitGuideEvent({ type: "step-enter", step });
    if (allowed && step.route && pathname !== step.route) void navigate({ to: step.route });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  // Highlight the real element and detect sections locked for this account.
  useEffect(() => {
    if (!allowed) return;
    let el: Element | null = null;
    const timer = window.setTimeout(() => {
      if (step.route) {
        const nav = document.querySelector(`[data-ai-guide="nav:${step.route}"]`);
        const hasMenu = document.querySelector('[data-ai-guide="menu-button"]');
        if (hasMenu && step.route !== "/dashboard" && step.route !== "/notifications" && step.route !== "/ai"
          && (!nav || nav.getAttribute("data-ai-guide-locked") === "true")) setLocked(true);
      }
      if (!step.target) return;
      el = document.querySelector(`[data-ai-guide="${step.target}"]`);
      if (!el) return;
      el.classList.add("ai-guide-highlight");
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 700);
    return () => { window.clearTimeout(timer); el?.classList.remove("ai-guide-highlight"); };
  }, [step.id, allowed, pathname, step.route, step.target]);

  function save(patch: Partial<GuideProgress>) { writeGuide({ ...guide, ...patch }); }
  function go(delta: number) {
    const next = Math.min(GUIDE_STEPS.length - 1, Math.max(0, guide.stepIndex + delta));
    const completed = delta > 0 && !guide.completed.includes(step.id) ? [...guide.completed, step.id] : guide.completed;
    if (delta > 0 && guide.stepIndex === GUIDE_STEPS.length - 1) {
      save({ active: false, completed });
      toast.success("Website Guide mukammal! Shabash.");
      return;
    }
    save({ stepIndex: next, completed });
  }

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await assist({ data: {
        mode: phase === "question" ? "check" : "ask", stepTitle: step.title, stepContext: stepContext(step),
        question: step.question, text: text.trim(),
      } });
      setReply(res.reply);
      if (phase === "question") {
        setPassed(Boolean(res.correct));
        emitGuideEvent({ type: "answer-result", step, text: res.reply, correct: Boolean(res.correct) });
      }
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Skyline AI jawab nahi de saka.");
    } finally { setBusy(false); }
  }

  const total = GUIDE_STEPS.length;
  const pct = Math.round(((guide.stepIndex + 1) / total) * 100);

  return (
    <div className="fixed inset-x-2 bottom-2 z-[250] mx-auto max-w-md sm:bottom-4" role="dialog" aria-label="Website Guide">
      <div className="glass-panel-strong metal-edge overflow-hidden rounded-2xl text-foreground shadow-glass">
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan">Website Guide · Step {guide.stepIndex + 1} of {total}</p>
            <p className="truncate font-display text-sm font-semibold">{step.title}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label={open ? "Collapse" : "Expand"} onClick={() => setOpen((v) => !v)}>{open ? <ChevronDown /> : <ChevronUp />}</Button>
          <Button variant="ghost" size="icon" aria-label="Pause tour" onClick={() => { save({ paused: true }); toast.info("Tour pause. Skyline AI page se Resume karein."); }}><X /></Button>
        </div>
        <div className="h-1 bg-surface-2"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>

        {open ? (
          <div className="max-h-[48dvh] space-y-2 overflow-y-auto px-3 py-3 text-sm leading-6">
            {!allowed || locked ? (
              <p className="flex items-start gap-2 rounded-lg border border-hairline bg-surface p-2 text-muted-foreground">
                <Lock className="mt-1 h-4 w-4 shrink-0" />
                Ye section abhi aapke account ke liye available nahi. Jab aap ka level ya access is ke liye khulega tab yahan kaam kar sakenge. Sirf samajh lein ke ye kya hai:
              </p>
            ) : null}
            <p className="font-semibold">{step.where}</p>
            <p>{step.what}</p>
            <p className="text-muted-foreground"><span className="font-semibold text-foreground">Kyun? </span>{step.why}</p>
            <div>
              <p className="font-semibold">Aap yahan kya kar sakte hain:</p>
              <ul className="ml-5 list-disc text-muted-foreground">{step.canDo.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
            {step.buttons ? <ul className="ml-5 list-disc text-muted-foreground">{step.buttons.map((b) => <li key={b}>{b}</li>)}</ul> : null}
            {step.avoid ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs">Dhyan rakhein: {step.avoid}</p> : null}

            {phase === "question" ? <p className="rounded-lg border border-cyan/30 bg-primary/10 p-2 font-semibold">{step.question}</p> : null}
            {reply ? <p className="whitespace-pre-wrap rounded-lg border border-hairline bg-surface p-2">{reply}</p> : null}

            {phase !== "explain" && !(phase === "question" && passed) ? (
              <div className="flex items-end gap-2">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1000}
                  placeholder={phase === "question" ? "Apna jawab likhein..." : "Is section ke baare mein apna sawal..."} className="min-h-0 bg-surface" />
                <Button size="icon" variant="brand" aria-label="Send" disabled={busy || !text.trim()} onClick={() => void submit()}><Send /></Button>
              </div>
            ) : null}
            {busy ? <p className="text-xs text-cyan">Skyline AI soch raha hai...</p> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline px-3 py-2">
          <Button size="sm" variant="outline" disabled={guide.stepIndex === 0} onClick={() => go(-1)}><ChevronLeft /> Previous</Button>
          <Button size="sm" variant="outline" onClick={() => { setPhase("ask"); setReply(null); setOpen(true); }}><MessageCircleQuestion /> Ask AI</Button>
          <Button size="sm" variant="ghost" onClick={() => save({ paused: true })}><Pause /> Pause</Button>
          <div className="flex-1" />
          {phase === "explain" && step.question ? (
            <Button size="sm" variant="brand" onClick={() => { setPhase("question"); setReply(null); emitGuideEvent({ type: "question", step, text: step.question }); }}>Samajh gaya</Button>
          ) : (
            <Button size="sm" variant="brand" onClick={() => go(1)}>{guide.stepIndex === total - 1 ? "Finish" : "Next"} <ChevronRight /></Button>
          )}
        </div>
      </div>
    </div>
  );
}
