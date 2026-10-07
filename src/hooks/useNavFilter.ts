import { useEffect, type RefObject } from "react";

/** Hides sidebar entries whose visible text does not match the search query. */
export function useNavFilter(ref: RefObject<HTMLElement | null>, query: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const q = query.trim().toLowerCase();
    const items = Array.from(el.querySelectorAll<HTMLElement>("a, button"));
    for (const item of items) {
      const match = !q || (item.textContent ?? "").toLowerCase().includes(q);
      item.style.display = match ? "" : "none";
    }
    if (q) el.scrollTop = 0;
  }, [ref, query]);
}
