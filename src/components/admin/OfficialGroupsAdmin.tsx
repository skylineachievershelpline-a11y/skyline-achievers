import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  GROUP_PLACEMENTS,
  PLACEMENT_LABEL,
  adminGetOfficialGroups,
  adminSaveOfficialGroup,
  type GroupPlacement,
} from "@/lib/official-groups.functions";

export function OfficialGroupsAdmin() {
  const load = useServerFn(adminGetOfficialGroups);
  const { data } = useQuery({ queryKey: ["admin-official-groups"], queryFn: () => load() });
  return (
    <section className="space-y-3">
      <h3 className="font-display text-base font-semibold">Official groups (per dashboard)</h3>
      <p className="text-xs text-muted-foreground">
        Each dashboard menu shows its own group. Members read the rules, press Accept, then join.
        The Daily Report group opens the first time someone presses Share on a report.
      </p>
      {GROUP_PLACEMENTS.map((p) => (
        <GroupEditor key={p} placement={p} row={data?.groups.find((g) => g.placement === p)} />
      ))}
    </section>
  );
}

function GroupEditor({
  placement,
  row,
}: {
  placement: GroupPlacement;
  row?: { title: string; rules: string; invite_url: string; is_published: boolean } | undefined;
}) {
  const qc = useQueryClient();
  const save = useServerFn(adminSaveOfficialGroup);
  const [title, setTitle] = useState("Official WhatsApp Group");
  const [rules, setRules] = useState("");
  const [url, setUrl] = useState("");
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!row) return;
    setTitle(row.title);
    setRules(row.rules);
    setUrl(row.invite_url);
    setPublished(row.is_published);
  }, [row]);

  async function submit() {
    setBusy(true);
    try {
      await save({ data: { placement, title, rules, inviteUrl: url, isPublished: published } });
      toast.success(`${PLACEMENT_LABEL[placement]} saved`);
      void qc.invalidateQueries({ queryKey: ["admin-official-groups"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-panel space-y-2 rounded-2xl p-4">
      <p className="text-sm font-semibold">{PLACEMENT_LABEL[placement]}</p>
      <div className="space-y-1">
        <Label>Group name</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-xl" />
      </div>
      <div className="space-y-1">
        <Label>Rules / instructions</Label>
        <Textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={4} className="rounded-xl" />
      </div>
      <div className="space-y-1">
        <Label>WhatsApp invite link</Label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://chat.whatsapp.com/XXXXXXXX"
          className="h-10 rounded-xl"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Show in dashboard
      </label>
      <Button variant="brand" className="w-full rounded-xl" disabled={busy || !url} onClick={() => void submit()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
      </Button>
    </div>
  );
}
