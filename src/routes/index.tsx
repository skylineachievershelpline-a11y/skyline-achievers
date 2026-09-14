import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  GraduationCap,
  KeyRound,
  Loader2,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import skylineBackground from "@/assets/skyline-landing-bg-clean.jpg";
import { MemberLoginCard } from "@/components/auth/MemberLoginCard";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatsappJoinCard } from "@/components/whatsapp/WhatsappJoinCard";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { openBeginnerSession } from "@/lib/sessions.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Skyline Achievers | Learn. Earn. Lead." },
      {
        name: "description",
        content:
          "Enter the Skyline Achievers training platform for leadership development, member learning and private Beginners Training sessions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Skyline Achievers | Learn. Earn. Lead." },
      {
        property: "og:description",
        content: "A private learning and leadership platform built for Skyline Achievers.",
      },
    ],
  }),
  component: LandingPage,
});

const JOURNEY = [
  "Personal Mentorship",
  "Assistant Supervisor",
  "Supervisor",
  "Assistant Manager",
  "Manager",
];

function LandingPage() {
  const navigate = useNavigate();
  const openSession = useServerFn(openBeginnerSession);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function onSessionSubmit() {
    setError(null);
    const value = code.trim().toUpperCase();
    if (value.length < 4) {
      setError("Enter the session code given to you by your trainer.");
      return;
    }
    setPending(true);
    try {
      const result = await openSession({ data: { code: value } });
      if (result.status !== "ok") {
        setError("That session code is not valid. Please check it and try again.");
        return;
      }
      await navigate({ to: "/session/$code", params: { code: result.session.code } });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <section className="relative flex min-h-[92svh] flex-col overflow-hidden border-b border-hairline">
        <img
          src={skylineBackground}
          alt="Modern glass towers rising into the sky"
          width={1600}
          height={1008}
          className="absolute inset-0 h-full w-full object-cover object-[64%_center]"
        />
        <div className="landing-hero-shade absolute inset-0" aria-hidden />

        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <BrandLogo size="md" secretGesture />
          <a
            href="#access"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-hairline bg-background/55 px-4 text-sm font-medium text-foreground backdrop-blur-xl transition-colors hover:bg-background/75"
          >
            Member access
            <ArrowRight className="h-4 w-4" />
          </a>
        </nav>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pb-24 pt-12 sm:px-8 lg:px-12">
          <div className="max-w-3xl animate-rise-in">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-hairline bg-background/45 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-silver backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5 text-brand-glow" />
              The journey to leadership starts here
            </div>
            <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.03] text-foreground sm:text-6xl lg:text-7xl">
              Learn with purpose.
              <br />
              <span className="brand-text">Rise with confidence.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-silver sm:text-lg">
              A focused training experience for ambitious people ready to develop skills, build
              leadership, and achieve more together.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="brand" size="xl" className="sm:min-w-44">
                <a href="#member-login">
                  Sign in
                  <ArrowRight />
                </a>
              </Button>
              <Button asChild variant="outline" size="xl" className="border-hairline bg-background/35 backdrop-blur-xl sm:min-w-52">
                <a href="#session-access">
                  <PlayCircle />
                  Open a session
                </a>
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-hairline bg-background/45 backdrop-blur-xl">
          <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-hairline px-5 sm:px-8 lg:px-12">
            {[
              [ShieldCheck, "Private", "Secure access"],
              [BookOpen, "Focused", "Guided learning"],
              [Trophy, "Progressive", "Leadership growth"],
            ].map(([Icon, title, detail]) => (
              <div key={String(title)} className="flex items-center justify-center gap-2.5 px-2 py-4 sm:justify-start sm:px-6">
                <Icon className="hidden h-4 w-4 text-brand sm:block" />
                <div>
                  <p className="text-xs font-semibold text-foreground sm:text-sm">{String(title)}</p>
                  <p className="hidden text-xs text-muted-foreground sm:block">{String(detail)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="access" className="relative px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-glow">Your next step</p>
              <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold sm:text-4xl">
                Everything you need to move forward.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Members can continue their learning. New trainees can enter the private session code
              shared by their trainer.
            </p>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <section id="member-login" aria-labelledby="member-login-heading" className="scroll-mt-6 animate-rise-in">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand-glow">
                  <BadgeCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Existing members</p>
                  <h2 id="member-login-heading" className="font-display text-xl font-semibold">Welcome back</h2>
                </div>
              </div>
              <MemberLoginCard />
            </section>

            <section id="session-access" aria-labelledby="session-code-heading" className="scroll-mt-6 animate-rise-in">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand-glow">
                  <GraduationCap className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Invited trainees</p>
                  <h2 id="session-code-heading" className="font-display text-xl font-semibold">Beginners Training</h2>
                </div>
              </div>

              <div className="glass-panel-strong min-h-[390px] rounded-2xl p-6 sm:p-8">
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    Session access
                  </div>
                  <span className="rounded-full border border-hairline px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-success">
                    No account needed
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sessionCode">Your session code</Label>
                  <Input
                    id="sessionCode"
                    placeholder="e.g. SKA-BEGIN-01"
                    autoCapitalize="characters"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void onSessionSubmit();
                      }
                    }}
                    className="h-13 rounded-lg bg-background/35 text-base tracking-[0.14em]"
                  />
                </div>

                {error ? (
                  <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                    {error}
                  </p>
                ) : null}

                <Button type="button" onClick={() => void onSessionSubmit()} variant="brand" size="xl" className="mt-6 w-full" disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <PlayCircle />}
                  {pending ? "Opening your session" : "Open training session"}
                </Button>

                <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Your code opens only the session selected for you by your trainer.
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="border-y border-hairline bg-surface px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-9 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-glow">The Skyline path</p>
              <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Built for continuous growth</h2>
            </div>
            <ArrowDown className="hidden h-5 w-5 text-muted-foreground sm:block" />
          </div>
          <ol className="grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-5">
            {JOURNEY.map((level, index) => (
              <li key={level} className="flex min-h-28 flex-col justify-between bg-background p-5">
                <span className="text-xs font-semibold tabular-nums text-brand-glow">0{index + 1}</span>
                <p className="mt-5 text-sm font-medium leading-5 text-foreground">{level}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <BrandLogo size="sm" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Learn. Earn. Lead. Together.
          </div>
        </div>
      </footer>

      <WhatsappJoinCard variant="chip" />
    </main>
  );
}