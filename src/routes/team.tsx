import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Copy,
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
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const status = useMutation({
    mutationFn: (values: { traineeId: string; status: "active" | "blocked" | "removed" }) =>
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

  return (
    <MemberShell title="My Team" subtitle="Reserve seats and track your people">
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

      {/* ---------- tracking ---------- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" />} label="Total registered" value={stats?.total ?? 0} />
        <Stat icon={<CalendarDays className="h-4 w-4" />} label="This week" value={stats?.thisWeek ?? 0} />
        <Stat icon={<CalendarDays className="h-4 w-4" />} label="This month" value={stats?.thisMonth ?? 0} />
        <Stat icon={<UserCheck className="h-4 w-4" />} label="Active" value={stats?.active ?? 0} />
        <Stat icon={<Play className="h-4 w-4" />} label="Started training" value={stats?.started ?? 0} />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={stats?.completed ?? 0} />
        <Stat icon={<Ban className="h-4 w-4" />} label="Blocked" value={stats?.blocked ?? 0} />
        <Stat icon={<Link2 className="h-4 w-4" />} label="Active links" value={invites.filter((i) => i.is_active).length} />
      </section>

      {/* ---------- reserve a seat ---------- */}
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <form
          className="glass-panel-strong rounded-[28px] p-6 animate-rise-in"
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
                placeholder="Ahmad Raza"
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
                  placeholder="03001234567"
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
                  placeholder="22"
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
        <section className="glass-panel rounded-[28px] p-6 animate-rise-in">
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
                  <div key={invite.id} className="rounded-2xl border border-hairline bg-glass p-4">
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

      {/* ---------- people ---------- */}
      <section className="mt-6">
        <SectionTitle>People you registered</SectionTitle>
        {trainees.length === 0 ? (
          <EmptyState
            title="No one registered yet"
            hint="Reserve a seat above or share your registration link."
          />
        ) : (
          <div className="space-y-3">
            {trainees.map((person) => (
              <div key={person.id} className="glass-panel rounded-3xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold">{person.fullName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {person.traineeCode} · {person.phone ?? "no phone"} · joined{" "}
                      {formatDate(person.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-full border border-hairline px-3 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {person.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-glass-strong">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width:
                          person.totalSessions > 0
                            ? `${Math.min(100, (person.sessionsWatched / person.totalSessions) * 100)}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {person.sessionsWatched}/{person.totalSessions} sessions
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {person.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={status.isPending}
                      onClick={() => status.mutate({ traineeId: person.id, status: "blocked" })}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Block
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="brand"
                      className="rounded-xl"
                      disabled={status.isPending || person.status === "removed"}
                      onClick={() => status.mutate({ traineeId: person.id, status: "active" })}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Unblock
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-xl"
                    disabled={status.isPending || person.status === "removed"}
                    onClick={() => status.mutate({ traineeId: person.id, status: "removed" })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove permanently
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </MemberShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass-panel rounded-3xl p-4 animate-rise-in">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="text-brand-glow">{icon}</span>
        {label}
      </span>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
