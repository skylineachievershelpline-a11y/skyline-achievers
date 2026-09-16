import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Copy,
  Crown,
  Link2,
  Loader2,
  Play,
  Plus,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/member/cards";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { WelcomeCard, type Credentials } from "@/components/team/WelcomeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import {
  createInviteLink,
  deleteInviteLink,
  deleteTrainee,
  getMyTeam,
  reserveSeat,
  setInviteActive,
  setTraineeStatus,
} from "@/lib/team.functions";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "My Team & Seat Reservation — Skyline Achievers" },
      {
        name: "description",
        content:
          "Reserve seats for new trainees, share your registration link and track weekly and monthly progress of everyone you registered.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "My Team & Seat Reservation — Skyline Achievers" },
      { property: "og:description", content: "Register new trainees and track their progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const ready = useMemberGuard();
  const queryClient = useQueryClient();
  const load = useServerFn(getMyTeam);
  const reserve = useServerFn(reserveSeat);
  const changeStatus = useServerFn(setTraineeStatus);
  const removePerson = useServerFn(deleteTrainee);
  const makeLink = useServerFn(createInviteLink);
  const toggleLink = useServerFn(setInviteActive);
  const dropLink = useServerFn(deleteInviteLink);

  const [form, setForm] = useState({ fullName: "", phone: "", age: "" });
  const [card, setCard] = useState<Credentials | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["my-team"],
    queryFn: () => load(),
    enabled: ready,
    retry: false,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["my-team"] });
  }

  const create = useMutation({
    mutationFn: () =>
      reserve({
        data: {
          fullName: form.fullName,
          phone: form.phone,
          age: form.age ? Number(form.age) : null,
        },
      } as never),
    onSuccess: (result: any) => {
      setCard(result.credentials as Credentials);
      setForm({ fullName: "", phone: "", age: "" });
      toast.success("Seat reserved");
      refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const drop = useMutation({
    mutationFn: (traineeId: string) => removePerson({ data: { traineeId } } as never),
    onSuccess: () => {
      toast.success("Removed permanently");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const status = useMutation({
    mutationFn: (values: { traineeId: string; status: "active" | "blocked" }) =>
      changeStatus({ data: values } as never),
    onSuccess: () => {
      toast.success("Updated");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const newLink = useMutation({
    mutationFn: (label: string) => makeLink({ data: { label } } as never),
    onSuccess: () => {
      toast.success("Registration link created");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const linkState = useMutation({
    mutationFn: (values: { id: string; isActive: boolean }) =>
      toggleLink({ data: values } as never),
    onSuccess: () => refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  const linkDelete = useMutation({
    mutationFn: (id: string) => dropLink({ data: { id } } as never),
    onSuccess: () => {
      toast.success("Link deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!ready || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  const stats = data?.stats;
  const trainees = (data?.trainees ?? []) as any[];
  const invites = (data?.invites ?? []) as any[];
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const completionRate = stats?.total ? Math.round(((stats.completed ?? 0) / stats.total) * 100) : 0;

  return (
    <MemberShell title="My Team" subtitle="Reserve seats and track your people" executive>
      {card ? (
        <div className="mb-6">
          <WelcomeCard credentials={card} />
          <div className="mt-3 flex justify-center">
            <Button variant="outline" className="rounded-2xl" onClick={() => setCard(null)}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
      ) : null}

      <section className="raised-panel metal-edge rounded-3xl p-5 animate-rise-in">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-[10px] font-bold uppercase text-primary">Network performance</p><h1 className="mt-1 font-display text-2xl font-bold">Your team at a glance</h1></div>
          <p className="text-xs text-muted-foreground">Weekly, monthly and training activity</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<Users className="h-4 w-4" />} label="Total team" value={stats?.total ?? 0} />
          <Stat icon={<CalendarDays className="h-4 w-4" />} label="This week" value={stats?.thisWeek ?? 0} />
          <Stat icon={<UserCheck className="h-4 w-4" />} label="Active" value={stats?.active ?? 0} />
          <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={stats?.completed ?? 0} />
        </div>
        <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div><div className="mb-2 flex justify-between text-xs"><span className="font-semibold">Team completion</span><span className="font-bold text-primary">{completionRate}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${completionRate}%` }} /></div></div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground"><span>{stats?.thisMonth ?? 0} this month</span><span>{stats?.started ?? 0} started</span><span>{stats?.blocked ?? 0} blocked</span><span>{invites.filter((i) => i.is_active).length} active links</span></div>
        </div>
      </section>

      <section className="raised-panel metal-edge mt-6 rounded-3xl animate-rise-in">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><SectionTitle className="mb-0">Team hierarchy</SectionTitle><p className="text-xs text-muted-foreground">Your direct Skyline network and training status</p></div>
          <Button variant="brand" className="rounded-xl" onClick={() => document.getElementById("reserve-seat")?.scrollIntoView({ behavior: "smooth" })}><UserPlus />Add member</Button>
        </div>
        <div className="p-4 sm:p-6">
          <div className="mx-auto max-w-3xl">
            <div className="relative mx-auto w-fit rounded-2xl border border-cyan/40 bg-primary/15 px-6 py-3 text-center shadow-brand">
              <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl border border-cyan/30 brand-gradient text-primary-foreground shadow-brand"><Crown className="h-4 w-4" /></span>
              <p className="font-display text-sm font-bold">{data?.upline.fullName ?? "You"}</p>
              <p className="text-[10px] font-semibold uppercase text-primary">{data?.upline.memberId} · You</p>
              {trainees.length > 0 ? <span className="absolute left-1/2 top-full h-6 w-px bg-primary/30" /> : null}
            </div>
            {trainees.length > 0 ? (
              <div className="relative mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <span className="absolute left-[16.66%] right-[16.66%] top-0 hidden h-px bg-primary/30 lg:block" />
                {trainees.map((person, index) => <TeamNode key={person.id} person={person} index={index} busy={status.isPending || drop.isPending} onStatus={(next) => status.mutate({ traineeId: person.id, status: next })} onRemove={() => drop.mutate(person.id)} />)}
              </div>
            ) : <div className="mt-6"><EmptyState title="No one registered yet" hint="Reserve a seat below or share your registration link." /></div>}
          </div>
        </div>
      </section>

      {/* ---------- reserve a seat ---------- */}
      <section id="reserve-seat" className="mt-6 grid scroll-mt-24 gap-4 lg:grid-cols-2">
        <form
          className="raised-panel metal-edge rounded-3xl p-6 animate-rise-in"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <SectionTitle className="mb-1">Reserve a seat</SectionTitle>
          <p className="mb-5 text-xs text-muted-foreground">
            Fill the form and the Skyline ID with password is created instantly. Your member ID is
            attached automatically as the upline.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  min={10}
                  max={90}
                  value={form.age}
                  onChange={(event) => setForm({ ...form, age: event.target.value })}
                />
              </div>
            </div>
          </div>
          <Button type="submit" variant="brand" size="xl" className="mt-6 w-full" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Create Skyline ID
          </Button>
        </form>

        {/* ---------- invite links ---------- */}
        <section className="raised-panel metal-edge rounded-3xl p-6 animate-rise-in">
          <SectionTitle className="mb-1">Registration links</SectionTitle>
          <p className="mb-5 text-xs text-muted-foreground">
            Share a link so the person fills their own form. Your member ID stays attached to every
            registration made through it.
          </p>
          <Button
            variant="outline"
            className="mb-4 w-full rounded-2xl"
            disabled={newLink.isPending}
            onClick={() => newLink.mutate("")}
          >
            {newLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create a new link
          </Button>

          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No links yet.</p>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => {
                const url = `${origin}/join/${invite.token}`;
                return (
                  <div key={invite.id} className="inset-panel rounded-xl p-4">
                    <p className="break-all text-xs text-muted-foreground">{url}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {invite.uses} registrations · {invite.is_active ? "Active" : "Paused"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="brand"
                        className="rounded-xl"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(url)
                            .then(() => toast.success("Link copied"))
                            .catch(() => toast.error("Could not copy the link"));
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => linkState.mutate({ id: invite.id, isActive: !invite.is_active })}
                      >
                        {invite.is_active ? "Pause" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-xl"
                        onClick={() => linkDelete.mutate(invite.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>

    </MemberShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="inset-panel rounded-xl p-4 animate-rise-in">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="text-brand-glow">{icon}</span>
        {label}
      </span>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function TeamNode({ person, index, busy, onStatus, onRemove }: { person: any; index: number; busy: boolean; onStatus: (status: "active" | "blocked") => void; onRemove: () => void }) {
  const progress = person.totalSessions > 0 ? Math.min(100, Math.round((person.sessionsWatched / person.totalSessions) * 100)) : 0;
  return <article className="relative pt-5 sm:pt-7">
    <span className="absolute left-1/2 top-0 h-5 w-px bg-primary/30 sm:h-7" />
    <div className="glass-panel metal-edge depth-hover rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display font-bold text-primary">{person.fullName.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-display text-sm font-bold">{person.fullName}</p><p className="truncate text-[10px] text-muted-foreground">{person.traineeCode} · {person.phone ?? "No phone"}</p></div>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${person.status === "active" ? "bg-cyan" : person.status === "blocked" ? "bg-brand-glow" : "bg-metal"}`} aria-label={person.status} />
      </div>
      <div className="mt-4"><div className="mb-1.5 flex justify-between text-[10px]"><span className="font-semibold text-muted-foreground">Training</span><span className="font-bold text-primary">{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div></div>
      <div className="mt-3 flex justify-between text-[10px] text-muted-foreground"><span>{person.sessionsWatched}/{person.totalSessions} sessions</span><span>{formatDate(person.createdAt)}</span></div>
      <div className="mt-4 flex gap-2">
        {person.status === "active" ? <Button size="sm" variant="outline" className="flex-1 rounded-lg" disabled={busy} onClick={() => onStatus("blocked")}><Ban />Block</Button> : <Button size="sm" variant="brand" className="flex-1 rounded-lg" disabled={busy} onClick={() => onStatus("active")}><UserCheck />Unblock</Button>}
        <Button size="icon" variant="destructive" className="rounded-lg" aria-label={`Remove ${person.fullName}`} disabled={busy} onClick={() => { if (window.confirm(`Remove ${person.fullName} permanently? Their ID and login will stop working.`)) onRemove(); }}><Trash2 /></Button>
      </div>
      <span className="sr-only">Team member {index + 1}</span>
    </div>
  </article>;
}
