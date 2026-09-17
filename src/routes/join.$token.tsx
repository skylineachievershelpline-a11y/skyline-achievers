import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { WelcomeCard, type Credentials } from "@/components/team/WelcomeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";
import { getInvite, registerWithInvite } from "@/lib/trainee.functions";

export const Route = createFileRoute("/join/$token")({
  head: () => ({
    meta: [
      { title: "Reserve Your Seat — Skyline Achievers" },
      {
        name: "description",
        content:
          "Fill your details to reserve a seat in Skyline Achievers Beginners Training and get your Skyline ID instantly.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Reserve Your Seat — Skyline Achievers" },
      {
        property: "og:description",
        content: "Register with your inviter's link and receive your Skyline ID and password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const check = useServerFn(getInvite);
  const register = useServerFn(registerWithInvite);
  const [form, setForm] = useState({ fullName: "", phone: "", age: "" });
  const [card, setCard] = useState<Credentials | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => check({ data: { token } }),
    retry: false,
  });

  const submit = useMutation({
    mutationFn: () =>
      register({
        data: {
          token,
          fullName: form.fullName,
          phone: form.phone,
          age: form.age ? Number(form.age) : null,
        },
      } as never),
    onSuccess: (result: any) => {
      if (result.status !== "ok") {
        toast.error("This registration link is no longer active.");
        return;
      }
      setCard(result.credentials as Credentials);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  const invite = data?.status === "ok" ? data.invite : null;

  return (
    <main className="relative min-h-screen px-4 pb-16 pt-8 sm:px-8">
      <div className="spotlight pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto w-full max-w-lg">
        <header className="mb-6 flex flex-col items-center text-center animate-rise-in">
          <BrandLogo size="md" />
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            Reserve your seat
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{BRAND.tagline}</p>
        </header>

        {card ? (
          <div className="space-y-4">
            <WelcomeCard credentials={card} />
            <Link to="/" className="block">
              <Button variant="brand" size="xl" className="w-full">
                Go to sign in
              </Button>
            </Link>
          </div>
        ) : !invite ? (
          <div className="glass-panel-strong rounded-3xl p-8 text-center animate-rise-in">
            <p className="font-display text-lg font-semibold">This link is not active</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Please ask the person who invited you for a fresh registration link.
            </p>
            <Link to="/" className="mt-6 inline-block">
              <Button variant="outline" size="xl">
                Back to home
              </Button>
            </Link>
          </div>
        ) : (
          <form
            className="glass-panel-strong rounded-[28px] p-6 animate-rise-in sm:p-8"
            onSubmit={(event) => {
              event.preventDefault();
              submit.mutate();
            }}
          >
            <p className="mb-6 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Invited by {invite.uplineName} · {invite.uplineCode}
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Your full name</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Age (18+ only)</Label>
                <Input
                  id="age"
                  type="number"
                  min={18}
                  max={90}
                  value={form.age}
                  onChange={(event) => setForm({ ...form, age: event.target.value })}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="brand"
              size="xl"
              className="mt-6 w-full"
              disabled={submit.isPending}
            >
              {submit.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Create my Skyline ID
            </Button>

            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Your details are used only to create your training account.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
