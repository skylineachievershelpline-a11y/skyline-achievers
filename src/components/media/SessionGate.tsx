import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { SessionExtraCard, type SessionExtraItem } from "@/components/media/SessionExtraCard";
import { Button } from "@/components/ui/button";

/**
 * Extra material with a session stays hidden until the viewer confirms they
 * watched the full webinar. Confirming swaps the session out for the extras;
 * going back returns to the session only.
 */
export function SessionGate({
  extras,
  children,
}: {
  extras: SessionExtraItem[];
  children: ReactNode;
}) {
  const [watched, setWatched] = useState(false);

  if (extras.length === 0) return <>{children}</>;

  if (!watched) {
    return (
      <>
        {children}
        <Button
          size="xl"
          className="logout-button mt-6 w-full font-display text-sm"
          onClick={() => setWatched(true)}
        >
          <CheckCircle2 className="h-4 w-4" />
          I have watched full webinar
        </Button>
      </>
    );
  }

  return (
    <div className="space-y-4 animate-rise-in">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold tracking-tight">
          More with this session
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="rounded-2xl"
          onClick={() => setWatched(false)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {extras.map((extra) => (
        <div key={extra.id} className="animate-rise-in">
          <SessionExtraCard extra={extra} />
        </div>
      ))}

      <Button
        variant="outline"
        size="xl"
        className="w-full rounded-2xl"
        onClick={() => setWatched(false)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the session
      </Button>
    </div>
  );
}
