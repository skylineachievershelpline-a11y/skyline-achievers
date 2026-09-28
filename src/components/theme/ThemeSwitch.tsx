import { Moon, Sun } from "lucide-react";
import { useRef } from "react";
import themeOffVoice from "@/assets/theme-off.mp3.asset.json";
import themeOnVoice from "@/assets/theme-on.mp3.asset.json";
import { useTheme } from "@/hooks/useTheme";
import { setTheme, themeHaptic } from "@/lib/theme";

export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { theme } = useTheme();
  const ref = useRef<HTMLButtonElement>(null);
  const dark = theme === "dark";
  function toggle() {
    const next = dark ? "light" : "dark";
    const rect = ref.current?.getBoundingClientRect();
    setTheme(next, rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined);
    themeHaptic();
    try { const audio = new Audio(next === "dark" ? themeOnVoice.url : themeOffVoice.url); audio.volume = 0.82; void audio.play().catch(() => undefined); } catch { /* optional */ }
  }
  return <button ref={ref} type="button" onClick={toggle} className={`theme-header-switch ${dark ? "is-dark" : ""} ${className}`} aria-label={dark ? "Switch to light appearance" : "Switch to dark appearance"} aria-pressed={dark}><Sun aria-hidden /><span><i /></span><Moon aria-hidden /></button>;
}
