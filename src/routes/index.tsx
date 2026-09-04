import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap, KeyRound, Loader2, MessageCircle, PlayCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { MemberLoginCard } from "@/components/auth/MemberLoginCard";
import { WhatsappJoinCard } from "@/components/whatsapp/WhatsappJoinCard";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { openBeginnerSession } from "@/lib/sessions.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Skyline Achievers — Member Sign In & Training Sessions" },
      {
        name: "description",
        content:
          "Sign in as a Skyline Achievers member, or enter your Beginners Training session code to open your session instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Skyline Achievers — Member Sign In & Training Sessions" },
      {
        property: "og:description",
        content:
          "Private training platform for Skyline Achievers members, plus code-based beginners training sessions.",
      },
    ],
  }),
  component: LandingPage,
});

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

  async function onSessionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    <main className="relative min-h-screen overflow-hidden px-5 py-10 sm:py-16">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative mx-auto w-full max-w-5xl">
        <header className="mb-10 flex flex-col items-center gap-4 text-center animate-rise-in">
          <BrandLogo size="lg" withWordmark={false} secretGesture />
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {BRAND.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{BRAND.tagline}</p>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            A private training platform for Skyline Achievers. Members sign in below with their
            Member ID — new trainees can open a Beginners Training session with a session code.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          <section
            className="animate-rise-in"
            style={{ animationDelay: "60ms" }}
            aria-labelledby="member-login-heading"
          >
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <h2 id="member-login-heading" className="font-display text-lg font-semibold">
                Member sign in
              </h2>
            </div>
            <MemberLoginCard />
          </section>

          <section
            className="animate-rise-in"
            style={{ animationDelay: "120ms" }}
            aria-labelledby="session-code-heading"
          >
            <div className="mb-3 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-brand" />
              <h2 id="session-code-heading" className="font-display text-lg font-semibold">
                Beginners Training session
              </h2>
            </div>

            <form onSubmit={onSessionSubmit} className="glass-panel-strong rounded-3xl p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                No account needed
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionCode">Session code</Label>
                <Input
                  id="sessionCode"
                  placeholder="e.g. SKA-BEGIN-01"
                  autoCapitalize="characters"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="h-12 rounded-2xl text-base tracking-[0.14em]"
                />
              </div>

              {error ? (
                <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="brand"
                size="xl"
                className="mt-6 w-full"
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                {pending ? "Opening your session" : "Open session"}
              </Button>

              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                Each session code opens only its own training session. Codes are issued by{" "}
                {BRAND.supportContact}.
              </p>
            </form>
          </section>
          <section
            className="animate-rise-in lg:col-span-2"
            style={{ animationDelay: "180ms" }}
            aria-labelledby="whatsapp-heading"
          >
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-brand" />
              <h2 id="whatsapp-heading" className="font-display text-lg font-semibold">
                Join a WhatsApp group
              </h2>
            </div>
            <WhatsappJoinCard />
          </section>
        </div>
      </div>
    </main>
  );
}
