import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  finishFinalTest,
  getFinalTestByToken,
  startFinalTest,
  submitFinalAnswer,
} from "@/lib/finaltest.functions";

export const Route = createFileRoute("/test/$token")({
  head: () => ({
    meta: [
      { title: "Final Test — Skyline Achievers" },
      {
        name: "description",
        content: "Open your personal Skyline Achievers Final Test using your test link.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Final Test — Skyline Achievers" },
      { property: "og:description", content: "Your personal Skyline Achievers Final Test." },
    ],
  }),
  component: CandidateTestPage,
});

type Question = {
  id: string;
  type: "mcq" | "written";
  marks: number;
  timeLimitSeconds: number;
  text: string;
  voiceUrl: string | null;
  options: string[];
};

type Info = {
  personName: string;
  mobile: string;
  uplineName: string;
  testStatus: string;
  marks: number | null;
  result: string;
};

const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "urdu", label: "Urdu" },
  { value: "voice", label: "Voice" },
] as const;

function CandidateTestPage() {
  const { token } = useParams({ from: "/test/$token" });
  const loadTest = useServerFn(getFinalTestByToken);
  const start = useServerFn(startFinalTest);
  const submit = useServerFn(submitFinalAnswer);
  const finish = useServerFn(finishFinalTest);

  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const [rules, setRules] = useState<{
    english: string | null;
    urdu: string | null;
    voiceUrl: string | null;
    showResult: boolean;
  } | null>(null);

  const [language, setLanguage] = useState<"english" | "urdu" | "voice">("english");
  const [phase, setPhase] = useState<"rules" | "test" | "done">("rules");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    void loadTest({ data: { token } })
      .then((res: any) => {
        if (res.status !== "ok") {
          setInvalid(true);
          return;
        }
        setInfo(res.test);
        setRules(res.rules);
        if (res.test.testStatus === "completed") setPhase("done");
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [loadTest, token]);

  const current = questions[index] ?? null;

  const goNext = useCallback(
    async (payload: { answerText: string | null; selectedOption: number | null }) => {
      if (!current || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        await submit({
          data: {
            token,
            questionId: current.id,
            answerText: payload.answerText,
            selectedOption: payload.selectedOption,
          },
        });
        setAnswerText("");
        setChoice(null);
        if (index + 1 >= questions.length) {
          await finish({ data: { token } });
          setPhase("done");
        } else {
          setIndex((i) => i + 1);
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [current, finish, index, questions.length, submit, token],
  );

  // Per-question countdown. When time runs out the answer is submitted as is.
  useEffect(() => {
    if (phase !== "test" || !current) return;
    setSeconds(current.timeLimitSeconds);
    const id = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(id);
          void goNext({ answerText: null, selectedOption: null });
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current?.id]);

  const clock = useMemo(() => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [seconds]);

  async function onContinue() {
    setBusy(true);
    try {
      const res: any = await start({ data: { token, language } });
      if (res.status === "completed") {
        setPhase("done");
        return;
      }
      if (res.status !== "ok" || res.questions.length === 0) {
        setPhase("done");
        return;
      }
      setQuestions(res.questions as Question[]);
      setIndex(0);
      setPhase("test");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen px-5 py-10">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-2xl">
        <header className="mb-8 flex flex-col items-center gap-3 text-center animate-rise-in">
          <BrandLogo size="md" withWordmark={false} />
          <h1 className="font-display text-2xl font-semibold tracking-tight">Final Test</h1>
        </header>

        {invalid || !info ? (
          <div className="glass-panel-strong rounded-3xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
              This test link is not valid. Please ask your upline for the correct link.
            </p>
          </div>
        ) : phase === "done" ? (
          <div className="glass-panel-strong rounded-3xl p-10 text-center animate-rise-in">
            <CheckCircle2 className="mx-auto h-10 w-10 text-brand" />
            <h2 className="mt-4 font-display text-xl font-semibold">Test completed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you, {info.personName}. Your answers have been recorded.
            </p>
            {rules?.showResult && info.result !== "pending" ? (
              <p className="mt-4 text-sm">
                Marks: <span className="font-semibold">{info.marks ?? 0}</span> · Result:{" "}
                <span className="font-semibold">{info.result.toUpperCase()}</span>
              </p>
            ) : null}
          </div>
        ) : phase === "rules" ? (
          <div className="space-y-5">
            <section className="glass-panel-strong rounded-3xl p-6 animate-rise-in">
              <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Your information
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{info.personName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Mobile</dt>
                  <dd className="font-medium">{info.mobile}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Upline</dt>
                  <dd className="font-medium">{info.uplineName}</dd>
                </div>
              </dl>
            </section>

            <section
              className="glass-panel rounded-3xl p-6 animate-rise-in"
              style={{ animationDelay: "60ms" }}
            >
              <h2 className="font-display text-lg font-semibold">Final Test rules</h2>
              {language === "urdu" && rules?.urdu ? (
                <p className="mt-3 whitespace-pre-line text-right text-sm leading-relaxed text-muted-foreground" dir="rtl">
                  {rules.urdu}
                </p>
              ) : (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {rules?.english ?? "Rules will be shared by your upline."}
                </p>
              )}
              {language === "voice" && rules?.voiceUrl ? (
                <audio controls src={rules.voiceUrl} className="mt-4 w-full" />
              ) : null}
            </section>

            <section
              className="glass-panel-strong rounded-3xl p-6 animate-rise-in"
              style={{ animationDelay: "120ms" }}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Choose your option
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {LANGUAGES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setLanguage(item.value)}
                    className={
                      language === item.value
                        ? "rounded-2xl border border-brand bg-glass-strong px-4 py-3 text-sm font-semibold text-foreground shadow-glow"
                        : "rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="brand"
                size="xl"
                className="mt-5 w-full"
                disabled={busy}
                onClick={() => void onContinue()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue
              </Button>
            </section>
          </div>
        ) : current ? (
          <section className="glass-panel-strong rounded-3xl p-6 animate-rise-in">
            <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
              <span className="uppercase tracking-[0.18em]">
                Question {index + 1} of {questions.length}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-2 px-3 py-1 font-medium text-foreground">
                <Clock className="h-3.5 w-3.5" /> {clock}
              </span>
            </div>

            {language === "voice" && current.voiceUrl ? (
              <audio controls src={current.voiceUrl} className="mb-4 w-full" />
            ) : null}
            <p
              className={
                language === "urdu"
                  ? "text-right font-display text-lg font-semibold leading-relaxed"
                  : "font-display text-lg font-semibold leading-relaxed"
              }
              dir={language === "urdu" ? "rtl" : "ltr"}
            >
              {current.text}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Marks: {current.marks}</p>

            {current.type === "mcq" ? (
              <div className="mt-5 space-y-2">
                {current.options.map((option, i) => (
                  <button
                    key={`${current.id}-${i}`}
                    type="button"
                    onClick={() => setChoice(i)}
                    className={
                      choice === i
                        ? "w-full rounded-2xl border border-brand bg-glass-strong px-4 py-3 text-left text-sm text-foreground"
                        : "w-full rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <Textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Write your answer"
                className="mt-5 min-h-32 rounded-2xl"
              />
            )}

            <Button
              type="button"
              variant="brand"
              size="xl"
              className="mt-5 w-full"
              disabled={busy}
              onClick={() =>
                void goNext({
                  answerText: current.type === "written" ? answerText.trim() || null : null,
                  selectedOption: current.type === "mcq" ? choice : null,
                })
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {index + 1 >= questions.length ? "Submit and finish" : "Submit answer"}
            </Button>
            <p className="mt-3 text-[11px] text-muted-foreground">
              A submitted answer is saved and cannot be opened again.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
