/**
 * Skyline Achievers appearance engine.
 *
 * The platform ships two complete looks that share one token set:
 *  - "dark"  — the signature midnight-navy cinematic look (the default).
 *  - "light" — a soft porcelain / ice-blue 3D look.
 *
 * Every colour lives in src/styles.css. Switching the look only toggles the
 * `theme-light` class on <html>, so every page, dashboard, card, chart and
 * form follows automatically. Never hardcode a colour in a component.
 */

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "skyline-theme";
export const THEME_EVENT = "skyline-theme-change";

const THEME_COLOR: Record<Theme, string> = {
  dark: "#07090f",
  light: "#eef3fb",
};

/** Inlined in the document head so the first paint already has the right look. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t="dark"}var r=document.documentElement;r.classList.toggle("theme-light",t==="light");r.style.colorScheme=t;}catch(e){}})();`;

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* private mode — fall back to the default look */
  }
  return "dark";
}

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("theme-light") ? "light" : "dark";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function commit(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("theme-light", theme === "light");
  root.style.colorScheme = theme;

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[theme]);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storing the choice is optional */
  }

  window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }));
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

/**
 * Applies a look. When an origin point is given the new look floods outwards
 * from that point as a circular wave instead of flicking over instantly.
 */
export function setTheme(theme: Theme, origin?: { x: number; y: number }) {
  if (typeof document === "undefined") return;

  const doc = document as ViewTransitionDocument;
  const canAnimate =
    Boolean(origin) && typeof doc.startViewTransition === "function" && !prefersReducedMotion();

  if (!canAnimate || !origin) {
    commit(theme);
    return;
  }

  const root = document.documentElement;
  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );
  root.style.setProperty("--theme-reveal-x", `${origin.x}px`);
  root.style.setProperty("--theme-reveal-y", `${origin.y}px`);
  root.style.setProperty("--theme-reveal-r", `${Math.ceil(radius)}px`);
  root.classList.add("theme-switching");

  const transition = doc.startViewTransition!(() => commit(theme));
  void transition.finished.finally(() => {
    root.classList.remove("theme-switching");
  });
}

export function toggleTheme(origin?: { x: number; y: number }): Theme {
  const next: Theme = currentTheme() === "light" ? "dark" : "light";
  setTheme(next, origin);
  return next;
}

/** A short, soft tap felt on phones when the look changes. */
export function themeHaptic() {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.([8, 26, 12]);
  } catch {
    /* vibration is a bonus, never required */
  }
}
