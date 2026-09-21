import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type MessageRow = {
  id: string;
  thread_id: string;
  user_id: string;
  parts: unknown;
  created_at: string;
};

function extractText(parts: unknown) {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (part && typeof part === "object" && (part as { type?: string }).type === "text") {
        const value = (part as { text?: unknown }).text;
        return typeof value === "string" ? value : "";
      }
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "the", "and", "for", "you", "your", "with", "that", "this", "what", "how", "can", "will", "are",
  "kya", "kia", "hai", "hain", "ka", "ki", "ke", "ko", "ma", "me", "mein", "main", "mera", "meri",
  "ap", "apna", "apni", "bro", "yar", "nhi", "nahi", "ni", "to", "ho", "hoga", "kar", "karna",
  "karo", "kro", "kasy", "kaise", "kese", "wo", "ye", "ya", "bhi", "sy", "se", "par", "py", "ak",
  "aik", "koi", "agr", "agar", "mtlb", "phr", "phir",
]);

export const adminGetAiQuestions = createServerFn({ method: "POST" })
  .inputValidator((data: { search?: string; days?: number } | undefined) =>
    z
      .object({
        search: z.string().trim().max(80).optional(),
        days: z.number().int().min(1).max(365).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-session.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const days = data.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("ai_messages")
      .select("id, thread_id, user_id, parts, created_at")
      .eq("role", "user")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);

    const messages = (rows ?? []) as MessageRow[];
    const userIds = Array.from(new Set(messages.map((row) => row.user_id)));

    const [{ data: members }, { data: trainees }] = await Promise.all([
      userIds.length
        ? supabaseAdmin
            .from("member_profiles")
            .select("id, full_name, member_id, levels:level_id(name)")
            .in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? supabaseAdmin.from("trainees").select("id, full_name, trainee_code").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const who = new Map<string, { name: string; access: string }>();
    for (const row of (trainees ?? []) as any[]) {
      who.set(row.id, { name: row.full_name ?? "Trainee", access: "Beginners Training" });
    }
    for (const row of (members ?? []) as any[]) {
      who.set(row.id, {
        name: row.full_name ?? "Member",
        access: row.levels?.name ?? "Member",
      });
    }

    const search = data.search?.toLowerCase() ?? "";
    const questions: {
      id: string;
      text: string;
      createdAt: string;
      name: string;
      access: string;
    }[] = [];
    const topicCounts = new Map<string, number>();
    const accessCounts = new Map<string, number>();

    for (const row of messages) {
      const text = extractText(row.parts);
      if (!text) continue;
      const identity = who.get(row.user_id) ?? { name: "Account", access: "Unknown" };

      for (const word of text.toLowerCase().match(/[a-z\u0600-\u06FF]{3,}/g) ?? []) {
        if (STOP_WORDS.has(word)) continue;
        topicCounts.set(word, (topicCounts.get(word) ?? 0) + 1);
      }
      accessCounts.set(identity.access, (accessCounts.get(identity.access) ?? 0) + 1);

      if (search && !text.toLowerCase().includes(search)) continue;
      questions.push({
        id: row.id,
        text,
        createdAt: row.created_at,
        name: identity.name,
        access: identity.access,
      });
    }

    const topTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([topic, count]) => ({ topic, count }));
    const byAccess = Array.from(accessCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([access, count]) => ({ access, count }));

    return {
      days,
      total: messages.length,
      people: userIds.length,
      questions: questions.slice(0, 400),
      topTopics,
      byAccess,
    };
  });
