/**
 * Skyline AI — Website Guide (Phase 1).
 * Step content describes real, existing Skyline screens only. UI targets use
 * stable `data-ai-guide="…"` markers placed on real elements.
 * Progress is kept per signed-in account on this device.
 */
import { cacheOwnerId } from "@/lib/offline-cache";

export type GuideAudience = "all" | "member" | "trainee";
export type GuideRole = "member" | "trainee" | "none";

export type GuideStep = {
  id: string;
  title: string;
  /** Route to open before explaining (only when the account may use it). */
  route?: string;
  /** data-ai-guide marker to highlight on the page. */
  target?: string;
  audience: GuideAudience;
  where: string;
  what: string;
  why: string;
  canDo: string[];
  buttons?: string[];
  avoid?: string;
  /** Simple understanding check; answered and checked by Skyline AI. */
  question?: string;
};

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "platform", title: "Skyline Achievers — ye platform kya hai?", audience: "all",
    where: "Hum abhi Website Guide ke shuru mein hain.",
    what: "Skyline Achievers ek private learning, mentorship aur leadership community hai. Is ki philosophy hai: Learn • Earn • Lead.",
    why: "Taa ke sirf mobile phone aur internet se koi bhi step-by-step seekh kar aage barh sake.",
    canDo: ["Training videos dekhna", "Apni progress dekhna", "Upline se rabta rakhna", "Skyline AI se madad lena"],
    avoid: "Apna password, code ya private link kabhi kisi ko na dein.",
    question: "Skyline Achievers ki philosophy ke teen lafz kya hain?",
  },
  {
    id: "landing", title: "Landing Page", audience: "all",
    where: "Ye website ka pehla page hai jo login se pehle khulta hai.",
    what: "Yahan naya banda Skyline ke baare mein jaanta hai: free orientation video, 'Who is this for', 'How it works', real success stories aur Skyline AI.",
    why: "Naye log ko bina account ke samajh aa jaye ke Skyline kya hai.",
    canDo: ["Watch Free Orientation dabana", "Join Next Batch dekhna", "Ask Skyline AI se sawal poochna", "App install karna"],
    buttons: ["Upar chhota Login button — sirf members ke liye", "Install icon — app install karne ke liye"],
    avoid: "Login ho kar app kholne par landing page nahi aata — seedha aapki screen khulti hai.",
  },
  {
    id: "how", title: "Skyline kaise kaam karta hai", audience: "all",
    where: "Ye landing page ka 'How it works' hissa hai.",
    what: "Safar steps mein hota hai: orientation → onboarding → basic training → interview → Personal Mentorship → 2CC → Assistant Supervisor aur aagay ke ranks.",
    why: "Har level apne waqt par khulta hai, sab kuch ek saath nahi milta.",
    canDo: ["Apna agla step samajhna", "Senior se agle step ki guidance lena"],
    avoid: "Kisi bhi income ya fee ka andaza AI se na poochein — ye apne senior se poochein.",
    question: "Kya saare levels pehle din hi khul jate hain?",
  },
  {
    id: "login", title: "Member Login", audience: "all",
    where: "Ye landing page par Login button dabane se khulta hai.",
    what: "Yahan apni 12-digit ID aur password se login hota hai. Members ki ID 76 se shuru hoti hai, Beginners ka account apne portal mein jata hai.",
    why: "Taa ke har banda sirf apna account aur apni screens dekhe.",
    canDo: ["ID aur password se login", "Fingerprint / Face ID se login (agar Profile mein add kiya ho)"],
    avoid: "Apni ID aur password kisi ko na batayein.",
  },
  {
    id: "beginners", title: "Beginners Portal", audience: "trainee", route: "/beginners",
    where: "Ye Beginners Training ka apna dashboard hai.",
    what: "Yahan beginner apni journey, sessions aur progress dekhta hai.",
    why: "Naye log ke liye alag aasaan screen taa ke woh sirf zaroori cheezein dekhein.",
    canDo: ["Apna agla session dekhna", "Session code se session unlock karna", "Reels dekhna", "Skyline AI se poochna"],
    avoid: "Kisi aur ka session code use na karein.",
  },
  {
    id: "beginner-sessions", title: "Beginners Sessions", audience: "trainee", route: "/beginners",
    where: "Beginners Portal ke andar sessions ka hissa.",
    what: "Har session ek video hai. Senior se mila code dal kar session khulta hai, dekhne ke baad review form bharna hota hai.",
    why: "Taa ke training sahi tarteeb mein ho aur senior ko pata chale aapne kya seekha.",
    canDo: ["Code daal kar session kholna", "Video dekhna", "Review bhejna"],
    avoid: "Video skip na karein — review mein usi ke sawal hote hain.",
    question: "Session kholne ke liye kya chahiye hota hai?",
  },
  {
    id: "dashboard", title: "Home Dashboard", audience: "member", route: "/dashboard", target: "dashboard-profile",
    where: "Ab hum Home Dashboard par hain.",
    what: "Ye aapka main control center hai. Sabse upar aapki profile, photo aur rank (Level) dikhte hain. Neeche To-do List, Skyline AI aur Daily Report hain.",
    why: "Taa ke ek hi jagah se aap apna aaj ka kaam aur progress dekh sakein.",
    canDo: ["Apni rank dekhna", "Profile photo lagana", "To-do List kholna", "Daily Report bharna"],
    buttons: ["Upar teen lines wala Menu button — saare sections", "Ghanti — announcements"],
    question: "Home Dashboard ka basic purpose kya hai?",
  },
  {
    id: "training", title: "Training", audience: "member", route: "/training", target: "page-content",
    where: "Ab hum Training section mein hain.",
    what: "Yahan aapki rank ke mutabiq training videos categories mein milti hain, aur search bhi hai.",
    why: "Basic training se buniyad mazboot hoti hai, phir aage ki cheezein khulti hain.",
    canDo: ["Category khol kar video dekhna", "Video search karna", "Apni progress continue karna"],
    avoid: "Training ko jaldi jaldi skip na karein.",
    question: "Training section mein kya milta hai?",
  },
  {
    id: "courses", title: "Premium Courses", audience: "member", route: "/courses", target: "page-content",
    where: "Ye Premium Courses section hai.",
    what: "Yahan alag courses aur un ke lectures hain.",
    why: "Extra skills seekhne ke liye.",
    canDo: ["Course kholna", "Lectures dekhna"],
    avoid: "Kisi course ki qeemat ke liye apne senior se baat karein.",
  },
  {
    id: "sessions-manager", title: "Beginners Sessions Manager", audience: "member", route: "/sessions", target: "page-content",
    where: "Ye Beginners Sessions section hai — naye log ke liye sessions.",
    what: "Yahan har beginner session ka link aur code hota hai jo aap apne naye banday ko bhejte hain. Open se session app ke andar khulta hai.",
    why: "Taa ke aap naye log ko sahi session sahi waqt par bhej sakein.",
    canDo: ["Copy link", "Copy code", "Open se session khud dekhna"],
    avoid: "Code sirf us banday ko dein jise aap khud guide kar rahe hain.",
    question: "Naye banday ko session bhejne ke liye aap kya copy karte hain?",
  },
  {
    id: "team", title: "Team Tree", audience: "member", route: "/team", target: "page-content",
    where: "Ye Team Tree hai.",
    what: "Yahan aapki team ka dhancha (kaun kis ke neeche hai) dikhta hai.",
    why: "Taa ke aap apni team ko samajh kar sahi guidance de sakein.",
    canDo: ["Apni team dekhna", "Team members ki progress samajhna"],
  },
  {
    id: "seats", title: "Seat Reservation", audience: "member", route: "/seats", target: "page-content",
    where: "Ye Seat Reservation section hai.",
    what: "Yahan sessions aur interviews ke liye seat book hoti hai.",
    why: "Taa ke har session mein jagah pehle se tay ho.",
    canDo: ["Seat reserve karna", "Apni reservations dekhna"],
  },
  {
    id: "ai", title: "Skyline Achievers AI", audience: "all", route: "/ai", target: "page-content",
    where: "Ye Skyline Achievers AI hai — yahi jahan ye Guide bhi hai.",
    what: "Yahan aap apne sawal likh ya picture bhej kar pooch sakte hain. Har chat aapke account mein save rehti hai.",
    why: "Taa ke chhote sawal ke liye har baar upline ko pareshan na karna pare.",
    canDo: ["New chat", "Purani chat kholna", "Picture bhejna", "Website Guide chalana"],
    avoid: "AI fees ya income ke sawal ka jawab nahi deta — woh senior se poochein.",
  },
  {
    id: "growth", title: "Skyline Growth Executive", audience: "member", route: "/assistants", target: "page-content",
    where: "Ye Skyline Growth Executive section hai.",
    what: "Yahan FBO apne Growth Executive (assistant) ko manage karta hai aur leads (Excel/CSV) upload karta hai.",
    why: "Taa ke aap ka waqt bache aur leads par kaam aapka executive kare.",
    canDo: ["Leads file upload", "Executive ka kaam dekhna"],
    avoid: "Har FBO ka data alag rehta hai — kisi aur ki leads share na karein.",
  },
  {
    id: "reels", title: "Reels", audience: "member", route: "/reels", target: "page-content",
    where: "Ye Reels section hai.",
    what: "Yahan Skyline ki chhoti motivational aur learning videos hain.",
    why: "Roz motivation aur chhoti learning ke liye.",
    canDo: ["Reels dekhna", "Apni reel upload (agar allowed ho)"],
  },
  {
    id: "chat", title: "Messages", audience: "member", route: "/chat", target: "page-content",
    where: "Ye Messages section hai.",
    what: "Yahan aap apne upline se baat karte hain.",
    why: "Taa ke guidance aur sawal ek hi jagah rahein.",
    canDo: ["Upline ko message bhejna"],
    avoid: "Password ya code chat mein na bhejein.",
  },
  {
    id: "resources", title: "Files & Resources", audience: "member", route: "/resources", target: "page-content",
    where: "Ye Files & Resources section hai.",
    what: "Yahan kaam ki files, documents aur material type aur category ke hisaab se milte hain.",
    why: "Taa ke zaroori material dhoondhna na pare.",
    canDo: ["File kholna", "Category se dhoondhna"],
  },
  {
    id: "search", title: "Search", audience: "member", route: "/search", target: "page-content",
    where: "Ye Search hai.",
    what: "Yahan likh kar videos aur content dhoondh sakte hain.",
    why: "Jaldi cheez dhoondhne ke liye.",
    canDo: ["Lafz likh kar search karna"],
  },
  {
    id: "profile", title: "My Profile", audience: "member", route: "/profile", target: "page-content",
    where: "Ye My Profile hai.",
    what: "Yahan aap apna naam, photo, password aur Fingerprint / Face ID login set karte hain.",
    why: "Taa ke account mehfooz rahe aur login aasaan ho.",
    canDo: ["Naam/photo badalna", "Password badalna", "Add this device (fingerprint)"],
    avoid: "Default password jaldi badal lein.",
  },
  {
    id: "notifications", title: "Notifications", audience: "member", route: "/notifications", target: "notifications-button",
    where: "Ye Notifications (ghanti) hai.",
    what: "Yahan Skyline ke announcements aur updates aate hain. Ghanti par number = naye messages.",
    why: "Taa ke koi zaroori update miss na ho.",
    canDo: ["Announcements parhna"],
  },
  {
    id: "todo", title: "To-Do List", audience: "member", route: "/todo", target: "page-content",
    where: "Ye To-Do List hai.",
    what: "Yahan aaj ke kaam ki list hoti hai jise aap tick karte jate hain.",
    why: "Taa ke rozana kaam ka plan saaf rahe.",
    canDo: ["Kaam add karna", "Kaam complete mark karna"],
  },
  {
    id: "leave", title: "Leave Application", audience: "member", route: "/leave", target: "page-content",
    where: "Ye Leave Application hai.",
    what: "Agar aap kisi din kaam nahi kar sakte to yahan chhutti ki darkhwast bhejte hain.",
    why: "Taa ke upline ko pehle se pata ho.",
    canDo: ["Leave request bhejna"],
  },
  {
    id: "daily-report", title: "Daily Report", audience: "member", route: "/dashboard", target: "daily-report",
    where: "Ab hum Home Dashboard par Daily Report wale hisse mein hain.",
    what: "Daily Report mein aap apni daily working enter karte hain, jaise calling, prospects aur follow-ups. Report ka PDF download aur share bhi hota hai.",
    why: "Taa ke aap aur aap ka senior roz ki progress dekh sakein.",
    canDo: ["Aaj ki report bharna", "Purani reports dekhna", "PDF download / Share"],
    avoid: "Ghalat numbers na likhein — sach report hi aap ki asli progress hai.",
    question: "Daily Report mein aap kya enter karte hain?",
  },
  {
    id: "workflow", title: "Overall workflow — ab aage kya karna hai", audience: "all",
    where: "Tour ka aakhri step.",
    what: "Roz ka simple routine: 1) Dashboard kholein, 2) To-do List dekhein, 3) Training video dekhein, 4) apna kaam karein, 5) Daily Report bharein, 6) sawal ho to Skyline AI ya upline se poochein.",
    why: "Roz ka chhota kaam hi bari progress banata hai.",
    canDo: ["Kal se ye routine shuru karna"],
    question: "Din ke aakhir mein kaunsi report bharni hoti hai?",
  },
];

export type GuideProgress = {
  active: boolean;
  paused: boolean;
  stepIndex: number;
  completed: string[];
  role: GuideRole;
  updatedAt: string;
};

const EVENT = "skyline-ai-guide-change";
const keyFor = () => `skyline-ai-guide:${cacheOwnerId()}`;

export function readGuide(): GuideProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(keyFor());
    return raw ? (JSON.parse(raw) as GuideProgress) : null;
  } catch {
    return null;
  }
}

export function writeGuide(next: GuideProgress | null) {
  try {
    if (next) localStorage.setItem(keyFor(), JSON.stringify({ ...next, updatedAt: new Date().toISOString() }));
    else localStorage.removeItem(keyFor());
  } catch { /* storage full or blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeGuide(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function stepAllowed(step: GuideStep, role: GuideRole) {
  return step.audience === "all" || step.audience === role;
}

/** Plain-text context of a step, sent to Skyline AI for questions. */
export function stepContext(step: GuideStep) {
  return [step.where, step.what, `Kyun: ${step.why}`, `Kya kar sakte hain: ${step.canDo.join(", ")}`,
    step.buttons ? `Buttons: ${step.buttons.join(", ")}` : "", step.avoid ? `Ehtiyat: ${step.avoid}` : ""]
    .filter(Boolean).join("\n");
}

/** Phase 2 hooks: a voice layer can subscribe to step events here. */
export type GuideEvent = { type: "step-enter" | "question" | "answer-result"; step: GuideStep; text?: string; correct?: boolean };
const listeners = new Set<(e: GuideEvent) => void>();
export function onGuideEvent(fn: (e: GuideEvent) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function emitGuideEvent(e: GuideEvent) { listeners.forEach((fn) => fn(e)); }
