/**
 * Related-topic search: the member does not need the exact title. We score every
 * item against the words they typed, allowing near-spellings, word stems and a
 * small map of topics that mean the same thing in this business.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "how",
  "video", "videos", "training", "ka", "ki", "ke", "wala", "wali",
]);

/** Words that should also match each other (both directions). */
const SYNONYM_GROUPS: string[][] = [
  ["prospect", "prospecting", "lead", "leads", "list", "contact", "contacts", "approach"],
  ["invite", "invitation", "inviting", "invitations", "invitee"],
  ["close", "closing", "objection", "objections", "handling", "convince"],
  ["follow", "followup", "followups", "reminder", "reconnect"],
  ["recruit", "recruiting", "recruitment", "enroll", "enrollment", "joining", "signup", "sponsor"],
  ["team", "teamwork", "downline", "upline", "group", "hierarchy", "duplication"],
  ["mindset", "motivation", "motivational", "attitude", "discipline", "belief", "confidence"],
  ["leader", "leadership", "mentor", "mentorship", "coaching", "guidance"],
  ["sale", "sales", "selling", "seller", "presentation", "pitch", "demo"],
  ["earning", "earnings", "income", "commission", "payout", "money", "bonus", "salary"],
  ["product", "products", "catalog", "package", "plan", "offer"],
  ["social", "whatsapp", "facebook", "instagram", "tiktok", "status", "message", "chat", "dm"],
  ["beginner", "beginners", "basic", "basics", "start", "starting", "starter", "new"],
  ["webinar", "session", "seminar", "meeting", "zoom", "live"],
  ["podcast", "audio", "interview", "talk"],
  ["goal", "goals", "target", "planning", "plan", "growth", "success"],
  ["customer", "client", "clients", "buyer", "consumer"],
  ["pdf", "document", "notes", "guide", "ebook", "script", "slide", "slides", "resource"],
];

const SYNONYMS = new Map<string, Set<string>>();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    const set = SYNONYMS.get(word) ?? new Set<string>();
    for (const other of group) if (other !== word) set.add(other);
    SYNONYMS.set(word, set);
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Very light stemming so "prospecting" and "prospect" line up. */
function stem(word: string): string {
  return word
    .replace(/(ings|ing|ers|er|ies|es|ed|s)$/u, "")
    .replace(/(.)\1$/u, "$1");
}

export function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

function distance(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i < rows; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

function tokenScore(query: string, candidate: string): number {
  if (query === candidate) return 1;
  const qs = stem(query);
  const cs = stem(candidate);
  if (qs === cs) return 0.92;
  if (candidate.startsWith(query) || query.startsWith(candidate)) return 0.85;
  if (candidate.includes(query) || query.includes(candidate)) return 0.7;
  if (SYNONYMS.get(query)?.has(candidate) || SYNONYMS.get(qs)?.has(cs)) return 0.66;
  const limit = Math.max(1, Math.floor(Math.max(qs.length, cs.length) / 4));
  const d = distance(qs, cs);
  if (d <= limit) return 0.6 - d * 0.08;
  return 0;
}

export type Scorable = {
  /** Weight per field: title matters most, body least. */
  fields: { text: string | null | undefined; weight: number }[];
};

/**
 * 0 means "not related". Anything above the threshold used by the caller is
 * shown, best match first.
 */
export function relevance(queryTokens: string[], item: Scorable): number {
  if (queryTokens.length === 0) return 0;
  let total = 0;
  for (const token of queryTokens) {
    let best = 0;
    for (const field of item.fields) {
      if (!field.text) continue;
      for (const word of tokenize(field.text)) {
        const score = tokenScore(token, word) * field.weight;
        if (score > best) best = score;
      }
      const whole = normalize(field.text);
      if (whole.includes(token)) best = Math.max(best, 0.75 * field.weight);
    }
    total += best;
  }
  return total / queryTokens.length;
}

/** Items scoring at least this are treated as related to the search. */
export const RELATED_THRESHOLD = 0.34;
