/**
 * GuideHighlightManager + GuideInteractionManager.
 * Elements are found only through stable data-ai-guide markers.
 */
export const GUIDE_CARD_ATTR = "data-ai-guide-card";

export function findGuideElement(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-ai-guide="${target}"]`);
}

/** Glow + pulse on the exact element; returns a cleanup. */
export function highlightElement(target: string, opts: { scroll?: boolean; strong?: boolean } = {}) {
  const el = findGuideElement(target);
  if (!el) return () => {};
  el.classList.add("ai-guide-highlight");
  if (opts.strong) el.classList.add("ai-guide-highlight-strong");
  if (opts.scroll !== false) el.scrollIntoView({ behavior: "smooth", block: "center" });
  return () => el.classList.remove("ai-guide-highlight", "ai-guide-highlight-strong");
}

/**
 * Waits for the user to click the exact element. Wrong clicks on the page are
 * blocked (nothing happens) and reported, so the user is never moved somewhere
 * unexpected. The guide never clicks on the user's behalf.
 */
export function watchGuidedClick(target: string, handlers: { onCorrect: () => void; onWrong: () => void }) {
  const listener = (event: MouseEvent) => {
    const node = event.target as HTMLElement | null;
    if (!node) return;
    if (node.closest(`[${GUIDE_CARD_ATTR}]`)) return;
    if (node.closest(`[data-ai-guide="${target}"]`)) { handlers.onCorrect(); return; }
    event.preventDefault();
    event.stopPropagation();
    handlers.onWrong();
  };
  document.addEventListener("click", listener, true);
  return () => document.removeEventListener("click", listener, true);
}
