import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, Award, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock, Crown,
  FileText, GraduationCap, PlayCircle, RotateCcw, Star, Ticket, Users, Wallet, Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { GenealogyTree } from "@/components/team/GenealogyTree";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMemberSession } from "@/lib/member.functions";
import { useMemberGuard } from "@/components/member/MemberShell";
import ceo from "@/assets/aq-malik-ceo.jpg.asset.json";
import { Menu, Shield, Home, Lock, TreePine } from "lucide-react";
import {
  buildDemoTree, DEMO_TRAINEE, demoMentorship, demoPreferred, INITIAL_SIM, SESSION_TITLES, STEPS,
  type SimState,
} from "@/lib/trainer-demo";

export const Route = createFileRoute("/founder")({
  head: () => ({
    meta: [
      { title: "Founder & CEO Dashboard — A.Q Malik" },
      { name: "description", content: "Official Founder & CEO dashboard of Skyline Achievers." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Founder & CEO Dashboard — A.Q Malik" },
      { property: "og:description", content: "A.Q Malik, Founder & CEO — every Skyline Achievers dashboard in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrainerPage,
});

const KEY = "skyline-founder-training:760000010005";
type Hist = { list: SimState[]; at: number };
const VIEW_FOR_STEP = ["fbo", "beginner", "beginner", "fbo", "fbo", "mentorship", "mentorship"];

function TrainerPage() {
  const ready = useMemberGuard();
  const check = useServerFn(getMemberSession);
  const status = useQuery({ queryKey: ["founder-member-session"], queryFn: () => check(), enabled: ready, retry: false });
  const [hist, setHist] = useState<Hist>({ list: [INITIAL_SIM], at: 0 });
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("fbo");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) { const saved = JSON.parse(raw) as Hist; if (Array.isArray(saved.list) && saved.list.length && saved.at >= 0 && saved.at < saved.list.length) setHist(saved); } } catch { /* fresh */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(hist)); }, [hist, loaded]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const [menu, setMenu] = useState(false);

  const s = hist.list[hist.at]!;
  const push = (patch: Partial<SimState>, goView?: string) => {
    setHist((h) => ({ list: [...h.list.slice(0, h.at + 1), { ...h.list[h.at]!, ...patch }], at: h.at + 1 }));
    if (goView) setView(goView);
  };
  const move = (d: number) => setHist((h) => {
    const at = Math.max(0, Math.min(h.list.length - 1, h.at + d));
    setView(VIEW_FOR_STEP[h.list[at]!.step - 1]!);
    return { ...h, at };
  });
  const jump = (step: number) => setHist((h) => {
    const at = h.list.findIndex((x) => x.step === step);
    if (at < 0) return h;
    setView(VIEW_FOR_STEP[step - 1]!);
    return { ...h, at };
  });
  const reset = () => { setHist({ list: [INITIAL_SIM], at: 0 }); setView("fbo"); };

  // 10-second automatic payment approval
  const left = s.pendingSince ? Math.max(0, 10 - Math.floor((now - s.pendingSince) / 1000)) : 0;
  useEffect(() => {
    if (!s.pendingSince || left > 0) return;
    if (s.pm === "pending") push({ pm: "approved", pendingSince: null });
    else if (s.cc === "pending") push({ cc: "approved", pendingSince: null, step: 7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, s.pendingSince]);

  const tree = useMemo(buildDemoTree, []);
  const mentorship = useMemo(demoMentorship, []);
  const preferred = useMemo(demoPreferred, []);

  if (!ready || status.isPending) return <div className="flex min-h-screen items-center justify-center"><SkylineLoader variant="page" /></div>;
  if (status.data?.member?.memberId !== "760000010005" || status.data.reason !== "ok") return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-foreground"><p>Founder Training belongs to the A.Q Malik account.</p><Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button></main>;
  const passed = s.interviewScore != null && s.interviewScore >= 60;
  const sections: { v: string; label: string; icon: typeof Star; show: boolean }[] = [
    { v: "fbo", label: "FBO Dashboard", icon: Crown, show: true },
    { v: "beginner", label: "Beginners Training Dashboard", icon: GraduationCap, show: s.seatReserved },
    { v: "mentorship", label: "Personal Mentorship Dashboard", icon: Wallet, show: passed },
    { v: "tree", label: "Team Tree", icon: TreePine, show: true },
    { v: "preferred", label: "Preferred Customers", icon: Users, show: true },
  ];

  const reached = new Set(hist.list.map((x) => x.step));
  const currentSession = Math.min(s.approved + 1, 7);

  return (
    <main className="cinematic-shell relative min-h-screen bg-background pb-16 text-foreground">
      {menu && (
        <div className="fixed inset-0 z-50" onClick={() => setMenu(false)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <aside onClick={(e) => e.stopPropagation()} className="glass-panel-strong metal-edge absolute inset-y-0 left-0 flex w-[82vw] max-w-xs flex-col gap-1.5 overflow-y-auto rounded-r-3xl p-5">
            <div className="mb-3 flex items-center gap-3">
              <img src={ceo.url} alt="A.Q Malik" className="h-12 w-12 rounded-full border-2 border-cyan object-cover" />
              <div><p className="font-display font-bold">A.Q Malik</p><p className="text-[10px] uppercase tracking-widest text-cyan">Founder & CEO</p></div>
            </div>
            <Button asChild variant="outline" className="justify-start"><Link to="/dashboard"><Home className="h-4 w-4" />Founder Dashboard</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link to="/admin"><Shield className="h-4 w-4" />Admin Panel</Link></Button>
            {sections.map((x) => x.show ? (
              <Button key={x.v} type="button" variant="ghost" onClick={() => { setView(x.v); setMenu(false); }} className={`w-full justify-start text-left ${view === x.v ? "bg-primary/25" : ""}`}><x.icon className="h-4 w-4 text-brand-glow" />{x.label}</Button>
            ) : (
              <div key={x.v} className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground/50"><Lock className="h-4 w-4" />{x.label}</div>
            ))}
            <div className="mt-auto space-y-1.5 border-t border-hairline pt-3">
              <Button type="button" variant="destructive" onClick={() => { reset(); setMenu(false); }} className="w-full justify-start"><RotateCcw className="h-4 w-4" />Reset training journey</Button>
            </div>
          </aside>
        </div>
      )}
      <div className="sticky top-0 z-40 border-b border-cyan/25 bg-background/95 shadow-glass backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMenu(true)} aria-label="Open menu"><Menu /></Button>
            <p className="min-w-0 flex-1 truncate font-display text-sm font-bold">Founder Training · {sections.find((x) => x.v === view)?.label}</p>
            <Button size="icon" variant="outline" onClick={() => move(-1)} disabled={hist.at === 0} aria-label="Previous step"><ChevronLeft /></Button>
            <Button size="icon" variant="outline" onClick={() => move(1)} disabled={hist.at >= hist.list.length - 1} aria-label="Next step"><ChevronRight /></Button>
            <Button size="icon" variant="destructive" onClick={reset} aria-label="Reset"><RotateCcw /></Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Step {s.step} of 7: <span className="font-semibold text-foreground">{STEPS[s.step - 1]}</span></p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-3 py-4">
        <div className="relative mb-4 overflow-hidden rounded-3xl border border-cyan/40 bg-gradient-to-br from-primary/30 via-background to-background p-5 shadow-brand">
          <div className="flex items-center gap-4">
            <img src={ceo.url} alt="A.Q Malik, Founder & CEO" className="h-20 w-20 rounded-full border-2 border-cyan object-cover shadow-brand" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-cyan">Founder & CEO</p>
              <h1 className="font-display text-2xl font-bold">A.Q Malik</h1>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><BrandLogo size="sm" withWordmark={false} />Skyline Achievers Official · ID 760000010005</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[["Network", String(tree.length)], ["Generations", "7"], ["Mentorship", String(mentorship.length)]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-muted/50 p-2"><p className="font-display text-lg font-bold">{v}</p><p className="text-[10px] uppercase text-muted-foreground">{k}</p></div>
            ))}
          </div>
        </div>

        <Tabs value={view} onValueChange={setView}>

          {/* FBO */}
          <TabsContent value="fbo" className="space-y-4">
            <Card title="Seat Reservation" icon={Ticket}>
              {!s.seatReserved ? (
                <>
                  <Info rows={[["Name", DEMO_TRAINEE.name], ["Age", String(DEMO_TRAINEE.age)], ["Phone", DEMO_TRAINEE.phone], ["City", DEMO_TRAINEE.city]]} />
                  <Button variant="brand" className="mt-3 w-full" onClick={() => push({ seatReserved: true, step: 2 }, "fbo")}>Reserve Seat</Button>
                </>
              ) : (
                <div className="rounded-2xl border border-cyan/40 bg-gradient-to-br from-primary/25 to-background p-4 text-center">
                  <BrandLogo size="sm" withWordmark={false} />
                  <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-cyan">Seat Confirmed</p>
                  <p className="font-display text-xl font-bold">{DEMO_TRAINEE.name}</p>
                  <p className="text-xs text-muted-foreground">Beginners Training • Code {DEMO_TRAINEE.code}</p>
                  <p className="mt-2 text-xs">Session 1 • Today 8:00 PM (PKT)</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setView("beginner")}>Open Beginners Dashboard</Button>
                </div>
              )}
            </Card>

            <Card title="Session Reviews" icon={Star}>
              {s.reviewSubmitted ? (
                <div className="space-y-2">
                  <p className="text-sm">{DEMO_TRAINEE.name} submitted a review for <b>Session {currentSession}</b>.</p>
                  <p className="rounded-lg bg-muted p-2 text-xs italic">"Session bohat acha tha, company aur online earning ka concept clear ho gaya."</p>
                  <Button variant="brand" onClick={() => push({ reviewSubmitted: false, approved: s.approved + 1, sessionOpen: false, watched: false, step: 3 }, "beginner")}><CheckCircle2 />Approve Review</Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{s.approved}/7 sessions approved. {s.approved >= 7 ? "All sessions complete." : "Waiting for the next review."}</p>
              )}
              {s.approved >= 7 && (
                <ul className="mt-2 grid gap-1 text-xs">
                  {SESSION_TITLES.map((t, i) => <li key={t} className="flex justify-between rounded bg-muted/60 px-2 py-1"><span>{i + 1}. {t}</span><span className="text-cyan">Approved • {9 - (i % 2)}/10</span></li>)}
                </ul>
              )}
            </Card>

            {s.approved >= 7 && (
              <Card title="Training Report & Final Interview" icon={FileText}>
                {!s.reportReady ? (
                  <Button variant="brand" onClick={() => push({ reportReady: true, step: 4 })}>Generate Report</Button>
                ) : (
                  <div className="space-y-3">
                    <Info rows={[["Trainee", DEMO_TRAINEE.name], ["Sessions", "7 / 7 approved"], ["Average marks", "86%"], ["Status", s.interviewScore != null ? (s.interviewScore >= 60 ? "Interview passed" : "Interview not passed") : "Ready for interview"]]} />
                    {s.interviewPrepared && !s.interviewTime && (
                      <div className="rounded-xl border border-cyan/40 bg-primary/10 p-3 text-sm">
                        <p className="font-semibold">🔔 {DEMO_TRAINEE.name} has watched the final interview video and is ready.</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {["Today 9:00 PM", "Tomorrow 7:00 PM", "Tomorrow 9:00 PM"].map((t) => (
                            <Button key={t} size="sm" variant="outline" onClick={() => push({ interviewTime: t, step: 5 })}><CalendarClock />{t}</Button>
                          ))}
                        </div>
                      </div>
                    )}
                    {!s.interviewPrepared && <p className="text-xs text-muted-foreground">Waiting for the trainee to watch the final interview video.</p>}
                    {s.interviewTime && s.interviewScore == null && (
                      <div className="space-y-2">
                        <p className="text-sm">Interview at <b>{s.interviewTime}</b>. Give marks:</p>
                        <div className="flex flex-wrap gap-2">
                          {[95, 80, 65, 40].map((m) => <Button key={m} size="sm" variant={m >= 60 ? "brand" : "outline"} onClick={() => push({ interviewScore: m, step: m >= 60 ? 6 : 5 }, m >= 60 ? "beginner" : undefined)}>{m}/100</Button>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}
          </TabsContent>

          {/* Beginner */}
          <TabsContent value="beginner" className="space-y-4">
            {!s.seatReserved ? (
              <Card title="Beginners Training" icon={GraduationCap}><p className="text-sm text-muted-foreground">Reserve a seat from the FBO Dashboard first.</p></Card>
            ) : s.interviewScore != null && s.interviewScore >= 60 ? (
              <Card title="Congratulations!" icon={Award}>
                <p className="text-sm">🎉 {DEMO_TRAINEE.name}, you passed the final interview with {s.interviewScore}/100. Your Personal Mentorship is now open.</p>
                <Button variant="brand" className="mt-3" onClick={() => setView("mentorship")}>Open Personal Mentorship</Button>
              </Card>
            ) : s.approved >= 7 ? (
              <Card title="Final Interview Preparation" icon={PlayCircle}>
                <div className="flex aspect-video items-center justify-center rounded-xl bg-muted"><PlayCircle className="h-12 w-12 text-cyan" /></div>
                {s.interviewScore != null && <p className="mt-2 text-sm text-destructive">Interview score {s.interviewScore}/100 — not passed. FBO will schedule again.</p>}
                {s.interviewTime ? <p className="mt-3 text-sm">Your interview is at <b>{s.interviewTime}</b>.</p> : (
                  <Button variant="brand" className="mt-3 w-full" disabled={s.interviewPrepared} onClick={() => push({ interviewPrepared: true, step: 5 }, "fbo")}>{s.interviewPrepared ? "Waiting for FBO to set the time" : "I am prepared"}</Button>
                )}
              </Card>
            ) : (
              <Card title={`Session ${currentSession}: ${SESSION_TITLES[currentSession - 1]}`} icon={GraduationCap}>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={s.sessionOpen} onClick={() => push({ sessionOpen: true, step: Math.max(s.step, 2) })}><Clock />Change time — open now</Button>
                  <Button size="sm" variant="outline" onClick={() => push({ approved: 7, sessionOpen: false, watched: false, reviewSubmitted: false, step: 4 }, "fbo")}><Zap />Training complete</Button>
                </div>
                {!s.sessionOpen ? (
                  <p className="rounded-xl bg-muted p-3 text-sm">⏳ Opens at 8:00 PM (PKT). It stays active for 3 hours after opening.</p>
                ) : s.reviewSubmitted ? (
                  <p className="rounded-xl bg-muted p-3 text-sm">✅ Review submitted. Waiting for FBO approval.</p>
                ) : (
                  <>
                    <div className="flex aspect-video items-center justify-center rounded-xl bg-muted">
                      {s.watched ? <CheckCircle2 className="h-12 w-12 text-cyan" /> : <PlayCircle className="h-12 w-12 text-cyan" />}
                    </div>
                    {!s.watched ? <Button className="mt-3 w-full" variant="brand" onClick={() => push({ watched: true })}>Watch session (forward skip locked)</Button> : (
                      <Button className="mt-3 w-full" variant="brand" onClick={() => push({ reviewSubmitted: true, step: 3 }, "fbo")}>Submit review</Button>
                    )}
                  </>
                )}
                <p className="mt-3 text-xs text-muted-foreground">{s.approved}/7 sessions approved</p>
              </Card>
            )}
          </TabsContent>

          {/* Mentorship */}
          <TabsContent value="mentorship" className="space-y-4">
            {!(s.interviewScore != null && s.interviewScore >= 60) ? (
              <Card title="Personal Mentorship" icon={Wallet}><p className="text-sm text-muted-foreground">Opens after the trainee passes the final interview.</p></Card>
            ) : (
              <>
                <PayCard title="Personal Mentorship Fee" amount="Rs 5,000" state={s.pm} left={left}
                  onPay={() => push({ pm: "pending", pendingSince: Date.now() })} policy />
                {s.pm === "approved" && (
                  <PayCard title="2CC Investment" amount="2CC order" state={s.cc} left={left}
                    onPay={() => push({ cc: "pending", pendingSince: Date.now() })} />
                )}
                {s.cc === "approved" && (
                  <Card title="Assistant Supervisor unlocked" icon={Crown}>
                    <p className="text-sm">👑 {DEMO_TRAINEE.name} is now an <b>Assistant Supervisor</b> with the full FBO dashboard: Daily Report, Team Tree, Seat Reservation, Leads and Growth Executive.</p>
                  </Card>
                )}
              </>
            )}
            <Card title="Mentorship members" icon={Users}>
              <ul className="space-y-1.5 text-sm">
                {mentorship.map((m) => <li key={m.id} className="flex justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2"><span>{m.name}</span><span className="text-xs text-muted-foreground">{m.stage}</span></li>)}
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="tree">
            <GenealogyTree root={{ id: "root", memberId: "760000010005", fullName: "A.Q Malik · Skyline Achievers" }} people={tree} emptyHint="No training team." />
          </TabsContent>

          <TabsContent value="preferred">
            <Card title="Preferred Customers" icon={GraduationCap}>
              <ul className="space-y-1.5 text-sm">
                <li className="flex justify-between rounded-lg border border-cyan/50 bg-primary/15 px-3 py-2 font-semibold"><span>⭐ {DEMO_TRAINEE.name} (Beginners Training)</span><span className="text-xs">{s.approved}/7</span></li>
                {preferred.map((p) => <li key={p.id} className="flex justify-between rounded-lg bg-muted/60 px-3 py-2"><span>{p.name}</span><span className="text-xs text-muted-foreground">{Math.min(p.sessions, 7)}/7</span></li>)}
              </ul>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Star; children: React.ReactNode }) {
  return (
    <section className="raised-panel metal-edge rounded-2xl p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display font-semibold"><Icon className="h-4 w-4 text-cyan" />{title}</h2>
      {children}
    </section>
  );
}

function Info({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm">
      {rows.map(([k, v]) => <div key={k} className="rounded-lg bg-muted/60 px-3 py-2"><dt className="text-[10px] uppercase text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
    </dl>
  );
}

function PayCard({ title, amount, state, left, onPay, policy }: { title: string; amount: string; state: "none" | "pending" | "approved"; left: number; onPay: () => void; policy?: boolean }) {
  const [agree, setAgree] = useState(!policy);
  return (
    <Card title={title} icon={Wallet}>
      <p className="font-display text-2xl font-bold">{amount}</p>
      {state === "none" && (
        <>
          {policy && (
            <label className="mt-3 flex items-start gap-2 text-xs">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
              I have read and agree to the Mentorship Payment & Refund Policy.
            </label>
          )}
          <Button variant="brand" className="mt-3 w-full" disabled={!agree} onClick={onPay}>Submit payment</Button>
        </>
      )}
      {state === "pending" && <p className="mt-3 rounded-xl bg-muted p-3 text-sm">⏱️ Verifying payment… auto-approves in <b>{left}s</b></p>}
      {state === "approved" && <p className="mt-3 flex items-center gap-2 text-sm text-cyan"><CheckCircle2 className="h-4 w-4" />Payment approved</p>}
    </Card>
  );
}

