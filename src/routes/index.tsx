import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Download,
  GraduationCap,
  LogIn,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Trophy,
  Users,
  Wifi,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import skylineBackground from "@/assets/skyline-landing-bg-clean.jpg";
import { MemberLoginCard } from "@/components/auth/MemberLoginCard";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { IntroductionSection } from "@/components/landing/IntroductionSection";
import { LandingInstallSection } from "@/components/landing/LandingInstallSection";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WhatsappJoinCard } from "@/components/whatsapp/WhatsappJoinCard";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Skyline Achievers | Learn Online Earning From Your Phone" },
      {
        name: "description",
        content:
          "Skyline Achievers teaches you how to use just a mobile phone and internet to build real online earning skills, step by step, with guided training and leadership growth.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Skyline Achievers | Learn Online Earning From Your Phone" },
      {
        property: "og:description",
        content:
          "Learn how a phone and internet connection can become your income skill — guided training, mentorship and leadership levels.",
      },
    ],
  }),
  component: LandingPage,
});

const TRUST_POINTS = [
  { icon: Smartphone, title: "Mobile first", detail: "Only a phone needed" },
  { icon: BookOpen, title: "Step by step", detail: "Guided learning" },
  { icon: Trophy, title: "Growth path", detail: "Leadership levels" },
] as const;

const HOW_IT_WORKS = [
  {
    icon: Smartphone,
    title: "Start with what you have",
    detail:
      "A mobile phone and an internet connection are enough. No office, no big investment, no experience needed.",
  },
  {
    icon: GraduationCap,
    title: "Learn real skills",
    detail:
      "Simple, practical training that shows you how online earning actually works — explained in a language you understand.",
  },
  {
    icon: Users,
    title: "Grow with mentorship",
    detail:
      "You are never alone. Trainers and seniors guide you personally at every stage of your journey.",
  },
  {
    icon: Trophy,
    title: "Rise through the levels",
    detail:
      "From personal mentorship to full management training, every level you complete unlocks the next one.",
  },
] as const;

function LandingPage() {
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);

  const resolveRole = useServerFn(getSessionRole);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return;
      // Only send people to a screen their account actually belongs to.
      const role = await resolveRole().catch(() => null);
      if (!active || !role) return;
      if (role.role === "member") void navigate({ to: "/dashboard" });
      else if (role.role === "trainee") void navigate({ to: "/beginners" });
      else await supabase.auth.signOut();
    });
    return () => {
      active = false;
    };
  }, [navigate, resolveRole]);

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <section className="relative flex min-h-[92svh] flex-col overflow-hidden border-b border-hairline shadow-lift">
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
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="hidden h-10 border-metal/30 bg-background/80 shadow-lift backdrop-blur-md sm:inline-flex"
            >
              <a href="#install">
                <Download className="h-4 w-4" />
                Install app
              </a>
            </Button>
            <Button
              variant="outline"
              className="h-10 border-metal/30 bg-background/80 shadow-lift backdrop-blur-md"
              onClick={() => setLoginOpen(true)}
            >
              <LogIn className="h-4 w-4" />
              Login
            </Button>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pb-24 pt-12 sm:px-8 lg:px-12">
          <div className="max-w-3xl animate-rise-in">
            <div className="metal-edge mb-7 inline-flex items-center gap-2 rounded-xl border bg-background/75 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-silver shadow-lift backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-brand-glow" />
              {BRAND.tagline}
            </div>
            <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.03] text-foreground sm:text-6xl lg:text-7xl">
              Your phone can be
              <br />
              <span className="brand-text">your income skill.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-silver sm:text-lg">
              {BRAND.name} teaches ordinary people how to use just a mobile phone and an internet
              connection to learn online earning — with real training, real mentorship and a clear
              path to leadership.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button variant="brand" size="xl" className="sm:min-w-44" onClick={() => setLoginOpen(true)}>
                Login
                <ArrowRight />
              </Button>
              <Button
                asChild
                variant="outline"
                size="xl"
                className="border-metal/30 bg-background/70 backdrop-blur-md sm:min-w-52"
              >
                <a href="#about">
                  <Wifi />
                  What is {BRAND.shortName}?
                </a>
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-metal/20 bg-background/85 shadow-[0_-16px_36px_-28px_var(--brand)] backdrop-blur-md">
          <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-hairline px-5 sm:px-8 lg:px-12">
            {TRUST_POINTS.map(({ icon: Icon, title, detail }) => (
              <div
                key={title}
                className="flex items-center justify-center gap-2.5 px-2 py-4 sm:justify-start sm:px-6"
              >
                <Icon className="hidden h-4 w-4 text-brand sm:block" />
                <div>
                  <p className="text-xs font-semibold text-foreground sm:text-sm">{title}</p>
                  <p className="hidden text-xs text-muted-foreground sm:block">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <IntroductionSection />

      <section id="about" className="infographic-grid relative overflow-hidden border-b border-hairline px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-glow">
                About {BRAND.name}
              </p>
              <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold sm:text-4xl">
                We teach the skill, you build the future.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              {BRAND.name} is a private learning community. We believe that anyone with a mobile
              phone, internet and the will to learn can earn online — if someone teaches them
              properly.
            </p>
          </div>

          <div className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            <div className="connector-line absolute left-[12.5%] right-[12.5%] top-11 hidden h-px lg:block" aria-hidden />
            {HOW_IT_WORKS.map(({ icon: Icon, title, detail }, index) => (
              <article
                key={title}
                className={`glass-panel metal-edge depth-hover relative rounded-2xl p-5 pt-16 animate-rise-in ${index % 2 === 1 ? "lg:mt-12" : ""}`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className="absolute -top-3 left-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan/30 brand-gradient text-brand-foreground shadow-brand">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="absolute right-4 top-4 font-display text-xs font-bold text-metal">0{index + 1}</span>
                <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <LandingInstallSection />

      <ReviewsSection />

      <footer className="border-t border-hairline px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <BrandLogo size="sm" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Learn. Earn. Lead. Together.
          </div>
        </div>
      </footer>

      <WhatsappJoinCard variant="chip" />

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="metal-edge rounded-2xl p-0 sm:max-w-md">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="font-display text-xl">Member login</DialogTitle>
          </DialogHeader>
          <div className="px-2 pb-2">
            <MemberLoginCard />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
