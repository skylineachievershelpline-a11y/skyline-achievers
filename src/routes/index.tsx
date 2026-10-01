import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
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
import { useEffect, useState, type CSSProperties } from "react";

import skylineBackground from "@/assets/skyline-landing-bg-clean.jpg";
import { MemberLoginCard } from "@/components/auth/MemberLoginCard";
import { FlyingSkylineAiMascot } from "@/components/ai/SkylineAiMascot";
import { PublicSkylineAi } from "@/components/ai/PublicSkylineAi";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { IntroductionSection } from "@/components/landing/IntroductionSection";
import { HangingInstallTag } from "@/components/landing/HangingInstallTag";

import { ReviewsSection } from "@/components/landing/ReviewsSection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WhatsappJoinCard } from "@/components/whatsapp/WhatsappJoinCard";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { getSessionRole } from "@/lib/member.functions";
import { getAccessToken } from "@/lib/session-token";
import { consumeOpenLoginFlag, listDeviceAccounts } from "@/lib/device-accounts";
import { hasStoredSession, lastScreen } from "@/lib/offline-cache";
import { Loader2 } from "lucide-react";


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
    links: [{ rel: "preload", as: "image", href: skylineBackground, fetchPriority: "high" }],
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
  const [publicAiOpen, setPublicAiOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const resolveRole = useServerFn(getSessionRole);
  // Opened like an app: a signed-in person goes straight to their own screen,
  // with a splash instead of the landing page flashing first.
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    let active = true;
    if (!hasStoredSession()) document.documentElement.removeAttribute("data-signed-in");
    if (consumeOpenLoginFlag()) {
      document.documentElement.removeAttribute("data-signed-in");
      setLoginOpen(true);
      return;
    }
    const hasStored = hasStoredSession();
    if (hasStored) {
      // Opened like a chat app: go straight to the screen this person was last
      // using, without waiting for the internet to confirm anything.
      const saved = listDeviceAccounts()[0];
      const home = saved?.kind === "trainee" ? "/beginners" : saved?.kind === "executive" ? "/executive" : "/dashboard";
      const remembered = lastScreen();
      void navigate({ to: (remembered ?? home) as typeof home, replace: true }).finally(() =>
        document.documentElement.removeAttribute("data-signed-in"),
      );
      return;
    }
    void getAccessToken().then(async (token) => {
      if (!active) return;
      if (!token) {
        setLaunching(false);
        return;
      }
      // Only send people to a screen their account actually belongs to.
      const role = await resolveRole().catch(() => null);
      if (!active) return;
      if (!role) {
        setLaunching(false);
        return;
      }
      if (role.role === "member") void navigate({ to: "/dashboard" });
      else if (role.role === "trainee") void navigate({ to: "/beginners" });
      else {
        await supabase.auth.signOut();
        setLaunching(false);
      }
    });
    return () => {
      active = false;
    };
  }, [navigate, resolveRole]);


  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 36);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // Installed app: iOS reports standalone on the navigator, not the media query.
  useEffect(() => {
    if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) {
      document.documentElement.classList.add("is-installed-app");
    }
  }, []);

  if (launching) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <BrandLogo size="lg" withWordmark={false} />
        <Loader2 className="h-5 w-5 animate-spin text-brand-glow" />
      </main>
    );
  }

  return (
    <>
    {/* Installed app: no marketing page — sign in straight away. */}
    <main className="app-shell-only min-h-screen flex-col items-center justify-center gap-6 bg-background px-5 py-10">
      <BrandLogo size="lg" />
      <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">{BRAND.tagline}</p>
      <div className="w-full max-w-sm">
        <MemberLoginCard />
      </div>
    </main>
    <main className="landing-web-only motion-scope cinematic-landing relative min-h-screen overflow-hidden">
      <section className="cinematic-hero relative flex min-h-[92svh] flex-col overflow-hidden border-b border-hairline shadow-lift">
        <img
          src={skylineBackground}
          alt="Modern glass towers rising into the sky"
          width={1600}
          height={1008}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[64%_center]"
        />

        <div className="landing-hero-shade absolute inset-0" aria-hidden />
        <div className="hero-liquid-glow absolute inset-0" aria-hidden />
        <div className="hero-scanline absolute inset-y-0 left-[12%] hidden w-px lg:block" aria-hidden />
        <div className="hero-scanline absolute inset-y-0 right-[18%] hidden w-px lg:block" aria-hidden />
        <div className="hero-orbit absolute right-[8%] top-[22%] hidden h-72 w-72 rounded-full lg:block" aria-hidden />

        <nav className={`cinematic-nav fixed inset-x-0 top-0 z-40 mx-auto flex w-full items-center justify-between px-5 sm:px-8 lg:px-12 ${scrolled ? "is-compact" : ""}`}>
          <div className="min-w-0 flex-1">
            <BrandLogo size="md" secretGesture />
          </div>
          <div className="flex items-center gap-2">
            <HangingInstallTag />
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

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pb-24 pt-28 sm:px-8 lg:px-12">
          <div className="max-w-4xl">
            <div className="hero-sequence hero-sequence-1 metal-edge mb-7 inline-flex items-center gap-2 rounded-xl border bg-background/75 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-silver shadow-lift backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-brand-glow" />
              {BRAND.tagline}
            </div>
            <h1 className="max-w-4xl font-display text-5xl font-extrabold leading-[0.94] text-foreground sm:text-6xl lg:text-8xl">
              <span className="hero-line hero-sequence hero-sequence-2">SKYLINE</span>
              <span className="hero-line hero-sequence hero-sequence-3 brand-text">ACHIEVERS</span>
            </h1>
            <p className="hero-sequence hero-sequence-4 mt-5 max-w-xl font-display text-xl font-semibold leading-8 text-foreground sm:text-2xl">
              Turn your smartphone into a real income skill.
            </p>
            <p className="hero-sequence hero-sequence-4 mt-3 max-w-xl text-base leading-7 text-silver sm:text-lg">
              No experience needed. Watch the free orientation, get a personal mentor, and grow
              step by step — using only a phone and an internet connection.
            </p>
            <div className="hero-sequence hero-sequence-5 mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="brand" size="xl" className="sm:min-w-56">
                <a href="#introduction">
                  Watch Free Orientation
                  <ArrowRight />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="xl"
                className="border-metal/30 bg-background/70 backdrop-blur-md sm:min-w-48"
              >
                <a href="#start">
                  <Wifi />
                  Join Next Batch
                </a>
              </Button>
            </div>
            <div className="hero-sequence hero-sequence-6 relative mt-6 h-20 w-full max-w-xl">
              <Button
                type="button"
                variant="brand"
                size="xl"
                className="h-16 w-full justify-between rounded-2xl pl-20"
                onClick={() => setPublicAiOpen(true)}
              >
                <span>Skyline Achievers AI</span>
                <span className="text-xs opacity-80">Ask about us</span>
              </Button>
              <FlyingSkylineAiMascot onActivate={() => setPublicAiOpen(true)} />
            </div>
          </div>
        </div>

        <a href="#introduction" className="hero-sequence hero-sequence-6 absolute bottom-24 right-6 z-20 hidden items-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-silver sm:flex lg:right-12">
          Explore <span className="scroll-indicator"><span /></span>
        </a>

        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-metal/20 bg-background/85 shadow-[0_-16px_36px_-28px_var(--brand)] backdrop-blur-md">
          <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-hairline px-5 sm:px-8 lg:px-12">
            {TRUST_POINTS.map(({ icon: Icon, title, detail }) => (
              <div
                key={title}
                className="hero-sequence hero-sequence-6 flex items-center justify-center gap-2.5 px-2 py-4 sm:justify-start sm:px-6"
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

      <section id="about" className="section-flow relative overflow-hidden border-b border-hairline px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div data-reveal className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
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
                className={`cinematic-card glass-panel metal-edge depth-hover relative rounded-2xl p-5 pt-16 ${index % 2 === 1 ? "lg:mt-12" : ""}`}
                style={{ "--motion-order": index } as CSSProperties}
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
        <DialogContent className="metal-edge max-h-[92dvh] overflow-y-auto rounded-2xl p-0 sm:max-w-md">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="font-display text-xl">Member login</DialogTitle>
          </DialogHeader>
          <div className="px-2 pb-2">
            <MemberLoginCard />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={publicAiOpen} onOpenChange={setPublicAiOpen}>
        <DialogContent className="metal-edge max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl overflow-hidden rounded-2xl p-4 sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="font-display text-xl">Skyline Achievers AI</DialogTitle>
          </DialogHeader>
          <PublicSkylineAi />
        </DialogContent>
      </Dialog>
    </main>
    </>
  );

}
