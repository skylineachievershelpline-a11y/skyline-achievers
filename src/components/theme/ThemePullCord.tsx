import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import cardSlideSound from "@/assets/card-slide.mp3.asset.json";
import { useTheme } from "@/hooks/useTheme";
import { setTheme, themeHaptic, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Rest length of the cord, and how far it may stretch either way. */
const REST = 30;
const MAX_DOWN = 52;
const MAX_UP = 26;
/** How far you must move before the pull counts as a decision. */
const COMMIT = 16;

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
 * A hanging glass bead on the right edge of every screen.
 * Pull it down for the midnight look, lift it up for the porcelain look,
 * or simply tap it to swap. The new look floods out from the bead.
 */
export function ThemePullCord() {
  const { theme } = useTheme();
  const beadRef = useRef<HTMLButtonElement>(null);
  const dragStart = useRef<number | null>(null);
  const moved = useRef(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const apply = useCallback((next: Theme) => {
    const rect = beadRef.current?.getBoundingClientRect();
    const origin = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : undefined;
    setTheme(next, origin);
    themeHaptic();
    playClick();
  }, []);

  const finish = useCallback(
    (distance: number) => {
      const current: Theme = document.documentElement.classList.contains("theme-light")
        ? "light"
        : "dark";
      if (distance > COMMIT) {
        if (current !== "dark") apply("dark");
      } else if (distance < -COMMIT) {
        if (current !== "light") apply("light");
      } else if (!moved.current) {
        apply(current === "light" ? "dark" : "light");
      }
      setOffset(0);
      setDragging(false);
      dragStart.current = null;
    },
    [apply],
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      if (dragStart.current === null) return;
      const delta = event.clientY - dragStart.current;
      if (Math.abs(delta) > 4) moved.current = true;
      setOffset(Math.max(-MAX_UP, Math.min(MAX_DOWN, delta)));
    };
    const onUp = (event: PointerEvent) => {
      const delta = dragStart.current === null ? 0 : event.clientY - dragStart.current;
      finish(Math.max(-MAX_UP, Math.min(MAX_DOWN, delta)));
    };
    const onCancel = () => finish(0);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [dragging, finish]);

  const hint = offset > COMMIT ? "Dark" : offset < -COMMIT ? "Light" : null;

  return (
    <div className="theme-cord" aria-hidden={false}>
      <span className="theme-cord-anchor" aria-hidden />
      <span
        className="theme-cord-line"
        style={{ height: `${REST + offset}px` }}
        aria-hidden
      />
      <button
        ref={beadRef}
        type="button"
        onPointerDown={(event) => {
          if (event.button !== 0 && event.pointerType === "mouse") return;
          dragStart.current = event.clientY;
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
          // A real drag already decided; a plain click still toggles.
          if (moved.current) event.preventDefault();
        }}
        className={cn("theme-cord-bead", dragging && "is-dragging")}
        style={{ transform: `translateY(${offset}px)` }}
        aria-label={
          theme === "light"
            ? "Appearance: light. Pull down for the dark look."
            : "Appearance: dark. Lift up for the light look."
        }
        title="Pull down for dark, lift up for light"
      >
        {theme === "light" ? (
          <Sun className="h-4 w-4" strokeWidth={2.4} />
        ) : (
          <Moon className="h-4 w-4" strokeWidth={2.4} />
        )}
      </button>
      {hint ? <span className="theme-cord-hint">{hint}</span> : null}
    </div>
  );
}
