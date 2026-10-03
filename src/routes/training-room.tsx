import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Lock, Phone, PlayCircle } from "lucide-react";

import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { useMyTraining } from "@/components/training/TrainingGate";
import { Button } from "@/components/ui/button";
import { openLiveCall } from "@/lib/live-call/store";
import { CHAPTERS, PASS_PERCENT, TRAINING_STAGES } from "@/lib/training/curriculum";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/training-room")({
  head: () => ({
    meta: [
      { title: "Training Room — Skyline AI Teacher" },
      { name: "description", content: "Mandatory FBO training with Skyline AI Teacher: live lessons, whiteboard, practice and tests." },
      { property: "og:title", content: "Training Room — Skyline AI Teacher" },
      { property: "og:description", content: "Learn the Skyline platform step by step with Skyline AI Teacher." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrainingRoomPage,
});

function TrainingRoomPage() {
  const ready = useMemberGuard();
  const { data, isPending } = useMyTraining();

  if (!ready || isPending) {
    return <div className="flex min-h-screen items-center justify-center"><SkylineLoader variant="page" /></div>;
  }

  const row = data?.row;
  const passedCount = CHAPTERS.filter((c) => row?.chapters?.[String(c.n)]?.passed).length;
  const current = CHAPTERS.find((c) => c.n === row?.current_chapter) ?? CHAPTERS[0]!;
  const lesson = current.lessons[row?.current_lesson ?? 0];
  const started = Boolean(row && (row.current_lesson > 0 || row.current_stage !== "INTRO" || row.chapters?.["1"]?.attempts));
  const stageIndex = TRAINING_STAGES.indexOf((row?.current_stage ?? "INTRO") as (typeof TRAINING_STAGES)[number]);

  return (
    <MemberShell title="Training Room" subtitle="Skyline AI Teacher">
      <section className="mx-auto w-full max-w-3xl space-y-5 py-3">
        <div className="raised-panel metal-edge rounded-3xl p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan">Mandatory training</p>
          <h1 className="mt-1 font-display text-2xl font-bold">Live class with Skyline AI</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Teacher khud samjhata hai, screen par dikhata hai, whiteboard par likhta hai, aap se kaam karwata hai aur test leta hai. Har test {PASS_PERCENT}% se pass hota hai.
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-cyan transition-all" style={{ width: `${(passedCount / CHAPTERS.length) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{passedCount} / {CHAPTERS.length} chapters pass</p>

          {data?.locked === false && data.required ? (
            <p className="mt-4 rounded-xl border border-cyan/30 p-3 text-sm">Aap ki zaroori training mukammal hai — dashboard khul chuka hai.</p>
          ) : null}

          <div className="mt-5 rounded-2xl border border-hairline p-4">
            <p className="text-xs text-muted-foreground">Abhi</p>
            <p className="font-display font-bold">Chapter {current.n}: {current.title}</p>
            {lesson ? <p className="text-sm text-muted-foreground">Lesson: {lesson.title}</p> : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TRAINING_STAGES.map((s, i) => (
                <span key={s} className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", i === stageIndex ? "border-cyan bg-cyan/15 text-cyan" : i < stageIndex ? "border-cyan/30 text-cyan/70" : "border-hairline text-muted-foreground")}>
                  {s}
                </span>
              ))}
              {row?.current_stage === "REMEDIATE" ? <span className="rounded-full border border-destructive/50 px-2 py-0.5 text-[10px] font-bold text-destructive">RETEST</span> : null}
            </div>
          </div>

          <Button variant="brand" size="xl" className="mt-5 w-full rounded-2xl" onClick={() => openLiveCall({ training: true })} disabled={!current.ready}>
            {started ? <PlayCircle /> : <Phone />} {started ? "Continue Training" : "Start Training with Skyline AI"}
          </Button>
        </div>

        <div className="space-y-2">
          {CHAPTERS.map((c) => {
            const rec = row?.chapters?.[String(c.n)];
            const open = c.ready && c.n <= (row?.unlocked_chapter ?? 1);
            return (
              <div key={c.n} className={cn("raised-panel flex items-center gap-3 rounded-2xl p-4", !open && "opacity-60")}>
                {rec?.passed ? <CheckCircle2 className="h-5 w-5 text-cyan" /> : open ? <PlayCircle className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Chapter {c.n}: {c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {!c.ready ? "Jald aa raha hai" : rec?.passed ? `Pass — best ${rec.best ?? 0}%` : rec?.attempts ? `${rec.attempts} attempt — best ${rec.best ?? 0}%` : open ? "Khula hai" : "Pichla chapter pass karein"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </MemberShell>
  );
}
