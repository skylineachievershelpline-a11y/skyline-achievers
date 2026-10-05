import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SessionExtrasDialog } from "@/components/admin/SessionExtrasDialog";
import { adminGetSessions } from "@/lib/admin.functions";

/** Separate admin section for after-review bonus videos, pictures, PDFs and links. */
export function SessionExtrasTab() {
  const load = useServerFn(adminGetSessions);
  const { data } = useQuery({ queryKey: ["admin-sessions"], queryFn: () => load() });
  const sessions = (((data as any)?.sessions ?? data ?? []) as any[]).filter(Boolean);
  const [id, setId] = useState("");
  const chosen = sessions.find((s) => s.id === id);

  return (
    <div className="space-y-4">
      <div className="glass-panel space-y-2 rounded-3xl p-4">
        <h2 className="font-display text-lg font-semibold">Session Extras</h2>
        <p className="text-xs text-muted-foreground">
          Choose a session, then add videos, pictures, PDFs or links. Trainees see them after their review of that session is approved.
        </p>
        <select
          className="h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <option value="">Choose a session</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>
      {chosen ? (
        <SessionExtrasDialog key={chosen.id} inline sessionId={chosen.id} sessionTitle={chosen.title} onClose={() => setId("")} />
      ) : null}
    </div>
  );
}
