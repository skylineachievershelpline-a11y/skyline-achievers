/** Server-only access to mandatory training progress (service-role tables). */
import { CHAPTERS, LOCKED_RANK_ORDERS, PASS_PERCENT, requiredDone, type TrainingRow } from "@/lib/training/curriculum";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function rankOrderFor(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("member_profiles")
    .select("status, levels:level_id (rank_order)")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  return Number((data.levels as { rank_order?: number } | null)?.rank_order ?? 0);
}

export async function loadTraining(userId: string): Promise<TrainingRow> {
  const db = await admin();
  const { data } = await db.from("fbo_training").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as unknown as TrainingRow;
  const { data: created, error } = await db
    .from("fbo_training")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw new Error("Training progress could not be loaded.");
  return created as unknown as TrainingRow;
}

export async function trainingStatus(userId: string) {
  const rank = await rankOrderFor(userId);
  const required = rank !== null && LOCKED_RANK_ORDERS.includes(rank);
  const row = await loadTraining(userId);
  return { required, locked: required && !requiredDone(row), row };
}

export async function savePosition(userId: string, pos: { chapter: number; lesson: number; stage: string }) {
  const db = await admin();
  const row = await loadTraining(userId);
  if (pos.chapter > row.unlocked_chapter) throw new Error("Chapter locked");
  await db
    .from("fbo_training")
    .update({
      current_chapter: pos.chapter,
      current_lesson: pos.lesson,
      current_stage: pos.stage,
      last_position: { ...pos, at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

/** Scores a chapter test on the server: pass needs PASS_PERCENT and the practical task. */
export async function recordTest(
  userId: string,
  input: { chapter: number; answers: { id: string; correct: boolean; note: string | null }[]; practical_passed: boolean },
) {
  const chapter = CHAPTERS.find((c) => c.n === input.chapter && c.ready);
  if (!chapter) throw new Error("Unknown chapter");
  const row = await loadTraining(userId);
  if (input.chapter > row.unlocked_chapter) throw new Error("Chapter locked");
  const valid = new Set(chapter.test.questions.map((q) => q.id));
  const graded = new Map(input.answers.filter((a) => valid.has(a.id)).map((a) => [a.id, a.correct]));
  const correct = chapter.test.questions.filter((q) => graded.get(q.id)).length;
  const score = Math.round((correct / Math.max(1, chapter.test.questions.length)) * 100);
  const passed = score >= PASS_PERCENT && input.practical_passed;
  const db = await admin();
  await db.from("fbo_training_attempts").insert({
    user_id: userId,
    chapter: input.chapter,
    kind: "test",
    score,
    passed,
    detail: { answers: input.answers, practical_passed: input.practical_passed },
  });
  const prev = row.chapters?.[String(input.chapter)] ?? {};
  const chapters = {
    ...row.chapters,
    [String(input.chapter)]: {
      passed: Boolean(prev.passed) || passed,
      best: Math.max(prev.best ?? 0, score),
      attempts: (prev.attempts ?? 0) + 1,
      ...(passed && !prev.passed ? { passedAt: new Date().toISOString() } : prev.passedAt ? { passedAt: prev.passedAt } : {}),
    },
  };
  const nextChapter = passed ? Math.min(input.chapter + 1, CHAPTERS.length) : input.chapter;
  const final = passed && input.chapter === CHAPTERS.length;
  await db
    .from("fbo_training")
    .update({
      chapters,
      unlocked_chapter: Math.max(row.unlocked_chapter, nextChapter),
      current_chapter: nextChapter,
      current_lesson: passed ? 0 : row.current_lesson,
      current_stage: passed ? "INTRO" : "REMEDIATE",
      remediation_count: row.remediation_count + (passed ? 0 : 1),
      ...(final ? { final_passed: true, status: "complete", completed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return { score, passed, correct, total: chapter.test.questions.length, nextChapterReady: Boolean(CHAPTERS.find((c) => c.n === nextChapter)?.ready) };
}
