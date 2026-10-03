/**
 * Skyline AI Teacher Training — curriculum.
 * Content describes only real, current Skyline screens and approved facts.
 * The AI generates its own wording; it teaches these objectives in order.
 */
export const TRAINING_STAGES = ["INTRO", "EXPLAIN", "DEMONSTRATE", "PRACTICE", "EVALUATE"] as const;
export type TrainingStage = (typeof TRAINING_STAGES)[number] | "TEST" | "REMEDIATE" | "DONE";

export const PASS_PERCENT = 80;
/** Ranks that must finish mandatory training before the working dashboard opens. */
export const LOCKED_RANK_ORDERS = [2];

export type Lesson = {
  id: string;
  title: string;
  objective: string;
  /** Verified points to explain. */
  facts: string[];
  /** Where to point on screen (data-ai-guide markers or visible labels). */
  demonstrate: string;
  /** Something the person does themselves while the AI watches the shared screen. */
  practice: string;
  /** Understanding question; judge meaning, not words. */
  check: string;
  /** Optional whiteboard idea. */
  board?: string;
  /** Route to suggest the person opens (they tap it themselves). */
  open?: string;
};

export type TestQuestion = { id: string; q: string; expected: string };

export type Chapter = {
  n: number;
  title: string;
  ready: boolean;
  lessons: Lesson[];
  test: { questions: TestQuestion[]; practical: string };
};

const LANDING = "/?classroom=1";

export const CHAPTERS: Chapter[] = [
  {
    n: 1,
    title: "Skyline Website ko samajhna",
    ready: true,
    lessons: [
      {
        id: "1.1",
        title: "Landing page kya hai aur kyun hai",
        objective: "Samjhe ke landing page Skyline ka darwaza hai jo naye logon ko pehli baar dikhaya jata hai.",
        facts: [
          "Landing page wo pehla page hai jo website kholte hi dikhta hai (login se pehle).",
          "Is ka maqsad naye shakhs ko Skyline ka taaruf dena hai: Learn • Earn • Lead.",
          "Sab se upar bara hissa (hero) hai: 'SKYLINE ACHIEVERS' naam aur headline 'Turn your smartphone into a real income skill.'",
          "Hero mein do bare button hain: 'Watch Free Orientation' aur 'Join Next Batch'. Upar chhota 'Login' button sirf members ke liye hai.",
        ],
        demonstrate: "Hero headline, 'Watch Free Orientation' button, 'Join Next Batch' button aur upar Login button dikhayein.",
        practice: "Landing page kholein (button 'Landing page kholein' dabayein) aur hero ka 'Watch Free Orientation' button dhoondein.",
        check: "Landing page ka main maqsad kya hai?",
        board: "Flow: Naya shakhs → Landing page → Orientation video → Member se rabta → Training",
        open: LANDING,
      },
      {
        id: "1.2",
        title: "Orientation video aur 'Kis ke liye hai'",
        objective: "Samjhe ke orientation video naye shakhs ki pehli seekh hai aur 'Who' hissa batata hai ye kis ke liye hai.",
        facts: [
          "'Free orientation' hissa mein Skyline ki enrollment/orientation video lagi hai — naye shakhs ko yahi pehle dikhani hoti hai.",
          "'Who' hissa batata hai Skyline kin logon ke liye hai (mobile aur internet wale log jo seekh kar aage barhna chahte hain).",
          "Website se koi khud join nahi kar sakta; join hamesha kisi official Skyline member ke zariye hota hai.",
        ],
        demonstrate: "Neeche scroll karwa ke 'Free orientation' video aur 'Who' hissa highlight karein.",
        practice: "Neeche scroll kar ke orientation video wala hissa screen par layein.",
        check: "Koi naya shakhs sirf website se khud join kar sakta hai ya nahi? Kyun?",
        board: "Diagram: Orientation video (pehla qadam) → sawal → Member guide karta hai",
      },
      {
        id: "1.3",
        title: "About aur Real Stories (Reviews)",
        objective: "Samjhe ke About hissa Skyline ka taaruf hai aur Reviews asli logon ki kahaniyan hain jo bharosa banati hain.",
        facts: [
          "'About' hissa Skyline Achievers ka maqsad aur tareeqa batata hai.",
          "'Reviews' / real stories hissa mein members ki testimonies hain.",
          "Kisi kahani ko income ki guarantee na samjhein aur na batayein.",
        ],
        demonstrate: "About hissa aur Reviews hissa box/circle se dikhayein.",
        practice: "Reviews (real stories) wale hisse tak scroll karein.",
        check: "Reviews kisi naye shakhs ke liye kyun zaroori hain, aur in ke baare mein kya nahi kehna chahiye?",
      },
      {
        id: "1.4",
        title: "Start section, Skyline AI aur Footer",
        objective: "Samjhe ke page ke aakhir mein action hissa, Skyline AI madad aur footer links hain.",
        facts: [
          "'Start your journey today.' hissa mein dobara 'Watch Free Orientation' aur 'Ask Skyline AI' buttons hain.",
          "Skyline AI ready-made sawalon ke sath naye shakhs ke sawalon ka jawab deta hai.",
          "Footer mein Explore links (Introduction, About, Who, Reviews) aur Access links (Member login, Ask Skyline AI, Join batch) hain.",
          "App install ka option bhi landing page par hai.",
        ],
        demonstrate: "Start hissa, 'Ask Skyline AI' button aur footer number markers (1,2,3) se dikhayein.",
        practice: "Page ke bilkul neeche footer tak jayein.",
        check: "Agar naya shakhs koi sawal poochna chahe to landing page par kaun si madad hai?",
        board: "Landing page ka naqsha: 1 Hero → 2 Orientation → 3 Who → 4 About → 5 Reviews → 6 Start → 7 Footer",
      },
    ],
    test: {
      questions: [
        { id: "q1", q: "Landing page ka maqsad kya hai?", expected: "Naye shakhs ko Skyline ka pehla taaruf dena / website ka darwaza." },
        { id: "q2", q: "Naye shakhs ko sab se pehle kya dikhana chahiye?", expected: "Free orientation (enrollment) video." },
        { id: "q3", q: "Kya koi website se khud join kar sakta hai?", expected: "Nahi, sirf official Skyline member ke zariye." },
        { id: "q4", q: "Login button kis ke liye hai?", expected: "Sirf Skyline members ke liye." },
        { id: "q5", q: "Real stories ke baare mein kya kabhi nahi kehna?", expected: "Income ki guarantee / pakki kamai ka wada." },
      ],
      practical: "Landing page par orientation video wala hissa dikhayein aur phir 'Ask Skyline AI' button tak pohanchein.",
    },
  },
  ...[
    "Login Process",
    "FBO Dashboard",
    "Skyline Achievers Working Method",
    "Prospecting",
    "Invitation Practice",
    "Follow-up",
    "Objection Handling",
    "Closing",
    "Final Assessment",
  ].map((title, i) => ({
    n: i + 2,
    title,
    ready: false,
    lessons: [] as Lesson[],
    test: { questions: [] as TestQuestion[], practical: "" },
  })),
];

export type ChapterRecord = { passed?: boolean; best?: number; attempts?: number; passedAt?: string };

export type TrainingRow = {
  current_chapter: number;
  current_lesson: number;
  current_stage: string;
  unlocked_chapter: number;
  status: string;
  chapters: Record<string, ChapterRecord>;
  remediation_count: number;
  final_passed: boolean;
  admin_completed: boolean;
  completed_at: string | null;
};

/** Lock stays until every chapter that exists today is passed (or an admin completes it). */
export function requiredDone(row: Pick<TrainingRow, "chapters" | "admin_completed" | "status">) {
  if (row.admin_completed || row.status === "complete") return true;
  return CHAPTERS.filter((c) => c.ready).every((c) => row.chapters?.[String(c.n)]?.passed);
}

export function chapterText(c: Chapter) {
  return [
    `CHAPTER ${c.n}: ${c.title}`,
    ...c.lessons.map(
      (l, i) =>
        `Lesson ${i} (${l.id}) ${l.title}\n Objective: ${l.objective}\n Facts: ${l.facts.join(" | ")}\n Demonstrate: ${l.demonstrate}\n Practice: ${l.practice}\n Check: ${l.check}${l.board ? `\n Whiteboard: ${l.board}` : ""}${l.open ? `\n Open route: ${l.open}` : ""}`,
    ),
    `CHAPTER TEST questions: ${c.test.questions.map((q) => `${q.id}: ${q.q} (expected: ${q.expected})`).join(" | ")}`,
    `CHAPTER TEST practical: ${c.test.practical}`,
  ].join("\n");
}
