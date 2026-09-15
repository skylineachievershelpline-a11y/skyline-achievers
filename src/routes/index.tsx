import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDot,
  Clock3,
  GraduationCap,
  KeyRound,
  Lightbulb,
  Loader2,
  MessageCircle,
  MousePointer2,
  Play,
  PlayCircle,
  Quote,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";

import phoneHero from "@/assets/skyline-phone-hero.jpg";
import { MemberLoginCard } from "@/components/auth/MemberLoginCard";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { IntroPlayer } from "@/components/landing/IntroPlayer";
import { ReviewForm } from "@/components/landing/ReviewForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatsappJoinCard } from "@/components/whatsapp/WhatsappJoinCard";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { getLandingContent } from "@/lib/landing.functions";
import { openBeginnerSession } from "@/lib/sessions.functions";

export const Route = createFileRoute("/")({
  loader: () => getLandingContent(),
  head: () => ({
    meta: [
      { title: "Skyline Achievers | Learn with Your Phone" },
      {
        name: "description",
        content:
          "Learn how to use your mobile phone and internet to build practical skills, work productively from home, and grow consistently.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Skyline Achievers | Learn with Your Phone" },
      {
        property: "og:description",
        content: "Your phone can be more than entertainment. Learn practical digital skills with clear guidance.",
      },
    ],
  }),
  component: LandingPage,
});

const LEARNING_STEPS = [
  { icon: BookOpen, label: "Learn", text: "Understand practical skills and use digital tools with purpose." },
  { icon: BriefcaseBusiness, label: "Build", text: "Develop communication, productivity, and work-ready habits." },
  { icon: TrendingUp, label: "Grow", text: "Strengthen your confidence through consistent guided action." },
  { icon: Lightbulb, label: "Earn", text: "Discover how useful skills can create realistic possibilities." },
] as const;

const PHONE_SHIFT = [
  { from: "Scroll", to: "Learn", icon: MousePointer2 },
  { from: "Watch", to: "Build", icon: PlayCircle },
  { from: "Pass time", to: "Grow", icon: Clock3 },
] as const;

function LandingPage() {
  const content = Route.useLoaderData();
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
    <main className="landing-page min-h-screen overflow-hidden bg-background">
      <section id="home" className="relative flex min-h-[94svh] flex-col overflow-hidden border-b border-hairline">
        <img
          src={phoneHero}
          alt="A smartphone presented as a tool for learning, communication, and productive digital work"
          width={1920}
          height={1200}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-[69%_center] sm:object-center"
        />
        <div className="phone-hero-shade absolute inset-0" aria-hidden />
        <div className="landing-grid absolute inset-0 opacity-30" aria-hidden />

        <header className="relative z-20 border-b border-hairline bg-background/35 backdrop-blur-xl">
          <nav aria-label="Main navigation" className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-8 lg:px-12">
            <div className="min-w-0"><BrandLogo size="md" secretGesture /></div>
            <div className="hidden items-center gap-6 lg:flex">
              <a href="#home" className="landing-nav-link">Home</a>
              <a href="#about" className="landing-nav-link">About</a>
              <a href="#how-it-works" className="landing-nav-link">How It Works</a>
              <a href="#reviews" className="landing-nav-link">Reviews</a>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="ghost" className="hidden sm:inline-flex"><a href="#member-login">Login</a></Button>
              <Button asChild variant="brand"><a href="#access">Start Learning <ArrowRight /></a></Button>
            </div>
          </nav>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-end px-5 pb-24 pt-20 sm:items-center sm:px-8 sm:pb-28 lg:px-12">
          <div className="max-w-2xl animate-rise-in">
            <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase text-brand-glow">
              <span className="h-px w-8 bg-brand" /> Mobile-first learning platform
            </p>
            <h1 className="max-w-2xl font-display text-5xl font-semibold leading-[1.02] text-foreground sm:text-6xl lg:text-7xl">
              Your phone can be <span className="brand-text">more than just a phone.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-silver sm:text-lg">
              You already have a mobile phone and internet. Learn how to use them with purpose,
              build practical skills, and explore productive work-from-home possibilities—even part-time.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="brand" size="xl" className="sm:min-w-48"><a href="#access">Start learning <ArrowRight /></a></Button>
              <Button asChild variant="outline" size="xl" className="border-hairline bg-background/35 backdrop-blur-xl sm:min-w-44"><a href="#intro"><Play /> Watch intro</a></Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-glow" /> Practical learning</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-glow" /> Clear guidance</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-glow" /> No unrealistic promises</span>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-hairline bg-background/45 backdrop-blur-xl">
          <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-hairline px-3 sm:px-8 lg:px-12">
            {[{ icon: Smartphone, label: "Your phone" }, { icon: Wifi, label: "Your internet" }, { icon: GraduationCap, label: "The right skills" }].map(({ icon: Icon, label }) => (
              <div key={label} className="flex min-w-0 items-center justify-center gap-2 px-2 py-4 sm:justify-start sm:px-6"><Icon className="h-4 w-4 shrink-0 text-brand-glow" /><span className="truncate text-xs font-medium sm:text-sm">{label}</span></div>
            ))}
          </div>
        </div>
      </section>

      {content.quotes.length > 0 ? (
        <section aria-label="Motivational quotes" className="quote-rail border-b border-hairline bg-surface py-4">
          <div className="quote-track flex w-max items-center gap-4">
            {[...content.quotes, ...content.quotes].map((item, index) => (
              <div key={`${item.id}-${index}`} className="flex items-center gap-3 rounded-full border border-hairline bg-background/45 px-5 py-2.5 text-sm text-silver">
                <Sparkles className="h-3.5 w-3.5 text-brand-glow" /><span>“{item.quoteText}”</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section id="intro" className="scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <div className="pb-3">
              <p className="section-kicker">Start with the idea</p>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-5xl">A smarter way to use what you already have.</h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
                {content.intro?.description ?? "Skyline Achievers is a learning-focused community helping people use their phone, internet, and time more productively through practical skills and consistent guidance."}
              </p>
              <a href="#about" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-glow">Understand the platform <ArrowRight className="h-4 w-4" /></a>
            </div>
            <div className="cinema-frame"><IntroPlayer intro={content.intro} /></div>
          </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-20 border-y border-hairline bg-surface px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
          <div>
            <p className="section-kicker">About Skyline Achievers</p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-5xl">Learning becomes powerful when it leads to action.</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <p className="text-base leading-7 text-silver">We make practical digital learning clearer, more structured, and easier to follow from the device already in your hand.</p>
            <p className="text-base leading-7 text-muted-foreground">With guidance, community, and consistency, you can build better habits, stronger skills, and a more productive routine from home.</p>
            <div className="sm:col-span-2 grid grid-cols-3 border-y border-hairline py-5">
              {["Learn clearly", "Act consistently", "Grow responsibly"].map((item) => <p key={item} className="px-2 text-center text-xs font-semibold text-brand-glow sm:text-sm">{item}</p>)}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-kicker justify-center">Your phone. Reimagined.</p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-5xl">Turn screen time into skill time.</h2>
            <p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">Entertainment has its place. The same phone can also become a classroom, workspace, and tool for personal growth.</p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline md:grid-cols-3">
            {PHONE_SHIFT.map(({ from, to, icon: Icon }, index) => (
              <div key={from} className="group bg-background p-6 sm:p-8">
                <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">0{index + 1}</span><Icon className="h-5 w-5 text-brand-glow transition-transform group-hover:-translate-y-1" /></div>
                <p className="mt-12 text-sm text-muted-foreground line-through decoration-hairline">{from}</p>
                <p className="mt-2 font-display text-3xl font-semibold">{to}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-hairline bg-surface px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 grid gap-4 sm:grid-cols-2 sm:items-end"><div><p className="section-kicker">What you will learn</p><h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">A practical path forward.</h2></div><p className="text-sm leading-6 text-muted-foreground sm:text-right">Learn → Build → Grow → Earn</p></div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            {LEARNING_STEPS.map(({ icon: Icon, label, text }, index) => (
              <article key={label} className="group min-h-64 bg-background p-6 transition-colors hover:bg-surface-2">
                <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-lg border border-hairline bg-brand/10 text-brand-glow"><Icon className="h-5 w-5" /></span><span className="text-xs text-muted-foreground">0{index + 1}</span></div>
                <h3 className="mt-14 font-display text-2xl font-semibold">{label}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="reviews" className="scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <div>
              <p className="section-kicker">Reviews</p><h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Real experiences, reviewed before publishing.</h2>
              {content.reviews.length > 0 ? <div className="mt-8 grid gap-4 sm:grid-cols-2">{content.reviews.map((review) => (
                <article key={review.id} className="rounded-lg border border-hairline bg-surface p-5">
                  <Quote className="h-5 w-5 text-brand-glow" /><p className="mt-5 text-sm leading-7 text-silver">“{review.reviewText}”</p>
                  <div className="mt-5 flex items-end justify-between gap-4"><div><h3 className="font-semibold">{review.personName}</h3>{review.designation ? <p className="text-xs text-muted-foreground">{review.designation}</p> : null}</div>{review.rating ? <div className="flex text-brand-glow" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: review.rating }).map((_, index) => <Star key={index} className="h-3.5 w-3.5 fill-current" />)}</div> : null}</div>
                </article>
              ))}</div> : <div className="mt-8 rounded-lg border border-hairline bg-surface p-8"><MessageCircle className="h-7 w-7 text-brand-glow" /><p className="mt-4 font-display text-xl font-semibold">The review space is ready.</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Approved community experiences will appear here. No fictional testimonials are shown.</p></div>}
            </div>
            <div className="self-start overflow-hidden rounded-lg border border-hairline bg-surface"><div className="border-b border-hairline p-5 sm:p-7"><p className="text-xs font-semibold text-brand-glow">SHARE YOUR EXPERIENCE</p><h3 className="mt-2 font-display text-xl font-semibold">Help others learn from your journey.</h3></div><ReviewForm /></div>
          </div>
        </div>
      </section>

      {content.quotes.length > 0 ? <section className="relative overflow-hidden border-y border-hairline bg-surface px-5 py-20 text-center sm:px-8 sm:py-28"><div className="spotlight absolute inset-0" aria-hidden /><div className="relative mx-auto max-w-3xl"><CircleDot className="mx-auto h-6 w-6 text-brand-glow animate-glow" /><blockquote className="mt-7 font-display text-3xl font-semibold leading-tight text-silver sm:text-5xl">“{content.quotes[0]?.quoteText}”</blockquote><p className="mt-6 text-xs font-semibold uppercase text-muted-foreground">Learn • Earn • Lead</p></div></section> : null}

      <section id="access" className="scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-2xl"><p className="section-kicker">Continue your journey</p><h2 className="mt-3 font-display text-3xl font-semibold sm:text-5xl">Choose the right way in.</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">Existing members can sign in. Invited learners can open the session shared with them.</p></div>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <section id="member-login" aria-labelledby="member-login-heading" className="scroll-mt-24"><div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/15 text-brand-glow"><ShieldCheck className="h-4 w-4" /></span><div><p className="text-xs text-muted-foreground">EXISTING MEMBERS</p><h2 id="member-login-heading" className="font-display text-xl font-semibold">Welcome back</h2></div></div><MemberLoginCard /></section>
            <section id="session-access" aria-labelledby="session-code-heading" className="scroll-mt-24"><div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/15 text-brand-glow"><GraduationCap className="h-4 w-4" /></span><div><p className="text-xs text-muted-foreground">INVITED LEARNERS</p><h2 id="session-code-heading" className="font-display text-xl font-semibold">Beginners Training</h2></div></div>
              <div className="glass-panel-strong min-h-[390px] rounded-2xl p-6 sm:p-8"><div className="mb-8 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><KeyRound className="h-3.5 w-3.5" /> SESSION ACCESS</div><span className="rounded-full border border-hairline px-3 py-1 text-[10px] font-medium text-brand-glow">NO ACCOUNT NEEDED</span></div><div className="space-y-2"><Label htmlFor="sessionCode">Your session code</Label><Input id="sessionCode" placeholder="e.g. SKA-BEGIN-01" autoCapitalize="characters" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void onSessionSubmit(); } }} className="h-13 rounded-lg bg-background/35 text-base" /></div>{error ? <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">{error}</p> : null}<Button type="button" onClick={() => void onSessionSubmit()} variant="brand" size="xl" className="mt-6 w-full" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <PlayCircle />}{pending ? "Opening your session" : "Open training session"}</Button><p className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Your code opens only the session selected for you.</p></div>
            </section>
          </div>
        </div>
      </section>

      <section className="border-y border-hairline bg-surface px-5 py-16 sm:px-8"><div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><p className="section-kicker">Ready when you are</p><h2 className="mt-3 font-display text-3xl font-semibold">Use your technology with purpose.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Start with learning. Build useful skills. Take consistent action. Grow responsibly.</p></div><Button asChild variant="brand" size="xl"><a href="#access">Start learning <ArrowRight /></a></Button></div></section>

      <footer className="px-5 py-10 sm:px-8"><div className="mx-auto grid max-w-6xl gap-6 text-center sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:text-left"><BrandLogo size="sm" /><div><p className="text-sm font-medium text-silver">{BRAND.tagline.replaceAll(".", " •")}</p><p className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground sm:justify-end"><Users className="h-3.5 w-3.5" /> Learn with purpose. Grow with consistency.</p></div></div></footer>
      <WhatsappJoinCard variant="chip" />
    </main>
  );
}