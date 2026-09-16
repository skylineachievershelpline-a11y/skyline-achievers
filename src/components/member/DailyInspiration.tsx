import { useQuery } from "@tanstack/react-query";
import { BookOpenText, Moon, Sun, Sunset } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type Part = "morning" | "evening" | "night";

function currentPart(hour: number): Part {
  if (hour >= 5 && hour < 16) return "morning";
  if (hour >= 16 && hour < 20) return "evening";
  return "night";
}

const PART_LABEL: Record<Part, { label: string; icon: typeof Sun }> = {
  morning: { label: "Morning reflection", icon: Sun },
  evening: { label: "Evening reflection", icon: Sunset },
  night: { label: "Night reflection", icon: Moon },
};

function dayIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Shows one Quran verse and one hadees, rotating every day and changing with
 * the time of day. Content comes from the admin-managed collection.
 */
export function DailyInspiration() {
  const part = currentPart(new Date().getHours());

  const { data } = useQuery({
    queryKey: ["daily-inspiration", part],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_inspirations")
        .select("id, kind, text_en, text_ur, reference")
        .eq("part_of_day", part)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const rows = data ?? [];
  if (rows.length === 0) return null;

  const pick = (kind: "ayat" | "hadees") => {
    const list = rows.filter((row) => row.kind === kind);
    if (list.length === 0) return null;
    return list[dayIndex() % list.length]!;
  };

  const ayat = pick("ayat");
  const hadees = pick("hadees");
  const { label, icon: Icon } = PART_LABEL[part];

  return (
    <section className="glass-panel metal-edge relative overflow-hidden rounded-2xl p-6 animate-rise-in">
      <div className="connector-line absolute inset-y-6 left-0 w-1" aria-hidden />
      <div className="relative flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-brand-glow">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>

      <div className="relative mt-4 grid gap-4 sm:grid-cols-2">
        {ayat ? <Quote badge="Quran" row={ayat} /> : null}
        {hadees ? <Quote badge="Hadees" row={hadees} /> : null}
      </div>
    </section>
  );
}

function Quote({
  badge,
  row,
}: {
  badge: string;
  row: { text_en: string | null; text_ur: string | null; reference: string | null };
}) {
  return (
    <div className="inset-panel rounded-xl p-4">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <BookOpenText className="h-3 w-3" />
        {badge}
      </span>
      {row.text_ur ? (
        <p dir="rtl" className="mt-3 text-base leading-8 text-foreground">
          {row.text_ur}
        </p>
      ) : null}
      {row.text_en ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{row.text_en}</p>
      ) : null}
      {row.reference ? (
        <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-brand-glow">
          {row.reference}
        </p>
      ) : null}
    </div>
  );
}
