import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Crown,
  KeyRound,
  Loader2,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/member/cards";
import {
  MemberShell,
  SectionTitle,
  TrainingOnlyLock,
  useMemberGuard,
  useTrainingOnly,
} from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { GenealogyTree, type TreePerson } from "@/components/team/GenealogyTree";
import { UplineActionQueue } from "@/components/journey/UplineActionQueue";
import { TraineeProgressRecord } from "@/components/journey/TraineeProgressRecord";
import {
  deleteTrainee,
  getMyFboTeam,
  getMyTeam,
  resetTraineePassword,
  setTraineeStatus,
} from "@/lib/team.functions";


export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team Tree — Skyline Achievers" },
      {
        name: "description",
        content:
          "Your Skyline Achievers team tree: weekly and monthly progress of everyone you registered.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Team Tree — Skyline Achievers" },
      { property: "og:description", content: "Track the progress of your registered trainees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const ready = useMemberGuard();
  const trainingOnly = useTrainingOnly();
  const queryClient = useQueryClient();
  const load = useServerFn(getMyTeam);
  const changeStatus = useServerFn(setTraineeStatus);
  const removePerson = useServerFn(deleteTrainee);
  const resetPassword = useServerFn(resetTraineePassword);

  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<"all" | "active" | "blocked">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [tab, setTab] = useState<"fbo" | "mentorship" | "customers">("fbo");
  const [journeyTrainee, setJourneyTrainee] = useState<{ id: string; name: string; phone: string | null } | null>(null);


  const { data, isPending } = useQuery({
    queryKey: ["my-team"],
    queryFn: () => load(),
    enabled: ready,
    retry: false,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["my-team"] });
  }


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

  const reset = useMutation({
    mutationFn: (traineeId: string) => resetPassword({ data: { traineeId } } as never),
    onSuccess: () => toast.success("Password reset to 00000000"),
    onError: (error: Error) => toast.error(error.message),
  });


  if (trainingOnly) {
    return (
      <MemberShell title="My Team" executive>
        <TrainingOnlyLock area="My Team & Seats" />
      </MemberShell>
    );
  }

  if (!ready || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <SkylineLoader variant="page" />
      </div>
    );
  }

  const stats = data?.stats;
  const trainees = (data?.trainees ?? []) as any[];
  const invites = (data?.invites ?? []) as any[];
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const completionRate = stats?.total ? Math.round(((stats.completed ?? 0) / stats.total) * 100) : 0;
  const visibleTrainees = trainees.filter((person) => {
    const needle = memberSearch.trim().toLowerCase();
    const matchesSearch =
      !needle ||
      person.fullName.toLowerCase().includes(needle) ||
      person.traineeCode.toLowerCase().includes(needle) ||
      (person.phone ?? "").toLowerCase().includes(needle);
    return matchesSearch && (memberFilter === "all" || person.status === memberFilter);
  });
  const allVisibleSelected =
    visibleTrainees.length > 0 && visibleTrainees.every((person) => selectedIds.includes(person.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function applyBulk(action: "active" | "blocked" | "remove") {
    if (selectedIds.length === 0) return;
    const label = action === "remove" ? "remove permanently" : action === "blocked" ? "block" : "unblock";
    if (!window.confirm(`${label[0]?.toUpperCase()}${label.slice(1)} ${selectedIds.length} selected members?`)) return;
    setBulkBusy(true);
    try {
      if (action === "remove") {
        await Promise.all(selectedIds.map((traineeId) => removePerson({ data: { traineeId } } as never)));
      } else {
        await Promise.all(
          selectedIds.map((traineeId) =>
            changeStatus({ data: { traineeId, status: action } } as never),
          ),
        );
      }
      toast.success(`${selectedIds.length} members updated`);
      setSelectedIds([]);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update selected members");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <MemberShell title="Team Tree" subtitle="Track everyone you registered" executive>
      <div className="raised-panel metal-edge flex flex-wrap gap-2 rounded-2xl p-2 animate-rise-in">
        {(
          [
            { key: "fbo", label: "FBO team tree" },
            { key: "mentorship", label: "Personal Mentorship" },
            { key: "customers", label: "Preferred customers" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`min-w-[30%] flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${tab === item.key ? "brand-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "fbo" || tab === "mentorship" ? (
        <FboTree ready={ready} kind={tab === "fbo" ? "fbo" : "mentorship"} />
      ) : null}

      {tab === "customers" ? (
        <UplineActionQueue ready={ready} uplineName={data?.upline.fullName ?? "your upline"} />
      ) : null}

      <div className={tab === "customers" ? "" : "hidden"}>
      <section className="raised-panel metal-edge mt-6 rounded-3xl p-5 animate-rise-in">

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

      <section className="raised-panel metal-edge mt-6 overflow-hidden rounded-2xl animate-rise-in">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><SectionTitle className="mb-0">Team hierarchy</SectionTitle><p className="text-xs text-muted-foreground">{trainees.length} direct members under {data?.upline.fullName ?? "you"}</p></div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Find by name or phone number" className="h-9 rounded-lg pl-9 text-xs" />
              </div>
              <select aria-label="Filter team status" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value as typeof memberFilter)} className="h-9 rounded-lg border border-hairline bg-surface-2 px-3 text-xs">
                <option value="all">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option>
              </select>
              <Button asChild variant="brand" size="sm" className="rounded-lg"><Link to="/seats"><UserPlus />Add member</Link></Button>
            </div>
          </div>
          {selectedIds.length > 0 ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-2"><span className="mr-auto px-1 text-xs font-semibold text-primary">{selectedIds.length} selected</span><Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void applyBulk("active")}><UserCheck />Unblock</Button><Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void applyBulk("blocked")}><Ban />Block</Button><Button size="sm" variant="destructive" disabled={bulkBusy} onClick={() => void applyBulk("remove")}><Trash2 />Remove</Button></div> : null}
        </div>

        {trainees.length === 0 ? <div className="p-5"><EmptyState title="No one registered yet" hint="Reserve a seat below or share your registration link." /></div> : (
          <div>
            <div className="hidden grid-cols-[34px_minmax(220px,1.5fr)_minmax(150px,1fr)_120px_126px] items-center gap-3 border-b border-border bg-surface/70 px-5 py-2.5 text-[10px] font-bold uppercase text-muted-foreground md:grid">
              <input type="checkbox" aria-label="Select all visible members" checked={allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? selectedIds.filter((id) => !visibleTrainees.some((person) => person.id === id)) : Array.from(new Set([...selectedIds, ...visibleTrainees.map((person) => person.id)])))} className="h-4 w-4 accent-primary" />
              <span>Member</span><span>Training</span><span>Status</span><span className="text-right">Actions</span>
            </div>
            <div className="border-b border-border bg-primary/10 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan/30 brand-gradient text-primary-foreground"><Crown className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1"><p className="truncate font-display text-sm font-semibold">{data?.upline.fullName ?? "You"}</p><p className="truncate text-[10px] text-primary">{data?.upline.memberId} · Upline</p></div>
                <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-1 text-[10px] font-semibold text-cyan">Root</span>
              </div>
            </div>
            {visibleTrainees.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No matching members.</p> : visibleTrainees.map((person, index) => <TeamRow key={person.id} person={person} index={index} selected={selectedIds.includes(person.id)} busy={bulkBusy || status.isPending || drop.isPending || reset.isPending} onSelect={() => toggleSelected(person.id)} onStatus={(next) => status.mutate({ traineeId: person.id, status: next })} onReset={() => reset.mutate(person.id)} onRemove={() => drop.mutate(person.id)} onJourney={() => setJourneyTrainee({ id: person.id, name: person.fullName, phone: person.phone ?? null })} />)}
            <div className="flex items-center justify-between border-t border-border bg-surface/60 px-4 py-3 text-[11px] text-muted-foreground sm:px-5"><span>Showing {visibleTrainees.length} of {trainees.length}</span><span>{selectedIds.length} selected</span></div>
          </div>
        )}
      </section>
      </div>

      {journeyTrainee ? (
        <TraineeProgressRecord
          traineeId={journeyTrainee.id}
          traineeName={journeyTrainee.name}
          onClose={() => setJourneyTrainee(null)}
        />
      ) : null}
    </MemberShell>
  );
}

/**
 * FBO / Personal Mentorship chart: every Skyline member (12-digit ID) below this
 * account, drawn as a family tree. Read-only — an upline can watch the daily
 * working report but never edit or delete a record.
 */
function FboTree({ ready, kind }: { ready: boolean; kind: "fbo" | "mentorship" }) {
  const load = useServerFn(getMyFboTeam);
  const [search, setSearch] = useState("");
  const { data, isPending } = useQuery({
    queryKey: ["my-fbo-team"],
    queryFn: () => load(),
    enabled: ready,
    retry: false,
  });

  if (isPending) {
    return (
      <div className="mt-6 flex justify-center py-10">
        <SkylineLoader />
      </div>
    );
  }

  const everyone = (data?.team ?? []) as TreePerson[];
  const group = everyone.filter((person) => person.kind === kind);
  const needle = search.trim().toLowerCase();
  const people = needle
    ? group.filter(
        (person) =>
          person.memberId.toLowerCase().includes(needle) ||
          person.fullName.toLowerCase().includes(needle),
      )
    : group;
  const stats = (kind === "fbo" ? data?.stats : data?.mentorshipStats) as any;
  const mentorship = kind === "mentorship";

  return (
    <>
      <section className="raised-panel metal-edge mt-6 rounded-3xl p-5 animate-rise-in">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase text-primary">
              {mentorship ? "Personal Mentorship network" : "FBO network"}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold">
              {mentorship ? "Personal Mentorship tree" : "Your FBO team tree"}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">Read-only · last 30 days of reports</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<Users className="h-4 w-4" />} label="Total" value={stats?.total ?? 0} />
          <Stat icon={<UserPlus className="h-4 w-4" />} label="Direct" value={stats?.direct ?? 0} />
          <Stat icon={<UserCheck className="h-4 w-4" />} label="Active" value={stats?.active ?? 0} />
          <Stat
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Enrollments"
            value={stats?.enrollments ?? 0}
          />
        </div>
      </section>

      <section className="raised-panel metal-edge mt-6 overflow-hidden rounded-2xl animate-rise-in">
        <div className="border-b border-border p-4 sm:p-5">
          <SectionTitle className="mb-0">
            {mentorship ? "Personal Mentorship hierarchy" : "FBO hierarchy"}
          </SectionTitle>
          <p className="text-xs text-muted-foreground">
            {people.length} {mentorship ? "mentorship members" : "FBOs"} under{" "}
            {data?.upline.fullName ?? "you"} · tap any card to open the ID and report
          </p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find by 12-digit Skyline ID or name"
              className="h-9 rounded-lg pl-9 text-xs"
            />
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <GenealogyTree
            root={{
              id: (data?.upline as any)?.id ?? "root",
              memberId: data?.upline.memberId ?? "",
              fullName: data?.upline.fullName ?? "You",
            }}
            people={people}
            emptyHint={
              mentorship
                ? "No Personal Mentorship members under your ID yet. They appear here as soon as their mentorship account is created."
                : "No FBOs under your ID yet. A member moves here after Assistant Supervisor confirmation."
            }
          />
        </div>
      </section>
    </>
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

function TeamRow({ person, index, selected, busy, onSelect, onStatus, onReset, onRemove, onJourney }: { person: any; index: number; selected: boolean; busy: boolean; onSelect: () => void; onStatus: (status: "active" | "blocked") => void; onReset: () => void; onRemove: () => void; onJourney: () => void }) {
  const progress = person.totalSessions > 0 ? Math.min(100, Math.round((person.sessionsWatched / person.totalSessions) * 100)) : 0;
  return <article className={`group border-b border-border px-4 py-3 transition-colors last:border-b-0 sm:px-5 ${selected ? "bg-primary/15" : "hover:bg-primary/5"}`}>
    <div className="grid gap-3 md:grid-cols-[34px_minmax(220px,1.5fr)_minmax(150px,1fr)_120px_126px] md:items-center">
      <input type="checkbox" aria-label={`Select ${person.fullName}`} checked={selected} onChange={onSelect} className="absolute h-4 w-4 accent-primary md:static" />
      <div className="ml-7 flex min-w-0 items-center gap-3 md:ml-0">
        <span className="relative ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 font-display text-xs font-bold text-primary before:absolute before:right-full before:top-1/2 before:h-px before:w-3 before:bg-primary/40">{person.fullName.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0"><p className="truncate font-display text-sm font-semibold">{person.fullName}</p><p className="truncate text-[10px] text-muted-foreground">{person.traineeCode} · {person.phone ?? "No phone"}</p></div>
      </div>
      <div><div className="mb-1 flex justify-between text-[10px]"><span className="text-muted-foreground">{person.sessionsWatched}/{person.totalSessions} sessions</span><span className="font-semibold text-primary">{progress}%</span></div><div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-[10px] text-muted-foreground">Joined {formatDate(person.createdAt)}</p></div>
      <span className={`w-fit rounded-full border px-2 py-1 text-[10px] font-semibold ${person.status === "active" ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-silver/20 bg-silver/10 text-silver"}`}>{person.status === "active" ? "Active" : "Blocked"}</span>
      <div className="flex flex-wrap gap-1.5 md:justify-end">
        <Button size="sm" variant="brand" className="h-8 rounded-lg px-2 text-[11px]" onClick={onJourney}><CalendarClock />Journey</Button>
        <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" aria-label={`Reset ${person.fullName} password`} title="Reset password to 00000000" disabled={busy} onClick={() => { if (window.confirm(`Reset ${person.fullName}'s password to 00000000?`)) onReset(); }}><KeyRound className="h-3.5 w-3.5" /></Button>
        {person.status === "active" ? <Button size="sm" variant="outline" className="h-8 rounded-lg px-2 text-[11px]" disabled={busy} onClick={() => onStatus("blocked")}><Ban />Block</Button> : <Button size="sm" variant="brand" className="h-8 rounded-lg px-2 text-[11px]" disabled={busy} onClick={() => onStatus("active")}><UserCheck />Unblock</Button>}
        <Button size="icon" variant="destructive" className="h-8 w-8 rounded-lg" aria-label={`Remove ${person.fullName}`} disabled={busy} onClick={() => { if (window.confirm(`Remove ${person.fullName} permanently? Their ID and login will stop working.`)) onRemove(); }}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
      <span className="sr-only">Team member {index + 1}</span>
    </div>
  </article>;
}
