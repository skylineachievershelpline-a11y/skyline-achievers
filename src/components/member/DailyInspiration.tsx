import { useQuery } from "@tanstack/react-query";
import { BookOpenText, ChevronDown, Clock3, Moon, Sun, Sunset } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Part = "morning" | "evening" | "night";

function currentPart(hour: number): Part {
  if (hour >= 5 && hour < 13) return "morning";
  if (hour >= 13 && hour < 19) return "evening";
  return "night";
}

const PART_LABEL: Record<Part, { label: string; icon: typeof Sun }> = {
  morning: { label: "Morning inspiration", icon: Sun },
  evening: { label: "1 PM inspiration", icon: Sunset },
  night: { label: "7 PM inspiration", icon: Moon },
};

function rotationIndex(weekly: boolean): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return weekly ? Math.floor(days / 7) : days;
}

export function DailyInspiration() {
  const part = currentPart(new Date().getHours());
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery({
    queryKey: ["daily-inspiration", part],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_inspirations")
        .select("id, kind, text_en, text_ur, reference, schedule_type, sort_order")
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
  const weekly = rows.filter((row) => row.schedule_type === "weekly");
  const pool = weekly.length > 0 ? weekly : rows.filter((row) => row.schedule_type !== "weekly");
  const row = pool[rotationIndex(weekly.length > 0) % pool.length];
  if (!row) return null;
  const { label, icon: Icon } = PART_LABEL[part];
  const badge = row.kind === "ayat" ? "Quran Ayat" : row.kind === "hadees" ? "Hadees" : "Quote";

  return (
    <section className="space-y-3 font-achiever animate-rise-in">
      <div className="flex items-end justify-between gap-3 px-1">
        <h2 className="font-achiever-display text-[10px] font-bold uppercase text-muted-foreground">Daily inspiration</h2>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan/20 bg-surface-2 px-2 py-1 text-[10px] font-bold text-cyan">
          <Icon className="h-3 w-3" /> {label}
        </span>
      </div>
      <div className="metal-edge relative overflow-hidden rounded-2xl border border-cyan/15 bg-surface-2 p-6 shadow-lift sm:p-7">
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase text-cyan">
            <BookOpenText className="h-3.5 w-3.5" /> {badge}
            {row.schedule_type === "weekly" ? " • This week" : ""}
          </span>
          {row.text_ur ? <p dir="rtl" className="mt-4 font-achiever-display text-lg font-bold leading-9 text-foreground">{row.text_ur}</p> : null}
          {row.reference ? (
            <div className="mt-5 flex items-center gap-3">
              <span className="h-0.5 w-8 bg-cyan" />
              <span className="text-[11px] font-bold uppercase text-muted-foreground">{row.reference}</span>
            </div>
          ) : null}
          {row.text_en ? (
            <div className="mt-4 border-t border-hairline pt-3">
              <Button type="button" variant="ghost" size="sm" className="h-8 px-0 text-cyan" onClick={() => setExpanded((value) => !value)}>
                {expanded ? "Hide translation" : "Open translation"}
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </Button>
              {expanded ? <p className="mt-2 text-sm leading-6 text-muted-foreground animate-rise-in">{row.text_en}</p> : null}
            </div>
          ) : null}
          <Clock3 className="absolute right-0 top-0 h-5 w-5 text-muted-foreground/40" />
        </div>
      </div>
    </section>
  );
}