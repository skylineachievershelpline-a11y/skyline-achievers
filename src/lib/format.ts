export function formatClock(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds) || totalSeconds < 0) return "0:00";
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mm = minutes.toString().padStart(hours > 0 ? 2 : 1, "0");
  const ss = seconds.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds) return "Duration not set";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} hr ${minutes} min`;
  return `${Math.max(minutes, 1)} min`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Same date, but with a 12-hour clock: "23 Sep 2026, 08:00 PM". */
export function formatDateTime12(value: string | null | undefined): string {
  if (!value) return "Never";
  return new Date(value)
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase()
    .replace(" AM", " AM")
    .replace(" PM", " PM");
}

/** "20:00" -> "08:00 PM". */
export function formatTime12(time: string): string {
  const [rawHour, rawMinute] = time.split(":");
  const hour = Number(rawHour ?? 0);
  const minute = String(rawMinute ?? "00").padStart(2, "0");
  const suffix = hour >= 12 ? "PM" : "AM";
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(shown).padStart(2, "0")}:${minute} ${suffix}`;
}