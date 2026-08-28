import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Megaphone, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminDeleteNotification,
  adminGetNotifications,
  adminSendNotification,
  adminUpdateNotification,
} from "@/lib/admin.functions";
import { formatDateTime } from "@/lib/format";

const fieldClass = "h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm";

type Level = { id: string; name: string };

export function AnnouncementsTab({ levels }: { levels: Level[] }) {
  const queryClient = useQueryClient();
  const loadList = useServerFn(adminGetNotifications);
  const send = useServerFn(adminSendNotification);
  const update = useServerFn(adminUpdateNotification);
  const remove = useServerFn(adminDeleteNotification);

  const { data, isPending } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => loadList(),
  });

  const [editing, setEditing] = useState<any | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
  }

  const create = useMutation({
    mutationFn: (values: { title: string; body: string; levelId: string }) =>
      send({
        data: {
          title: values.title,
          body: values.body || null,
          kind: "announcement",
          audienceLevelId: values.levelId || null,
          linkPath: null,
        },
      } as never),
    onSuccess: () => {
      toast.success("Announcement sent");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const save = useMutation({
    mutationFn: (values: { id: string; title: string; body: string; levelId: string }) =>
      update({
        data: {
          id: values.id,
          title: values.title,
          body: values.body || null,
          audienceLevelId: values.levelId || null,
        },
      } as never),
    onSuccess: () => {
      toast.success("Announcement updated");
      setEditing(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Announcement deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = ((data as any)?.notifications ?? []) as any[];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <AnnouncementForm
        levels={levels}
        busy={create.isPending}
        submitLabel="Send announcement"
        onSubmit={(values) => create.mutate(values)}
        resetAfterSubmit
      />

      <section>
        <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-brand-glow">
          Sent announcements
        </h3>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : items.length === 0 ? (
          <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
            Nothing sent yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="glass-panel rounded-2xl p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    {item.body ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {item.body}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {item.levels?.name ?? item.audience?.name ?? "All members"} ·{" "}
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditing(item)}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Edit announcement"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => del.mutate(item.id)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Delete announcement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit announcement</DialogTitle>
          </DialogHeader>
          {editing ? (
            <AnnouncementForm
              levels={levels}
              busy={save.isPending}
              submitLabel="Save changes"
              initial={{
                title: editing.title ?? "",
                body: editing.body ?? "",
                levelId: editing.audience_level_id ?? "",
              }}
              onSubmit={(values) => save.mutate({ id: editing.id, ...values })}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnouncementForm({
  levels,
  busy,
  submitLabel,
  initial,
  resetAfterSubmit,
  onSubmit,
}: {
  levels: Level[];
  busy: boolean;
  submitLabel: string;
  initial?: { title: string; body: string; levelId: string };
  resetAfterSubmit?: boolean;
  onSubmit: (values: { title: string; body: string; levelId: string }) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [levelId, setLevelId] = useState(initial?.levelId ?? "");

  return (
    <form
      className="glass-panel-strong space-y-4 rounded-3xl p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onSubmit({ title: title.trim(), body, levelId });
        if (resetAfterSubmit) {
          setTitle("");
          setBody("");
        }
      }}
    >
      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-2xl" />
      </div>
      <div className="space-y-2">
        <Label>Message</Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-28 rounded-2xl"
        />
      </div>
      <div className="space-y-2">
        <Label>Audience</Label>
        <select value={levelId} onChange={(e) => setLevelId(e.target.value)} className={fieldClass}>
          <option value="">All members</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="brand" size="xl" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
        {submitLabel}
      </Button>
    </form>
  );
}
