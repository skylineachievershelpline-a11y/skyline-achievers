import { Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { playAlertTone, readVoiceLang, speak } from "@/lib/voice-guide";

type Props = {
  /** Seats shown when the trainee first reaches this stage. */
  startSeats: number;
  /** Minutes before the count drops by one. */
  dropAfterMinutes?: number;
};

/**
 * A hanging tag that swings above the Forever Business Plan session. It shows
 * the live seat count; after the configured wait the count drops by one and the
 * page plays a tone plus a spoken reminder.
 */
export function SeatAlertTag({ startSeats, dropAfterMinutes = 30 }: Props) {
  const [seats, setSeats] = useState(startSeats);
  const announced = useRef(false);

  useEffect(() => {
    setSeats(startSeats);
    announced.current = false;
  }, [startSeats]);

  useEffect(() => {
    if (startSeats <= 1) return;
    const timer = window.setTimeout(
      () => {
        const next = Math.max(1, startSeats - 1);
        setSeats(next);
        if (announced.current) return;
        announced.current = true;
        playAlertTone();
        const en = `Only ${next} ${next === 1 ? "seat" : "seats"} left for Personal Mentorship. Please complete your session quickly, otherwise the seats can finish.`;
        const ur = `Personal Mentorship ki sirf ${next} seat baqi hain. Jaldi se apna session complete karein, warna seats khatam ho sakti hain.`;
        const lang = readVoiceLang();
        window.setTimeout(() => speak(lang === "en" ? en : ur, lang), 700);
      },
      dropAfterMinutes * 60 * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [startSeats, dropAfterMinutes]);

  return (
    <div className="pointer-events-none flex justify-center">
      <div className="flex flex-col items-center seat-tag-swing">
        <span className="h-6 w-px bg-hairline" aria-hidden />
        <span className="glass-panel metal-edge rounded-2xl border border-brand/40 px-4 py-2 text-center">
          <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-glow">
            <Users className="h-3.5 w-3.5" />
            {seats} {seats === 1 ? "seat" : "seats"} left for Personal Mentorship
          </span>
        </span>
      </div>
    </div>
  );
}
