import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLogin, adminStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Staff Access — Skyline Achievers" },
      { name: "description", content: "Passcode entry for Skyline Achievers platform administrators." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Staff Access — Skyline Achievers" },
      { property: "og:description", content: "Restricted administrator entry." },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const login = useServerFn(adminLogin);
  const checkStatus = useServerFn(adminStatus);
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await login({ data: { username, passcode } });
      if (result.ok) {
        const verified = await checkStatus();
        if (verified.isAdmin) {
          queryClient.setQueryData(["admin-status"], verified);

          await navigate({ to: "/admin", replace: true });
          return;
        }
        setError("Session could not be saved. Please sign in again.");
        return;
      }
      setError(
        result.reason === "throttled"
          ? "Too many attempts. Please wait a few minutes and try again."
          : "Incorrect username or password.",
      );

    } catch {
      setError("Could not open the panel. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="infographic-grid relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-12">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <BrandLogo size="lg" withWordmark={false} />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Staff access</h1>
            <p className="mt-1 text-xs text-muted-foreground">Restricted area — passcode required</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="glass-panel-strong metal-edge rounded-3xl p-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="skyadmin76"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 rounded-2xl text-base"
            />
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="passcode">Password</Label>
            <Input
              id="passcode"
              type="password"
              autoComplete="current-password"
              placeholder="Enter admin password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="h-12 rounded-2xl text-base tracking-widest"
            />
          </div>


          {error ? (
            <p className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="brand" size="xl" className="mt-6 w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Unlock panel
          </Button>
        </form>
      </div>
    </main>
  );
}
