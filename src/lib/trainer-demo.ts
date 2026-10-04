// Founder Training state is browser-only and never touches real member records.
import { useCallback, useEffect, useState } from "react";
import type { TreePerson } from "@/components/team/GenealogyTree";

export const DEMO_TRAINEE = {
  name: "Skyline Achievers",
  age: 18,
  phone: "0300-0000076",
  city: "Lahore",
  code: "SA-DEMO-01",
};

export const SESSION_TITLES = [
  "Introduction to Skyline Achievers",
  "Forever Living Products & Company",
  "Online Earning Skill",
  "Marketing Plan Basics",
  "Lead Generation",
  "Communication & Follow-up",
  "Leadership & Next Steps",
];

export type SimState = {
  step: number; // 1..7
  seatReserved: boolean;
  approved: number; // sessions approved 0..7
  sessionOpen: boolean;
  watched: boolean;
  reviewSubmitted: boolean;
  reportReady: boolean;
  interviewPrepared: boolean;
  interviewTime: string | null;
  interviewScore: number | null;
  pm: "none" | "pending" | "approved";
  cc: "none" | "pending" | "approved";
  pendingSince: number | null;
};

export const INITIAL_SIM: SimState = {
  step: 1,
  seatReserved: false,
  approved: 0,
  sessionOpen: false,
  watched: false,
  reviewSubmitted: false,
  reportReady: false,
  interviewPrepared: false,
  interviewTime: null,
  interviewScore: null,
  pm: "none",
  cc: "none",
  pendingSince: null,
};

type FounderTrainingHistory = { list: SimState[]; at: number };

const STORAGE_KEY = "skyline-founder-training:760000010005";
const CHANGE_EVENT = "skyline-founder-training-change";

function validHistory(value: unknown): value is FounderTrainingHistory {
  if (!value || typeof value !== "object") return false;
  const history = value as FounderTrainingHistory;
  return Array.isArray(history.list) && history.list.length > 0 && history.at >= 0 && history.at < history.list.length;
}

function readHistory(): FounderTrainingHistory {
  if (typeof window === "undefined") return { list: [INITIAL_SIM], at: 0 };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    if (validHistory(parsed)) return parsed;
  } catch {
    // A damaged local training record starts again safely.
  }
  return { list: [INITIAL_SIM], at: 0 };
}

function writeHistory(history: FounderTrainingHistory) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useFounderTraining() {
  const [history, setHistory] = useState<FounderTrainingHistory>({ list: [INITIAL_SIM], at: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setHistory(readHistory());
    sync();
    setReady(true);
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<SimState>) => {
    const current = readHistory();
    const next = { ...current.list[current.at], ...patch } as SimState;
    writeHistory({ list: [...current.list.slice(0, current.at + 1), next], at: current.at + 1 });
  }, []);

  const move = useCallback((direction: -1 | 1) => {
    const current = readHistory();
    const at = Math.max(0, Math.min(current.list.length - 1, current.at + direction));
    writeHistory({ ...current, at });
  }, []);

  const reset = useCallback(() => {
    writeHistory({ list: [INITIAL_SIM], at: 0 });
  }, []);

  return {
    ready,
    state: history.list[history.at] ?? INITIAL_SIM,
    canBack: history.at > 0,
    canForward: history.at < history.list.length - 1,
    update,
    back: () => move(-1),
    forward: () => move(1),
    reset,
  };
}

export const STEPS = [
  "Seat Reservation",
  "Beginner Session",
  "Review & Approval",
  "7 Sessions & Report",
  "Final Interview",
  "Personal Mentorship",
  "2CC & Assistant Supervisor",
];

const FIRST = ["Ali", "Ahmed", "Usman", "Bilal", "Hamza", "Ayesha", "Fatima", "Zainab", "Hassan", "Sana", "Imran", "Hira", "Kashif", "Maryam", "Saad", "Noor", "Faisal", "Rabia", "Tariq", "Iqra"];
const LAST = ["Khan", "Malik", "Raza", "Butt", "Sheikh", "Qureshi", "Chaudhry", "Abbasi", "Mirza", "Siddiqui"];
const RANKS = ["Manager", "Senior Manager", "Assistant Manager", "Supervisor", "Assistant Supervisor", "Assistant Supervisor", "Assistant Supervisor"];

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function person(i: number, uplineId: string | null, gen: number, kind: "fbo" | "mentorship"): TreePerson {
  const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
  const leads = Math.round(rand(i) * 120) + 10;
  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  return {
    id: `demo-${i}`,
    memberId: `76${String(1000000000 + i * 7919).slice(0, 10)}`,
    fullName: name,
    status: rand(i + 3) > 0.15 ? "active" : "inactive",
    rank: kind === "fbo" ? RANKS[Math.min(gen, RANKS.length - 1)]! : null,
    kind,
    uplineId,
    avatarUrl: null,
    createdAt: day(30 + gen * 20),
    lastLoginAt: day(Math.round(rand(i + 5) * 5)),
    payment: { required: 0, verified: 0, remaining: 0, dueAt: null, history: [] },
    report: {
      days: 20 + Math.round(rand(i + 1) * 8),
      absentDays: Math.round(rand(i + 2) * 3),
      leads,
      responses: Math.round(leads * 0.4),
      enrollments: Math.round(leads * 0.08),
      pending: Math.round(rand(i + 4) * 5),
      twoCc: Math.round(rand(i + 6) * 3),
      lastDate: day(1).slice(0, 10),
      recent: [],
    },
  };
}

/** Seven generations under the Skyline Achievers root. */
export function buildDemoTree(): TreePerson[] {
  const out: TreePerson[] = [];
  let i = 1;
  let level: TreePerson[] = [];
  for (const _ of [0, 1]) {
    const p = person(i++, "root", 0, "fbo");
    out.push(p);
    level.push(p);
  }
  for (let gen = 1; gen < 7; gen++) {
    const next: TreePerson[] = [];
    for (const parent of level) {
      const kids = gen < 3 ? 2 : 1 + (i % 2);
      for (let k = 0; k < kids && out.length < 70; k++) {
        const p = person(i++, parent.id, gen, gen > 4 && k === 1 ? "mentorship" : "fbo");
        out.push(p);
        next.push(p);
      }
    }
    level = next;
  }
  return out;
}

export function demoMentorship() {
  return Array.from({ length: 12 }, (_, n) => ({
    id: `pm-${n}`,
    name: `${FIRST[(n + 4) % FIRST.length]} ${LAST[(n * 3) % LAST.length]}`,
    stage: n % 3 === 0 ? "Stage 1 — Payment pending" : n % 3 === 1 ? "Stage 2 — Learning" : "Verified — 2CC in progress",
    paid: n % 3 === 0 ? 0 : 5000 + (n % 4) * 1000,
  }));
}

export function demoPreferred() {
  return Array.from({ length: 9 }, (_, n) => ({
    id: `pc-${n}`,
    name: `${FIRST[(n + 9) % FIRST.length]} ${LAST[(n * 5) % LAST.length]}`,
    sessions: (n * 3) % 8,
  }));
}
