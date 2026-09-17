import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { BRAND, memberIdToAuthEmail, normalizeMemberId } from "@/lib/brand";
import { recordLogin } from "@/lib/member.functions";
import { recordTraineeLogin, whoAmI } from "@/lib/trainee.functions";

/**
 * Existing member sign in — unchanged behaviour, extracted so the landing page
 * can place it beside the session-code panel.
 */
export function MemberLoginCard() {
  const navigate = useNavigate();
  const finishLogin = useServerFn(recordLogin);
  const identify = useServerFn(whoAmI);
  const finishTraineeLogin = useServerFn(recordTraineeLogin);
  const [memberId, setMemberId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const id = normalizeMemberId(memberId);
    if (!/^(76\d{10}|SK[AB]-[A-Z0-9]{4,10})$/.test(id)) {
      setError("Enter your Skyline ID, e.g. 760000123456.");
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

    // Trainee accounts land on the Beginners Training dashboard instead.
    const identity = await identify();
    if (identity.kind === "trainee") {
      const traineeResult = await finishTraineeLogin();
      if (traineeResult.status !== "ok") {
        await supabase.auth.signOut();
        setPending(false);
        setError(
          traineeResult.status === "blocked"
            ? "Your training access is temporarily blocked. Please contact your trainer."
            : "This training account is no longer active. Please contact your trainer.",
        );
        return;
      }
      await navigate({ to: "/beginners" });
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
    <form onSubmit={onSubmit} className="rounded-2xl bg-card p-4 sm:p-6">
      <div className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
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
            placeholder="760000123456"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value.toUpperCase())}
            className="h-13 rounded-lg text-base tracking-wider"
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
              className="h-13 rounded-lg pr-12 text-base"
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
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
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
  );
}
