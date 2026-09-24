import { Crown, Maximize2, Minimize2, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export type TreePerson = {
  id: string;
  memberId: string;
  fullName: string;
  status: string;
  rank: string | null;
  kind: "fbo" | "mentorship";
  uplineId: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  payment: {
    required: number;
    verified: number;
    remaining: number;
    dueAt: string | null;
    history: {
      id: string;
      purpose: string;
      claimed: number;
      verified: number;
      status: string;
      createdAt: string;
      verifiedAt: string | null;
    }[];
  };
  report: {
    days: number;
    absentDays: number;
    leads: number;
    responses: number;
    enrollments: number;
    pending: number;
    twoCc: number;
    lastDate: string | null;
    recent: {
      date: string;
      status: "report" | "leave" | "absent";
      leads: number;
      responses: number;
      enrollments: number;
      pending: number;
      twoCc: number;
    }[];
  };
};

type Props = {
  root: { id: string; memberId: string; fullName: string; avatarUrl?: string | null };
  people: TreePerson[];
  /** Only these people are drawn as nodes (the rest just carry the chain). */
  emptyHint: string;
};

export function personState(person: TreePerson): "active" | "inactive" | "leave" {
  if (person.status !== "active") return "inactive";
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  const recent = person.report?.recent ?? [];
  if (recent.some((row) => row.date === today && row.status === "leave")) return "leave";
  const last = person.report?.lastDate;
  if (!last) return "inactive";
  const days = (Date.parse(today) - Date.parse(String(last).slice(0, 10))) / 86_400_000;
  return days <= 3 ? "active" : "inactive";
}

const RING = 120;

export function GenealogyTree({ root, people, emptyHint }: Props) {
  const [fullScreen, setFullScreen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const ids = new Set(people.map((person) => person.id));
  const childrenOf = (parentId: string) =>
    parentId === root.id
      ? people.filter((p) => !p.uplineId || p.uplineId === root.id || !ids.has(p.uplineId))
      : people.filter((person) => person.uplineId === parentId);
  const topLevel = childrenOf(root.id);
  const focusPerson = focusId ? people.find((p) => p.id === focusId) ?? null : null;
  const center = focusPerson
    ? { id: focusPerson.id, memberId: focusPerson.memberId, fullName: focusPerson.fullName, avatarUrl: focusPerson.avatarUrl }
    : { ...root, avatarUrl: root.avatarUrl ?? null };

  // Generations around the focused person: ring 1 = direct, ring 2 = next, ...
  const rings: TreePerson[][] = [];
  let frontier = childrenOf(center.id);
  while (frontier.length && rings.length < 4) {
    rings.push(frontier);
    frontier = frontier.flatMap((p) => childrenOf(p.id));
  }
  const size = (rings.length + 1) * RING * 2 + 120;
  const mid = size / 2;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fit = Math.min(window.innerWidth, window.innerHeight - 120) / size;
    setScale(Math.min(1.4, Math.max(0.25, fit)));
    setOffset({ x: 0, y: 0 });
  }, [fullScreen, size]);

  const found = people.find((person) => person.id === openId) ?? null;
  const selected = found
    ? {
        ...found,
        payment: {
          required: found.payment?.required ?? 0,
          verified: found.payment?.verified ?? 0,
          remaining: found.payment?.remaining ?? 0,
          dueAt: found.payment?.dueAt ?? null,
          history: found.payment?.history ?? [],
        },
      }
    : null;

  function onPointerDown(event: React.PointerEvent) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }
  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    const prev = pointers.current.get(event.pointerId)!;
    const next = { x: event.clientX, y: event.clientY };
    if (pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0) setScale((s) => Math.min(3, Math.max(0.25, s * (after / before))));
    } else {
      setOffset((o) => ({ x: o.x + next.x - prev.x, y: o.y + next.y - prev.y }));
    }
    pointers.current.set(event.pointerId, next);
  }
  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
  }

  const dot = { active: "bg-emerald-500", inactive: "bg-destructive", leave: "bg-sky-500" } as const;

  const orbit = (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {rings.map((ring, index) => {
        const r = (index + 1) * RING;
        const dur = 70 + index * 45;
        const reverse = index % 2 === 1;
        const ringStyle: React.CSSProperties = {
          left: mid - r,
          top: mid - r,
          width: r * 2,
          height: r * 2,
          animation: `orbit-spin ${dur}s linear infinite`,
          animationDirection: reverse ? "reverse" : "normal",
        };
        return (
          <div key={`orbit-${index}`} className="absolute" style={ringStyle}>
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border border-dashed border-cyan/30"
              style={{ boxShadow: "0 0 30px hsl(var(--primary) / 0.15) inset" }}
            />
            {ring.map((person, i) => {
              const angle = (i / ring.length) * Math.PI * 2 - Math.PI / 2 + index * 0.4;
              const x = r + r * Math.cos(angle);
              const y = r + r * Math.sin(angle);
              const state = personState(person);
              return (
                <button
                  key={person.id}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setOpenId(person.id)}
                  className="absolute flex w-20 flex-col items-center text-center"
                  style={{
                    left: x,
                    top: y,
                    animation: `orbit-counter ${dur}s linear infinite`,
                    animationDirection: reverse ? "reverse" : "normal",
                  }}
                >
                  <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-cyan/50 bg-surface-2 font-display text-sm font-bold text-primary shadow-[0_0_18px_hsl(var(--primary)/0.45)]">
                    {person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" /> : person.fullName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={`absolute right-4 top-0 h-3.5 w-3.5 rounded-full border-2 border-background ${dot[state]}`} aria-label={state} />
                  <span className="mt-1 w-full truncate text-[10px] font-semibold">{person.fullName}</span>
                  <span className="w-full truncate text-[8px] text-primary">{person.memberId}</span>
                </button>
              );
            })}
          </div>
        );
      })}
      <div
        className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
        style={{ left: mid, top: mid }}
      >
        <Crown className="h-5 w-5 text-amber-400 drop-shadow" />
        <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-cyan brand-gradient font-display text-2xl font-bold text-primary-foreground shadow-[0_0_40px_hsl(var(--primary)/0.6)]">
          {center.avatarUrl ? <img src={center.avatarUrl} alt="" className="h-full w-full object-cover" /> : center.fullName.slice(0, 1).toUpperCase()}
        </span>
        <span className="mt-1 w-full truncate text-xs font-bold">{center.fullName}</span>
        <span className="w-full truncate text-[9px] text-cyan">{center.memberId}</span>
      </div>
    </div>
  );

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      {focusPerson ? (
        <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => setFocusId(focusPerson.uplineId && ids.has(focusPerson.uplineId) ? focusPerson.uplineId : null)}>
          ← Back
        </Button>
      ) : null}
      <Button type="button" size="icon" variant="outline" className="rounded-xl" aria-label="Zoom out" onClick={() => setScale((s) => Math.max(0.25, s - 0.2))}><Minus className="h-4 w-4" /></Button>
      <Button type="button" size="icon" variant="outline" className="rounded-xl" aria-label="Zoom in" onClick={() => setScale((s) => Math.min(3, s + 0.2))}><Plus className="h-4 w-4" /></Button>
      <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>Reset</Button>
    </div>
  );

  const canvas = (
    <div
      className="relative h-full w-full touch-none select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={(event) => setScale((s) => Math.min(3, Math.max(0.25, s * Math.exp(-event.deltaY * 0.0015))))}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{ transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
      >
        {orbit}
      </div>
    </div>
  );

  if (topLevel.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">{emptyHint}</p>;
  }

  return (
    <>
      {fullScreen && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[60] h-[100dvh] w-screen bg-background">
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-3">
            {controls}
            <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => setFullScreen(false)}>
              <Minimize2 className="h-3.5 w-3.5" /> Close
            </Button>
          </div>
          {canvas}
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[10px] text-muted-foreground">
            Drag · pinch to zoom · tap a person · green active · red inactive · blue leave
          </p>
        </div>,
        document.body,
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            {controls}
            <Button type="button" size="sm" className="rounded-xl" onClick={() => setFullScreen(true)}>
              <Maximize2 className="h-3.5 w-3.5" /> Full screen
            </Button>
          </div>
          <div className="h-[70vh] rounded-2xl border border-hairline bg-background/40">{canvas}</div>
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
          <div className="raised-panel metal-edge max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-surface-2 font-display text-lg font-bold text-primary">
                {selected.avatarUrl ? (
                  <img src={selected.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  selected.fullName.slice(0, 1).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold">{selected.fullName}</p>
                <p className="text-[11px] font-semibold capitalize">{personState(selected)}</p>
                <p className="text-xs text-primary">{selected.memberId}</p>
                <p className="text-[11px] text-muted-foreground">
                  {selected.rank ?? "No rank"} ·{" "}
                  {selected.kind === "mentorship" ? "Personal Mentorship" : "FBO"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpenId(null)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {(selected.kind === "mentorship"
                ? [
                    { label: "Required", value: `Rs. ${selected.payment.required.toLocaleString("en-PK")}` },
                    { label: "Paid", value: `Rs. ${selected.payment.verified.toLocaleString("en-PK")}` },
                    { label: "Remaining", value: `Rs. ${selected.payment.remaining.toLocaleString("en-PK")}` },
                  ]
                : [
                    { label: "Leads", value: selected.report.leads },
                    { label: "Enroll", value: selected.report.enrollments },
                    { label: "2CC", value: selected.report.twoCc },
                    { label: "Response", value: selected.report.responses },
                    { label: "Pending", value: selected.report.pending },
                    { label: "Report days", value: selected.report.days },
                  ]).map((item) => (
                <div key={item.label} className="inset-panel rounded-xl px-2 py-2">
                  <p className="break-words font-display text-sm font-semibold tabular-nums sm:text-lg">{item.value}</p>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <p>Status: {selected.status === "active" ? "Active" : "Blocked"}</p>
              <p>Joined: {formatDate(selected.createdAt)}</p>
              {selected.kind === "mentorship" ? (
                <>
                  <p>Payment status: {selected.payment.remaining === 0 ? "Completed" : "Incomplete"}</p>
                  <p>Due date: {selected.payment.dueAt ? formatDate(selected.payment.dueAt) : "Not set"}</p>
                </>
              ) : (
                <>
                  <p>Last report: {selected.report.lastDate ? formatDate(selected.report.lastDate) : "—"}</p>
                  <p>Leave days: {selected.report.absentDays}</p>
                </>
              )}
            </div>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-primary">
              {selected.kind === "mentorship" ? "Payment history" : "Last 14 days · every day"}
            </p>
            {selected.kind === "mentorship" ? (
              <div className="mt-2 space-y-2">
                {selected.payment.history.length === 0 ? (
                  <p className="rounded-xl border border-hairline px-3 py-4 text-center text-[11px] text-muted-foreground">
                    No payment submissions yet. Verified paid amount is shown above.
                  </p>
                ) : selected.payment.history.map((row) => (
                  <div key={row.id} className="inset-panel rounded-xl p-3 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{row.purpose === "two_cc" ? "2CC" : "Personal Mentorship"}</p>
                      <span className={row.status === "verified" ? "font-semibold text-cyan" : row.status === "rejected" ? "font-semibold text-destructive" : "font-semibold text-primary"}>
                        {row.status === "verified" ? "Verified" : row.status === "rejected" ? "Rejected" : "Pending"}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {formatDate(row.createdAt)} · Claimed Rs. {row.claimed.toLocaleString("en-PK")}
                      {row.status === "verified" ? ` · Verified Rs. ${row.verified.toLocaleString("en-PK")}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
            <div className="mt-2 overflow-x-auto rounded-xl border border-hairline">
              <table className="w-full text-[11px]">
                <thead className="bg-surface/70 text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-right">Leads</th>
                    <th className="px-2 py-1.5 text-right">Resp</th>
                    <th className="px-2 py-1.5 text-right">Enroll</th>
                    <th className="px-2 py-1.5 text-right">2CC</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.report.recent.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-3 text-center text-muted-foreground">
                        No report days yet.
                      </td>
                    </tr>
                  ) : (
                    selected.report.recent.map((row) =>
                      row.status === "report" ? (
                        <tr key={row.date} className="border-t border-border">
                          <td className="px-2 py-1.5">{formatDate(row.date)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.leads}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.responses}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.enrollments}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.twoCc}</td>
                        </tr>
                      ) : (
                        <tr key={row.date} className="border-t border-border">
                          <td className="px-2 py-1.5">{formatDate(row.date)}</td>
                          <td
                            colSpan={4}
                            className={`px-2 py-1.5 text-right font-semibold ${row.status === "leave" ? "text-cyan" : "text-destructive"}`}
                          >
                            {row.status === "leave" ? "Leave (approved)" : "Absent"}
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
            )}

            <p className="mt-3 text-[10px] text-muted-foreground">
              Business information only. Personal details stay private and records here are
              read-only.
            </p>
            {childrenOf(selected.id).length > 0 ? (
              <Button
                className="mt-3 w-full rounded-2xl"
                onClick={() => { setFocusId(selected.id); setOpenId(null); setOffset({ x: 0, y: 0 }); }}
              >
                Show {selected.fullName}'s circle ({childrenOf(selected.id).length})
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="mt-3 w-full rounded-2xl"
              onClick={() => setOpenId(null)}
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
