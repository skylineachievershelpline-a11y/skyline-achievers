import { Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import cardSlideSound from "@/assets/card-slide.mp3.asset.json";
import { useTheme } from "@/hooks/useTheme";
import { setTheme, themeHaptic, type Theme } from "@/lib/theme";
const DRAG_DISTANCE = 92;

function playClick() {
  try {
    const audio = new Audio(cardSlideSound.url);
    audio.volume = 0.32;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* browsers may block sound until the first tap; silence is fine */
    });
  } catch {
    /* sound is a bonus, never required */
  }
}

/**
 * Curved glass appearance switch matching the supplied reference: the
 * capsule rests at the top of its rail in light mode and travels around the
 * rounded corner into the lower position for dark mode.
 */
export function ThemePullCord() {
  const { theme } = useTheme();
  const beadRef = useRef<HTMLButtonElement>(null);
  const dragStart = useRef<number | null>(null);
  const progressStart = useRef(0);
  const moved = useRef(false);
  const [progress, setProgress] = useState(theme === "dark" ? 1 : 0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) setProgress(theme === "dark" ? 1 : 0);
  }, [dragging, theme]);

  const apply = useCallback((next: Theme) => {
    const rect = beadRef.current?.getBoundingClientRect();
    const origin = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : undefined;
    setTheme(next, origin);
    themeHaptic();
    playClick();
  }, []);

  const finish = useCallback(() => {
    const next: Theme = moved.current
      ? progress >= 0.5
        ? "dark"
        : "light"
      : theme === "light"
        ? "dark"
        : "light";
    const nextProgress = next === "dark" ? 1 : 0;
    setProgress(nextProgress);
    setDragging(false);
    dragStart.current = null;
    if (next !== theme) apply(next);
  }, [apply, progress, theme]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      if (dragStart.current === null) return;
      const delta = event.clientY - dragStart.current;
      if (Math.abs(delta) > 4) moved.current = true;
      setProgress(Math.max(0, Math.min(1, progressStart.current + delta / DRAG_DISTANCE)));
    };
    const onUp = () => finish();
    const onCancel = () => {
      setProgress(theme === "dark" ? 1 : 0);
      setDragging(false);
      dragStart.current = null;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [dragging, finish, theme]);

  const angle = -Math.PI / 2 + progress * (Math.PI / 2);
  const x = 42 + 42 * Math.cos(angle) - 22;
  const y = 48 + 42 * Math.sin(angle) - 26;

  return (
    <div className="theme-curve-switch" aria-hidden={false}>
      <span className="theme-curve-rail" aria-hidden />
      <span className="theme-curve-trail" aria-hidden />
      <button
        ref={beadRef}
        type="button"
        onPointerDown={(event) => {
          if (event.button !== 0 && event.pointerType === "mouse") return;
          dragStart.current = event.clientY;
          progressStart.current = progress;
          moved.current = false;
          setDragging(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            apply("light");
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            apply("dark");
          }
        }}
        onClick={(event) => {
          if (moved.current) event.preventDefault();
        }}
        className={`theme-curve-knob${dragging ? " is-dragging" : ""}`}
        style={{ transform: `translate3d(${x}px, ${y}px, 0) rotate(${progress * 8}deg)` }}
        aria-label={
          theme === "light"
            ? "Light appearance. Drag down for dark."
            : "Dark appearance. Drag up for light."
        }
        title="Drag down for dark, up for light"
      >
        <span className="theme-curve-glint" aria-hidden />
        <Sun className="theme-curve-icon" strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}
