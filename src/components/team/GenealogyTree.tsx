import { Crown, Maximize2, Minimize2, Minus, Plus, X } from "lucide-react";
import { useState } from "react";

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
  root: { id: string; memberId: string; fullName: string };
  people: TreePerson[];
  /** Only these people are drawn as nodes (the rest just carry the chain). */
  emptyHint: string;
};

/**
 * Genealogy-style team chart: every person is a card, lines connect each card to
 * the person who registered them, and tapping a card opens their ID and working
 * report — business information only, no private personal details.
 */
export function GenealogyTree({ root, people, emptyHint }: Props) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [fullScreen, setFullScreen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const childrenOf = (parentId: string) =>
    people.filter((person) => person.uplineId === parentId);
  // People whose own upline is not in this view still hang under the root.
  const ids = new Set(people.map((person) => person.id));
  const topLevel = people.filter(
    (person) => !person.uplineId || person.uplineId === root.id || !ids.has(person.uplineId),
  );
  const selected = people.find((person) => person.id === openId) ?? null;

  function toggle(id: string) {
    setCollapsed((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function renderPerson(person: TreePerson) {
    const kids = childrenOf(person.id);
    const isOpen = !collapsed.includes(person.id);
    return (
      <div key={person.id} className="relative flex shrink-0 flex-col items-center pt-6">
        <span className="absolute left-1/2 top-0 h-6 w-px bg-primary/40" aria-hidden />
        <button
          type="button"
          onClick={() => setOpenId(person.id)}
          className={`glass-panel metal-edge depth-hover w-[168px] rounded-2xl px-3 py-2.5 text-left transition-transform ${
            openId === person.id ? "ring-2 ring-cyan/60" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline bg-surface-2 font-display text-xs font-bold text-primary">
              {person.avatarUrl ? (
                <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                person.fullName.slice(0, 1).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-xs font-semibold">{person.fullName}</p>
              <p className="truncate text-[10px] text-primary">{person.memberId}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] uppercase tracking-wide text-muted-foreground">
            <span className="truncate">{person.rank ?? "No rank"}</span>
            <span
              className={person.status === "active" ? "text-cyan" : "text-silver"}
            >
              {person.status === "active" ? "Active" : "Blocked"}
            </span>
          </div>
        </button>

        {kids.length > 0 ? (
          <button
            type="button"
            onClick={() => toggle(person.id)}
            aria-label={isOpen ? `Hide team of ${person.fullName}` : `Show team of ${person.fullName}`}
            className="z-10 -mt-2 flex h-5 w-5 items-center justify-center rounded-full border border-cyan/40 bg-surface text-cyan"
          >
            {isOpen ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>
        ) : null}

        {kids.length > 0 && isOpen ? (
          <div className="relative flex items-start gap-5 pt-1">
            {kids.length > 1 ? (
              <span
                className="absolute left-[84px] right-[84px] top-0 h-px bg-primary/30"
                aria-hidden
              />
            ) : null}
            {kids.map((child) => renderPerson(child))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div
        className={
          fullScreen
            ? "fixed inset-0 z-40 overflow-auto bg-background p-3"
            : "overflow-x-auto pb-4"
        }
      >
        <div className="mb-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => setFullScreen((value) => !value)}
          >
            {fullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {fullScreen ? "Close full screen" : "Full screen"}
          </Button>
        </div>
        <div className="mx-auto flex min-w-max flex-col items-center px-4">
          <div className="glass-panel metal-edge w-[190px] rounded-2xl border border-cyan/30 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan/30 brand-gradient text-primary-foreground">
                <Crown className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-xs font-semibold">{root.fullName}</p>
                <p className="truncate text-[10px] text-cyan">{root.memberId} · You</p>
              </div>
            </div>
          </div>

          {topLevel.length === 0 ? (
            <p className="mt-6 max-w-xs text-center text-xs text-muted-foreground">{emptyHint}</p>
          ) : (
            <div className="relative flex items-start gap-5">
              {topLevel.length > 1 ? (
                <span
                  className="absolute left-[84px] right-[84px] top-6 h-px bg-primary/30"
                  aria-hidden
                />
              ) : null}
              {topLevel.map((person) => renderPerson(person))}
            </div>
          )}
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
          <div className="raised-panel metal-edge max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl p-5">
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
              {[
                { label: "Leads", value: selected.report.leads },
                { label: "Enroll", value: selected.report.enrollments },
                { label: "2CC", value: selected.report.twoCc },
                { label: "Response", value: selected.report.responses },
                { label: "Pending", value: selected.report.pending },
                { label: "Report days", value: selected.report.days },
              ].map((item) => (
                <div key={item.label} className="inset-panel rounded-xl px-2 py-2">
                  <p className="font-display text-lg font-semibold tabular-nums">{item.value}</p>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <p>Status: {selected.status === "active" ? "Active" : "Blocked"}</p>
              <p>Joined: {formatDate(selected.createdAt)}</p>
              <p>Last report: {selected.report.lastDate ? formatDate(selected.report.lastDate) : "—"}</p>
              <p>Leave days: {selected.report.absentDays}</p>
            </div>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-primary">
              Last 14 days · every day
            </p>
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

            <p className="mt-3 text-[10px] text-muted-foreground">
              Business information only. Personal details stay private and records here are
              read-only.
            </p>
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
