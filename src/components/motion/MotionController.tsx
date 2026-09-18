import { useEffect } from "react";

const REVEAL_SELECTOR = [
  "[data-reveal]",
  ".motion-scope h1",
  ".motion-scope h2",
  ".motion-scope article",
  ".motion-scope .raised-panel",
  ".motion-scope .glass-panel",
].join(",");

export function MotionController() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = (element: Element) => element.classList.add("motion-visible");
    const prepare = (root: ParentNode) => {
      root.querySelectorAll(REVEAL_SELECTOR).forEach((element, index) => {
        if (element.classList.contains("motion-ready")) return;
        element.classList.add("motion-ready");
        if (element instanceof HTMLElement && !element.style.getPropertyValue("--motion-order")) {
          element.style.setProperty("--motion-order", String(index % 6));
        }
        if (reduceMotion) reveal(element);
        else observer.observe(element);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 },
    );

    let frame = 0;
    const updateScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        document.documentElement.style.setProperty("--scroll-progress", String(window.scrollY / max));
        document.documentElement.classList.toggle("is-scrolled", window.scrollY > 24);
        frame = 0;
      });
    };

    prepare(document);
    const mutations = new MutationObserver(() => prepare(document));
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", updateScroll, { passive: true });
    updateScroll();

    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("scroll", updateScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div className="cinematic-progress" aria-hidden />;
}