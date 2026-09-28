import { useEffect, useState } from "react";

import { THEME_EVENT, currentTheme, readStoredTheme, setTheme, type Theme } from "@/lib/theme";

/**
 * Reads the active look and keeps every screen in sync when it changes.
 * Safe during server rendering: it always starts on the default look and
 * corrects itself on the first paint in the browser.
 */
export function useTheme(): { theme: Theme; setTheme: typeof setTheme } {
  const [theme, setLocal] = useState<Theme>("dark");

  useEffect(() => {
    setLocal(currentTheme());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<Theme>).detail;
      setLocal(detail ?? currentTheme());
    };
    const onStorage = () => setLocal(readStoredTheme());
    window.addEventListener(THEME_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { theme, setTheme };
}
