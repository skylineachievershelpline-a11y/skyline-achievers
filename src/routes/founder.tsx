import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Award,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  PlayCircle,
  Star,
  Ticket,
  UserPlus,
  Wallet,
  Zap,
  Menu,
  Home,
  Clapperboard,
  Search,
  ShieldCheck,
  Crown,
  MessageCircle,
  Bot,
  X,
  Bell,
} from "lucide-react";
import { useEffect, useState } from "react";

import { FounderTrainingBar } from "@/components/founder/FounderTrainingBar";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { MemberShell, useMemberGuard } from "@/components/member/MemberShell";
import { StoryLogo } from "@/components/story/StoryLogo";
import { WelcomeCard, type Credentials } from "@/components/team/WelcomeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMemberSession } from "@/lib/member.functions";
import { DEMO_TRAINEE, SESSION_TITLES, useFounderTraining } from "@/lib/trainer-demo";

type FounderView = "seat" | "beginner" | "review" | "mentorship";

export const Route = createFileRoute("/founder")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: (["seat", "beginner", "review", "mentorship"] as const).includes(search["view"] as FounderView)
      ? (search["view"] as FounderView)
      : "seat",
  }),
  head: () => ({
    meta: [
      { title: "Founder Training — Skyline Achievers" },
      { name: "description", content: "A.Q Malik's private Skyline Achievers training journey." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Founder Training — Skyline Achievers" },
      { property: "og:description", content: "Private founder training dashboards for Skyline Achievers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FounderTrainingPage,
});

function FounderTrainingPage() {
  const { view } = Route.useSearch();
  const ready = useMemberGuard();
  const load = useServerFn(getMemberSession);
  const session = useQuery({ queryKey: ["founder-member-session"], queryFn: () => load(), enabled: ready, retry: false });

  if (!ready || session.isPending) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan" /></div>;
  if (session.data?.reason !== "ok" || session.data.member?.memberId !== "760000010005") {
    return <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"><p>This training area belongs to the A.Q Malik account.</p><Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button></main>;
  }

  if (view === "beginner") {
    return (
      <FounderBeginnerShell>
        <FounderTrainingBar />
        <BeginnerDashboard />
      </FounderBeginnerShell>
    );
  }

  return (
    <MemberShell title={viewTitle(view)} subtitle="Founder Training · Skyline Achievers" executive>
      <FounderTrainingBar />
      {view === "seat" ? <TrainingSeat /> : null}
      {view === "review" ? <ReviewDashboard /> : null}
      {view === "mentorship" ? <MentorshipDashboard /> : null}
    </MemberShell>
  );
}

function FounderBeginnerShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const training = useFounderTraining();
  const menu = [
    { label: "Home", icon: Home },
    { label: "Training", icon: GraduationCap },
    { label: "Reels", icon: Clapperboard },
    { label: "Search", icon: Search },
    { label: "Profile settings", icon: ShieldCheck },
  ];

  return (
    <div className="motion-scope cinematic-shell relative min-h-screen bg-background pb-10 text-foreground">
      <header className="cinematic-nav sticky top-0 z-30 border-b border-metal/20 bg-background/90 shadow-glass backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button type="button" variant="outline" size="icon" onClick={() => setMenuOpen(true)} aria-label="Open Beginners menu"><Menu /></Button>
          <StoryLogo size={34} />
          <div className="min-w-0 flex-1"><p className="truncate font-display text-sm font-semibold">Skyline Achievers</p><p className="truncate text-[11px] text-muted-foreground">Beginners Training</p></div>
          <Button type="button" variant="outline" size="icon" aria-label="Announcements"><Bell /></Button>
        </div>
      </header>

      {menuOpen ? <div className="fixed inset-0 z-[200]"><button type="button" className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-label="Close menu" /><aside className="glass-panel-strong metal-edge absolute inset-y-0 left-0 flex w-[84vw] max-w-xs flex-col rounded-r-3xl p-5">
        <div className="flex items-center justify-between gap-2"><BrandLogo size="sm" /><Button type="button" variant="outline" size="icon" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></Button></div>
        <div className="mt-5 rounded-2xl border border-cyan/20 bg-primary/10 p-3"><p className="truncate font-display text-sm font-semibold">Skyline Achievers</p><p className="mt-0.5 text-[10px] uppercase text-muted-foreground">Beginners Training</p></div>
        <nav className="mt-5 flex-1 space-y-1.5 overflow-y-auto">
          {menu.map((item, index) => <Button key={item.label} type="button" variant="ghost" onClick={() => setMenuOpen(false)} className={index === 0 ? "h-11 w-full justify-start border border-cyan/30 bg-primary/15" : "h-11 w-full justify-start text-muted-foreground"}><item.icon className="h-4 w-4 text-brand-glow" />{item.label}</Button>)}
          <Button asChild variant="ghost" className="h-11 w-full justify-start text-muted-foreground"><Link to="/courses"><Crown className="h-4 w-4 text-brand-glow" />Premium Courses</Link></Button>
          <Button asChild variant="ghost" className="h-11 w-full justify-start text-muted-foreground"><Link to="/chat"><MessageCircle className="h-4 w-4 text-brand-glow" />Chat with Upline</Link></Button>
          <Button asChild variant="ghost" className="h-11 w-full justify-start text-muted-foreground"><Link to="/ai"><Bot className="h-4 w-4 text-brand-glow" />Skyline Achievers AI</Link></Button>
          {training.state.reviewSubmitted ? <Button asChild variant="ghost" className="h-11 w-full justify-start text-muted-foreground"><Link to="/founder" search={{ view: "review" }}><Star className="h-4 w-4 text-brand-glow" />Review Status</Link></Button> : null}
          <Button asChild variant="outline" className="mt-3 h-11 w-full justify-start"><Link to="/dashboard"><Home className="h-4 w-4" />Back to FBO Dashboard</Link></Button>
        </nav>
      </aside></div> : null}

      <main className="relative mx-auto max-w-4xl px-4 py-5">{children}</main>
    </div>
  );
}

function viewTitle(view: FounderView) {
  if (view === "beginner") return "Beginners Training Dashboard";
  if (view === "review") return "Training Reviews";
  if (view === "mentorship") return "Personal Mentorship Dashboard";
  return "Seat Reservation";
}

function TrainingSeat() {
  const training = useFounderTraining();
  const [form, setForm] = useState({ fullName: DEMO_TRAINEE.name, phone: DEMO_TRAINEE.phone, age: String(DEMO_TRAINEE.age) });
  const [card, setCard] = useState<Credentials | null>(null);

  function reserve() {
    const credentials: Credentials = {
      traineeCode: DEMO_TRAINEE.phone,
      password: "00000000",
      fullName: DEMO_TRAINEE.name,
      uplineName: "A.Q Malik",
      uplineCode: "760000010005",
      uplineAvatarUrl: null,
    };
    setCard(credentials);
    training.update({ seatReserved: true, step: 2 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-5xl">
      {card || training.state.seatReserved ? (
        <div className="mb-6">
          <WelcomeCard credentials={card ?? { traineeCode: DEMO_TRAINEE.phone, password: "00000000", fullName: DEMO_TRAINEE.name, uplineName: "A.Q Malik", uplineCode: "760000010005", uplineAvatarUrl: null }} />
          <Button asChild variant="brand" size="xl" className="mt-4 w-full"><Link to="/founder" search={{ view: "beginner" }}><GraduationCap />Open Beginners Training Dashboard</Link></Button>
        </div>
      ) : (
        <form className="raised-panel metal-edge mx-auto max-w-2xl rounded-3xl p-6" onSubmit={(event) => { event.preventDefault(); reserve(); }}>
          <div className="flex items-center gap-2"><Ticket className="h-5 w-5 text-cyan" /><h1 className="font-display text-xl font-semibold">Reserve a seat</h1></div>
          <p className="mt-1 text-xs text-muted-foreground">The official Skyline Achievers training person is already filled in.</p>
          <div className="mt-5 space-y-4">
            <div className="space-y-2"><Label htmlFor="founder-seat-name">Full name</Label><Input id="founder-seat-name" value={form.fullName} readOnly /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="founder-seat-phone">Phone number</Label><Input id="founder-seat-phone" value={form.phone} readOnly /></div>
              <div className="space-y-2"><Label htmlFor="founder-seat-age">Age</Label><Input id="founder-seat-age" value={form.age} readOnly /></div>
            </div>
          </div>
          <Button type="submit" variant="brand" size="xl" className="mt-6 w-full"><UserPlus />Create Skyline ID</Button>
        </form>
      )}
    </div>
  );
}

function BeginnerDashboard() {
  const training = useFounderTraining();
  const state = training.state;

  if (!state.seatReserved) return <Locked title="Reserve the Skyline Achievers seat first" to="seat" />;
  const sessionNumber = Math.min(state.approved + 1, 7);
  const passed = state.interviewScore != null && state.interviewScore >= 60;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="raised-panel relative overflow-hidden rounded-[30px] p-6">
        <span className="connector-line absolute inset-x-0 top-0 h-1" />
        <div className="flex items-center gap-4">
          <div className="metal-edge flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 font-display text-2xl font-semibold text-cyan">S</div>
          <div><h1 className="font-display text-xl font-semibold">Skyline Achievers</h1><p className="text-[11px] uppercase text-muted-foreground">{DEMO_TRAINEE.code} · Beginners Training</p><p className="mt-1 text-xs text-muted-foreground">Trainer: A.Q Malik (760000010005)</p></div>
        </div>
      </section>

      {passed ? (
        <section className="raised-panel metal-edge rounded-[28px] p-6 text-center"><Award className="mx-auto h-9 w-9 text-cyan" /><h2 className="mt-3 font-display text-xl font-semibold">Congratulations!</h2><p className="mt-2 text-sm text-muted-foreground">Final interview passed with {state.interviewScore}/100. Personal Mentorship is now open.</p><Button asChild variant="brand" className="mt-5"><Link to="/founder" search={{ view: "mentorship" }}><Wallet />Open Personal Mentorship</Link></Button></section>
      ) : state.approved >= 7 ? (
        <section className="raised-panel overflow-hidden rounded-[28px]">
          <div className="flex aspect-video items-center justify-center bg-media"><PlayCircle className="h-14 w-14 text-cyan" /></div>
          <div className="p-5"><p className="text-[10px] uppercase text-cyan">Final Interview Guide</p><h2 className="mt-1 font-display text-lg font-semibold">Prepare for your final interview</h2>
            {!state.interviewPrepared ? <Button variant="brand" size="xl" className="mt-4 w-full" onClick={() => training.update({ interviewPrepared: true, step: 5 })}><CheckCircle2 />I have prepared</Button> : state.interviewTime ? <p className="mt-4 rounded-2xl border border-cyan/30 bg-primary/10 p-4 text-sm">Interview time: <b>{state.interviewTime}</b></p> : <p className="mt-4 rounded-2xl bg-muted p-4 text-sm">Waiting for FBO to set the interview time.</p>}
          </div>
        </section>
      ) : (
        <section className="raised-panel metal-edge overflow-hidden rounded-[30px]">
          <div className="border-b border-hairline px-5 py-4"><p className="text-[10px] uppercase text-cyan">Your training journey</p><h2 className="mt-1 font-display text-xl font-semibold">Session {sessionNumber} — {SESSION_TITLES[sessionNumber - 1]}</h2></div>
          <div className="flex aspect-video items-center justify-center bg-media">{state.watched ? <CheckCircle2 className="h-14 w-14 text-cyan" /> : <PlayCircle className="h-14 w-14 text-cyan" />}</div>
          <div className="p-5">
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => training.update({ sessionOpen: true, step: 2 })} disabled={state.sessionOpen}><Clock />Change time — open now</Button><Button variant="outline" onClick={() => training.update({ approved: 7, sessionOpen: false, watched: false, reviewSubmitted: false, reportReady: true, step: 4 })}><Zap />Complete all 7 sessions</Button></div>
            {!state.sessionOpen ? <p className="mt-4 rounded-2xl bg-muted p-4 text-sm">Opens at the scheduled PKT time and stays active for 3 hours.</p> : state.reviewSubmitted ? <p className="mt-4 rounded-2xl border border-cyan/30 bg-primary/10 p-4 text-sm">Review submitted — waiting for FBO approval.</p> : !state.watched ? <Button variant="brand" size="xl" className="mt-4 w-full" onClick={() => training.update({ watched: true })}><PlayCircle />Watch session</Button> : <Button variant="brand" size="xl" className="mt-4 w-full" onClick={() => training.update({ reviewSubmitted: true, step: 3 })}><Star />Submit review</Button>}
            <p className="mt-3 text-xs text-muted-foreground">{state.approved}/7 sessions approved</p>
          </div>
        </section>
      )}
    </div>
  );
}

function ReviewDashboard() {
  const training = useFounderTraining();
  const state = training.state;
  if (!state.seatReserved) return <Locked title="Reserve the Skyline Achievers seat first" to="seat" />;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="raised-panel metal-edge rounded-3xl p-6">
        <div className="flex items-center gap-2"><Star className="h-5 w-5 text-cyan" /><h1 className="font-display text-xl font-semibold">Session Reviews</h1></div>
        {state.reviewSubmitted ? <div className="mt-4"><p className="text-sm">Skyline Achievers submitted Session {Math.min(state.approved + 1, 7)} review.</p><p className="mt-2 rounded-xl bg-muted p-3 text-sm italic">“Session bohat acha tha, company aur online earning ka concept clear ho gaya.”</p><Button variant="brand" className="mt-4" onClick={() => training.update({ reviewSubmitted: false, approved: Math.min(7, state.approved + 1), sessionOpen: false, watched: false, step: state.approved + 1 >= 7 ? 4 : 3 })}><CheckCircle2 />Approve review</Button></div> : <p className="mt-4 text-sm text-muted-foreground">{state.approved}/7 sessions approved. Waiting for the next review.</p>}
        {state.approved >= 7 ? <ul className="mt-4 grid gap-2">{SESSION_TITLES.map((title, index) => <li key={title} className="flex justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2 text-xs"><span>{index + 1}. {title}</span><span className="shrink-0 text-cyan">Approved · {index % 2 ? 8 : 9}/10</span></li>)}</ul> : null}
      </section>

      {state.approved >= 7 ? <section className="raised-panel metal-edge rounded-3xl p-6"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-cyan" /><h2 className="font-display text-lg font-semibold">Training Report & Final Interview</h2></div>
        {!state.reportReady ? <Button variant="brand" className="mt-4" onClick={() => training.update({ reportReady: true, step: 4 })}>Generate report</Button> : <div className="mt-4 grid gap-3"><Info label="Trainee" value="Skyline Achievers" /><Info label="Sessions" value="7 / 7 approved" /><Info label="Average marks" value="86%" /></div>}
        {state.reportReady && state.interviewPrepared && !state.interviewTime ? <div className="mt-4"><p className="text-sm font-semibold">Skyline Achievers is ready. Select interview time:</p><div className="mt-2 flex flex-wrap gap-2">{["Today 9:00 PM", "Tomorrow 7:00 PM", "Tomorrow 9:00 PM"].map((time) => <Button key={time} variant="outline" size="sm" onClick={() => training.update({ interviewTime: time, step: 5 })}><CalendarClock />{time}</Button>)}</div></div> : null}
        {state.interviewTime && state.interviewScore == null ? <div className="mt-4"><p className="text-sm">Interview at <b>{state.interviewTime}</b>. Give marks:</p><div className="mt-2 flex flex-wrap gap-2">{[95, 80, 65, 40].map((marks) => <Button key={marks} size="sm" variant={marks >= 60 ? "brand" : "outline"} onClick={() => training.update({ interviewScore: marks, step: marks >= 60 ? 6 : 5 })}>{marks}/100</Button>)}</div></div> : null}
      </section> : null}
    </div>
  );
}

function MentorshipDashboard() {
  const training = useFounderTraining();
  const state = training.state;
  const [agree, setAgree] = useState(false);
  const [seconds, setSeconds] = useState(10);
  const passed = state.interviewScore != null && state.interviewScore >= 60;

  useEffect(() => {
    if (!state.pendingSince || (state.pm !== "pending" && state.cc !== "pending")) return;
    const tick = () => {
      const left = Math.max(0, 10 - Math.floor((Date.now() - (state.pendingSince ?? 0)) / 1000));
      setSeconds(left);
      if (left === 0) {
        if (state.pm === "pending") training.update({ pm: "approved", pendingSince: null });
        else training.update({ cc: "approved", pendingSince: null, step: 7 });
      }
    };
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [state.cc, state.pendingSince, state.pm, training.update]);

  if (!passed) return <Locked title="Personal Mentorship opens after the final interview is passed" to="beginner" />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="raised-panel relative overflow-hidden rounded-[30px] p-6"><span className="connector-line absolute inset-x-0 top-0 h-1" /><p className="text-[10px] uppercase text-cyan">Personal Mentorship</p><h1 className="mt-1 font-display text-2xl font-semibold">Skyline Achievers</h1><p className="mt-1 text-sm text-muted-foreground">Final interview passed · Mentorship dashboard active</p></section>
      <PaymentCard title="Personal Mentorship amount" amount="Rs 5,000" state={state.pm} seconds={seconds} agree={agree} onAgree={setAgree} policy onPay={() => training.update({ pm: "pending", pendingSince: Date.now(), step: 6 })} />
      {state.pm === "approved" ? <PaymentCard title="2CC amount" amount="2CC order" state={state.cc} seconds={seconds} agree onAgree={() => undefined} onPay={() => training.update({ cc: "pending", pendingSince: Date.now() })} /> : null}
      {state.cc === "approved" ? <section className="raised-panel metal-edge rounded-3xl p-6 text-center"><Award className="mx-auto h-10 w-10 text-cyan" /><h2 className="mt-3 font-display text-xl font-semibold">Assistant Supervisor unlocked</h2><p className="mt-2 text-sm text-muted-foreground">The complete Founder training journey is finished.</p></section> : null}
    </div>
  );
}

function PaymentCard({ title, amount, state, seconds, agree, onAgree, onPay, policy = false }: { title: string; amount: string; state: "none" | "pending" | "approved"; seconds: number; agree: boolean; onAgree: (value: boolean) => void; onPay: () => void; policy?: boolean }) {
  return <section className="raised-panel metal-edge rounded-3xl p-5"><div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-cyan" /><h2 className="font-display font-semibold">{title}</h2></div><p className="mt-4 font-display text-2xl font-bold">{amount}</p>
    {state === "none" ? <>{policy ? <label className="mt-4 flex items-start gap-3 rounded-2xl border border-hairline bg-surface-2 p-4 text-xs"><input type="checkbox" checked={agree} onChange={(event) => onAgree(event.target.checked)} className="mt-0.5" /><span>I have read and agree to the Mentorship Payment & Refund Policy.</span></label> : null}<Button variant="brand" size="xl" className="mt-4 w-full" disabled={!agree} onClick={onPay}>Submit payment</Button></> : null}
    {state === "pending" ? <p className="mt-4 rounded-2xl bg-muted p-4 text-sm">Verifying payment… auto-approves in <b>{seconds}s</b></p> : null}
    {state === "approved" ? <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-cyan"><CheckCircle2 className="h-4 w-4" />Payment approved</p> : null}
  </section>;
}

function Locked({ title, to }: { title: string; to: FounderView }) {
  return <section className="raised-panel metal-edge mx-auto max-w-lg rounded-3xl p-8 text-center"><GraduationCap className="mx-auto h-8 w-8 text-cyan" /><h1 className="mt-4 font-display text-lg font-semibold">{title}</h1><Button asChild variant="brand" className="mt-5"><Link to="/founder" search={{ view: to }}>Go to required step</Link></Button></section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted/60 px-4 py-3"><p className="text-[10px] uppercase text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>;
}