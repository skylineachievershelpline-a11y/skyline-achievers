import { useCallback, useEffect, useRef, useState } from "react";

import themeOffVoice from "@/assets/theme-off.mp3.asset.json";
import themeOnVoice from "@/assets/theme-on.mp3.asset.json";
import { useTheme } from "@/hooks/useTheme";
import { setTheme, themeHaptic, type Theme } from "@/lib/theme";
const DRAG_DISTANCE = 48;

function playThemeVoice(next: Theme) {
  try {
    const audio = new Audio(next === "dark" ? themeOnVoice.url : themeOffVoice.url);
    audio.volume = 0.82;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* browsers may block sound until the first tap; silence is fine */
    });
  } catch {
    /* sound is a bonus, never required */
  }
}

/** Reference-style ON/OFF switch: down turns the dark look on; up turns it off. */
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
    playThemeVoice(next);
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

  return (
    <div className="theme-curve-switch" aria-hidden={false}>
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
        style={{ "--theme-switch-progress": progress } as React.CSSProperties}
        aria-pressed={theme === "dark"}
        aria-label={
          theme === "light"
            ? "Light appearance. Slide down to turn dark mode on."
            : "Dark appearance. Slide up to turn dark mode off."
        }
        title="Slide down for dark, up for light"
      >
        <span className="theme-switch-label theme-switch-label-off" aria-hidden>OFF</span>
        <span className="theme-switch-label theme-switch-label-on" aria-hidden>ON</span>
        <span className="theme-switch-thumb" aria-hidden>
          <span className="theme-switch-thumb-glint" />
        </span>
      </button>
      <span className="theme-switch-dots" aria-hidden>
        {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
      </span>
    </div>
  );
}
