import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, KeyRound, Loader2, Menu, Play, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

import deviceStory from "@/assets/skyline-device-story.jpg";
import phoneHero from "@/assets/skyline-phone-hero.jpg";
import { MemberLoginCard } from "@/components/auth/MemberLoginCard";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      { title: "Skyline Achievers | Learn. Earn. Lead." },
      { name: "description", content: "Turn your phone and internet into practical learning, stronger skills and new possibilities with Skyline Achievers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Skyline Achievers | Learn. Earn. Lead." },
      { property: "og:description", content: "A mobile-first learning platform for practical skills, productivity and personal growth." },
    ],
  }),
  component: LandingPage,
});

type Intro = { title: string; description: string | null; video_signed_url: string | null; thumbnail_url: string | null; aspect_ratio: string };
type Quote = { id: string; quote_text: string };
type Review = { id: string; person_name: string; designation: string | null; review_text: string; rating: number | null; photo_url: string | null };

function LandingPage() {
  const content = Route.useLoaderData() as { intro: Intro | null; quotes: Quote[]; reviews: Review[] };
  const navigate = useNavigate();
  const openSession = useServerFn(openBeginnerSession);
  const [accessOpen, setAccessOpen] = useState<"login" | "session" | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
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
    if (value.length < 4) { setError("Enter the session code given to you by your trainer."); return; }
    setPending(true);
    try {
      const result = await openSession({ data: { code: value } });
      if (result.status !== "ok") { setError("That session code is not valid. Please check it and try again."); return; }
      await navigate({ to: "/session/$code", params: { code: result.session.code } });
    } catch { setError("Something went wrong. Please try again."); }
    finally { setPending(false); }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-hairline bg-background/80 backdrop-blur-xl">
        <nav className="mx-auto grid h-18 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 sm:h-20 sm:px-8 lg:px-10">
          <BrandLogo size="sm" secretGesture />
          <div className="hidden items-center gap-8 md:flex">
            <a href="#story" className="text-sm text-muted-foreground transition-colors hover:text-foreground">About</a>
            <a href="#intro" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Intro</a>
            <Button type="button" variant="ghost" onClick={() => setAccessOpen("login")} className="px-2 text-muted-foreground hover:text-foreground">Login</Button>
            <Button variant="brand" onClick={() => setAccessOpen("session")} className="rounded-full px-5">Start learning <ArrowRight /></Button>
          </div>
          <Button variant="outline" size="icon" className="rounded-full md:hidden" onClick={() => setMobileMenu((value) => !value)} aria-label="Open navigation">{mobileMenu ? <X /> : <Menu />}</Button>
        </nav>
        {mobileMenu ? <div className="border-t border-hairline bg-background px-5 py-4 md:hidden"><div className="grid gap-2"><Button variant="ghost" asChild><a href="#story" onClick={() => setMobileMenu(false)}>About</a></Button><Button variant="ghost" asChild><a href="#intro" onClick={() => setMobileMenu(false)}>Watch intro</a></Button><Button variant="outline" onClick={() => { setAccessOpen("login"); setMobileMenu(false); }}>Member login</Button><Button variant="brand" onClick={() => { setAccessOpen("session"); setMobileMenu(false); }}>Start learning</Button></div></div> : null}
      </header>

      <section className="relative min-h-[min(100svh,960px)] overflow-hidden pt-18 sm:pt-20">
        <div className="landing-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="mx-auto grid min-h-[min(calc(100svh-4.5rem),880px)] max-w-7xl items-center px-5 pb-14 pt-10 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:px-10 lg:py-16">
          <div className="relative z-10 animate-rise-in lg:py-16">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-brand-glow">Skyline Achievers · Learn • Earn • Lead</p>
            <h1 className="max-w-3xl font-display text-[clamp(3.35rem,6.5vw,6.8rem)] font-semibold uppercase leading-[0.86]">
              Your phone<br />can be more<br />than just<br /><span className="brand-text">a phone.</span>
            </h1>
            <p className="mt-7 max-w-md text-base leading-7 text-silver sm:text-lg">Learn practical skills. Build productive habits. Start with the technology already in your hand.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button variant="brand" size="xl" className="rounded-full sm:min-w-48" onClick={() => setAccessOpen("session")}>Start learning <ArrowRight /></Button>
              <Button variant="outline" size="xl" className="rounded-full bg-background/30 sm:min-w-44" asChild><a href="#intro"><Play />Watch intro</a></Button>
            </div>
          </div>
          <div className="relative -mx-5 mt-8 min-h-[420px] animate-rise-in sm:-mx-8 sm:min-h-[540px] lg:-mr-24 lg:ml-[-8rem] lg:mt-0 lg:min-h-[680px]">
            <div className="absolute inset-0 bg-brand/10 blur-[100px]" aria-hidden />
            <img src={phoneHero} alt="Premium smartphone displaying a digital learning interface" width={1920} height={1280} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-[62%_center] lg:object-center" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,transparent_30%,transparent_85%,var(--background)_100%)] opacity-80" aria-hidden />
            <div className="absolute bottom-5 left-5 glass-panel rounded-lg px-4 py-3 sm:left-12 lg:bottom-16 lg:left-36"><p className="text-[10px] uppercase tracking-[0.2em] text-brand-glow">Mobile-first learning</p><p className="mt-1 text-sm font-medium">Skills move with you.</p></div>
          </div>
        </div>
      </section>

      <section id="story" className="relative border-y border-hairline px-5 py-28 sm:px-8 lg:py-40">
        <div className="mx-auto max-w-7xl">
          <p className="mb-7 text-xs uppercase tracking-[0.22em] text-brand-glow">The starting point</p>
          <h2 className="max-w-5xl font-display text-5xl font-semibold uppercase leading-[0.92] sm:text-7xl lg:text-8xl">Your phone is a tool.<br /><span className="text-brand-glow">Learn how to use it.</span></h2>
          <div className="mt-16 grid items-end gap-8 lg:grid-cols-[1fr_0.55fr]">
            <div className="relative min-h-[440px] overflow-hidden rounded-lg sm:min-h-[620px]"><img src={deviceStory} alt="Phone and tablet showing a modern learning journey" width={1600} height={1200} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /></div>
            <p className="max-w-md pb-4 text-lg leading-8 text-muted-foreground">One device. An internet connection. The right skills. A practical place to begin learning and working more productively.</p>
          </div>
        </div>
      </section>

      <section id="intro" className="px-5 py-28 sm:px-8 lg:py-40">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-xs uppercase tracking-[0.22em] text-brand-glow">The introduction</p><h2 className="mt-4 font-display text-4xl font-semibold uppercase sm:text-6xl">{content.intro?.title ?? "What is Skyline Achievers?"}</h2></div>{content.intro?.description ? <p className="max-w-md text-base leading-7 text-muted-foreground">{content.intro.description}</p> : null}</div>
          <div className="glass-panel-strong overflow-hidden rounded-xl p-2 sm:p-4">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-surface">
              {content.intro?.video_signed_url ? (isEmbeddable(content.intro.video_signed_url) ? <iframe id="intro-video" src={toEmbedUrl(content.intro.video_signed_url)} title={content.intro.title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="h-full w-full border-0" /> : <video id="intro-video" src={content.intro.video_signed_url} poster={content.intro.thumbnail_url ?? undefined} controls playsInline controlsList="nodownload" className="h-full w-full object-cover" />) : <><img src={deviceStory} alt="Skyline Achievers introduction" width={1600} height={1200} loading="lazy" className="h-full w-full object-cover opacity-70" /><div className="absolute inset-0 flex items-center justify-center"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground text-background shadow-brand sm:h-24 sm:w-24"><Play className="ml-1 h-7 w-7 sm:h-9 sm:w-9" /></span></div></>}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-hairline bg-surface/40 px-5 py-28 sm:px-8 lg:py-40">
        <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <h2 className="font-display text-6xl font-semibold uppercase leading-[0.86] sm:text-8xl">Learn.<br /><span className="text-brand">Build.</span><br />Grow.</h2>
          <div className="lg:pl-20"><p className="max-w-xl text-xl leading-8 text-silver">Skyline Achievers turns everyday technology into a clear path for practical learning, focused action and personal growth.</p><div className="mt-10 h-px max-w-lg bg-hairline"><div className="h-px w-1/3 bg-brand-glow" /></div></div>
        </div>
      </section>

      <section className="px-5 py-28 sm:px-8 lg:py-40">
        <div className="mx-auto max-w-7xl"><p className="text-xs uppercase tracking-[0.22em] text-brand-glow">The learning journey</p><ol className="mt-16">
          {["Learn", "Build", "Grow", "Earn"].map((step, index) => <li key={step} className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 border-t border-hairline py-7 sm:py-10"><span className="text-xs text-muted-foreground">0{index + 1}</span><span className="font-display text-4xl font-medium uppercase transition-transform duration-500 group-hover:translate-x-3 sm:text-7xl">{step}</span><ArrowRight className="h-6 w-6 text-brand-glow sm:h-9 sm:w-9" /></li>)}
        </ol></div>
      </section>

      <section className="relative min-h-[80svh] overflow-hidden border-y border-hairline">
        <img src={phoneHero} alt="Smartphone illuminated by cinematic blue light" width={1920} height={1280} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[66%_center]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--background)_8%,color-mix(in_oklab,var(--background)_82%,transparent)_44%,transparent_78%)]" aria-hidden />
        <div className="relative mx-auto flex min-h-[80svh] max-w-7xl items-center px-5 py-24 sm:px-8 lg:px-10"><div className="max-w-xl"><p className="text-xs uppercase tracking-[0.22em] text-brand-glow">Your starting point</p><h2 className="mt-5 font-display text-5xl font-semibold uppercase leading-[0.9] sm:text-7xl">Your phone<br /><span className="text-brand-glow">+</span> your internet<br /><span className="text-brand-glow">+</span> the right skills.</h2><p className="mt-7 max-w-md text-lg leading-8 text-silver">A practical foundation for learning, productivity and part-time possibilities.</p></div></div>
      </section>

      {content.quotes.length > 0 ? <section className="overflow-hidden py-20" aria-label="Learning quotes"><div className="quote-drift flex w-max gap-5">{[...content.quotes, ...content.quotes].map((quote, index) => <blockquote key={`${quote.id}-${index}`} className="glass-panel w-[78vw] max-w-xl shrink-0 rounded-lg px-7 py-6 font-display text-xl text-silver sm:w-[520px] sm:text-2xl">“{quote.quote_text}”</blockquote>)}</div></section> : null}

      {content.reviews.length > 0 ? <section className="px-5 py-28 sm:px-8 lg:py-40"><div className="mx-auto max-w-7xl"><div className="mb-14 grid gap-5 lg:grid-cols-2"><p className="text-xs uppercase tracking-[0.22em] text-brand-glow">Real experiences</p><h2 className="font-display text-4xl font-semibold uppercase sm:text-6xl">What learners say.</h2></div><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-12">{content.reviews.map((review, index) => <article key={review.id} className={`glass-panel rounded-lg p-7 sm:p-9 ${index % 3 === 0 ? "lg:col-span-7" : "lg:col-span-5"}`}><p className="font-display text-xl leading-8 sm:text-2xl">“{review.review_text}”</p><div className="mt-8 flex items-center gap-4">{review.photo_url ? <img src={review.photo_url} alt={review.person_name} loading="lazy" className="h-12 w-12 rounded-full object-cover" /> : <div className="h-12 w-12 rounded-full border border-brand/30 bg-brand/10" />}<div><p className="font-medium">{review.person_name}</p>{review.designation ? <p className="text-sm text-muted-foreground">{review.designation}</p> : null}</div></div></article>)}</div></div></section> : null}

      <section className="relative overflow-hidden border-t border-hairline px-5 py-32 sm:px-8 lg:py-48"><div className="landing-grid pointer-events-none absolute inset-0" aria-hidden /><div className="relative mx-auto max-w-5xl"><p className="text-xs uppercase tracking-[0.22em] text-brand-glow">Begin where you are</p><h2 className="mt-6 font-display text-5xl font-semibold uppercase leading-[0.9] sm:text-7xl lg:text-8xl">Start with what<br />you already have.</h2><p className="mt-8 text-xl leading-9 text-silver">Your phone. Your internet.<br />Your willingness to learn.</p><Button variant="brand" size="xl" className="mt-10 rounded-full px-10" onClick={() => setAccessOpen("session")}>Start learning <ArrowRight /></Button></div></section>

      <footer className="border-t border-hairline px-5 py-10 sm:px-8"><div className="mx-auto grid max-w-7xl gap-7 sm:grid-cols-[1fr_auto] sm:items-center"><div><BrandLogo size="sm" /><p className="mt-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">{BRAND.tagline.replaceAll(".", " •")}</p></div><div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground"><a href="#story" className="hover:text-foreground">About</a><a href="#intro" className="hover:text-foreground">Intro</a><Button type="button" variant="ghost" onClick={() => setAccessOpen("login")} className="h-8 px-2 text-muted-foreground hover:text-foreground">Login</Button></div></div></footer>

      <Dialog open={accessOpen === "login"} onOpenChange={(open) => !open && setAccessOpen(null)}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-0"><DialogHeader className="sr-only"><DialogTitle>Member login</DialogTitle></DialogHeader><MemberLoginCard /></DialogContent></Dialog>
      <Dialog open={accessOpen === "session"} onOpenChange={(open) => !open && setAccessOpen(null)}><DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>Open Beginners Training</DialogTitle></DialogHeader><div className="mt-2"><div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"><KeyRound className="h-4 w-4 text-brand-glow" />Private session access</div><Label htmlFor="landing-session-code">Your session code</Label><Input id="landing-session-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void onSessionSubmit(); } }} placeholder="SKA-BEGIN-01" className="mt-2 h-13 rounded-lg tracking-[0.12em]" />{error ? <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">{error}</p> : null}<Button type="button" onClick={() => void onSessionSubmit()} variant="brand" size="xl" className="mt-5 w-full rounded-full" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}{pending ? "Opening session" : "Open training session"}</Button><p className="mt-5 flex gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Your code opens only the session selected for you.</p></div></DialogContent></Dialog>
      <WhatsappJoinCard variant="chip" />
    </main>
  );
}

function isEmbeddable(url: string) { return /youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com|facebook\.com|fb\.watch/.test(url); }
function toEmbedUrl(url: string) {
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/); if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/); if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  if (/facebook\.com|fb\.watch/.test(url)) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`;
  return url;
}