import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { BRAND, memberIdToAuthEmail, normalizeMemberId } from "@/lib/brand";
import { recordLogin } from "@/lib/member.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Member Sign In — Skyline Achievers" },
      {
        name: "description",
        content:
          "Private member sign in for the Skyline Achievers training platform. Enter your Member ID and password to access your training level.",
      },
      { property: "og:title", content: "Member Sign In — Skyline Achievers" },
      {
        property: "og:description",
        content: "Private training platform for Skyline Achievers members.",
      },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const finishLogin = useServerFn(recordLogin);
  const [memberId, setMemberId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const id = normalizeMemberId(memberId);
    if (!/^SKA-[A-Z0-9]{4,10}$/.test(id)) {
      setError("Enter your Member ID in the format SKA-12345.");
      return;
    }
    if (password.length < 6) {
      setError("Enter the password provided by your administrator.");
      return;
    }

    setPending(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: memberIdToAuthEmail(id),
      password,
    });
    if (signInError) {
      setPending(false);
      setError("That Member ID and password combination is not recognised.");
      return;
    }

    const result = await finishLogin();
    if (result.status !== "ok") {
      await supabase.auth.signOut();
      setPending(false);
      setError(
        result.status === "blocked"
          ? "Your membership is temporarily blocked. Please contact your administrator."
          : result.status === "removed"
            ? "This membership has been removed. Please contact your administrator."
            : "No membership profile is linked to this account yet.",
      );
      return;
    }
    await navigate({ to: "/dashboard" });
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-12">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <BrandLogo size="lg" withWordmark={false} secretGesture />
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{BRAND.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{BRAND.tagline}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="glass-panel-strong rounded-3xl p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5" />
            Members only
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="memberId">Member ID</Label>
              <Input
                id="memberId"
                autoCapitalize="characters"
                autoComplete="username"
                placeholder="SKA-12345"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value.toUpperCase())}
                className="h-12 rounded-2xl text-base tracking-wider"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-2xl pr-12 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="brand" size="xl" className="mt-6 w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? "Signing you in" : "Sign in"}
          </Button>

          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Accounts are issued by Skyline Achievers administrators. Lost your credentials? Contact{" "}
            {BRAND.supportContact}.
          </p>
        </form>
      </div>
    </main>
  );
}
