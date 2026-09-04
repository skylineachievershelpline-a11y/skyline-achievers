import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminDeleteWhatsappGroup,
  adminGetWhatsappGroups,
  adminSaveWhatsappGroup,
} from "@/lib/admin.functions";

type GroupRow = {
  id: string;
  join_code: string;
  title: string;
  description: string | null;
  invite_url: string;
  sort_order: number | null;
  is_published: boolean;
};

export function WhatsappTab() {
  const queryClient = useQueryClient();
  const loadGroups = useServerFn(adminGetWhatsappGroups);
  const saveGroup = useServerFn(adminSaveWhatsappGroup);
  const removeGroup = useServerFn(adminDeleteWhatsappGroup);

  const { data, isPending } = useQuery({
    queryKey: ["admin-whatsapp"],
    queryFn: () => loadGroups(),
  });

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [published, setPublished] = useState(true);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-whatsapp"] });
  }

  function reset() {
    setEditing(null);
    setJoinCode("");
    setTitle("");
    setDescription("");
    setInviteUrl("");
    setSortOrder("0");
    setPublished(true);
  }

  function startEdit(row: GroupRow) {
    setEditing(row);
    setJoinCode(row.join_code);
    setTitle(row.title);
    setDescription(row.description ?? "");
    setInviteUrl(row.invite_url);
    setSortOrder(String(row.sort_order ?? 0));
    setPublished(row.is_published);
    setOpen(true);
  }

  const del = useMutation({
    mutationFn: (id: string) => removeGroup({ data: { id } }),
    onSuccess: () => {
      toast.success("Group deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await saveGroup({
        data: {
          id: editing?.id,
          joinCode: joinCode.trim().toUpperCase(),
          title: title.trim(),
          description: description.trim() || null,
          inviteUrl: inviteUrl.trim(),
          sortOrder: Number(sortOrder) || 0,
          isPublished: published,
        },
      } as never);
      toast.success(editing ? "Group updated" : "Group created");
      setOpen(false);
      reset();
      refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isPending || !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    );
  }

  const groups = (data.groups ?? []) as GroupRow[];

  return (
    <div className="space-y-4">
      <Button
        variant="brand"
        size="xl"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" /> New WhatsApp group
      </Button>

      {groups.length === 0 ? (
        <p className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
          No WhatsApp groups yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {groups.map((row) => (
            <li key={row.id} className="glass-panel flex items-center gap-3 rounded-2xl p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  Code {row.join_code} · {row.is_published ? "Published" : "Hidden"} ·{" "}
                  {row.invite_url}
                </p>
              </div>
              <button
                onClick={() => startEdit(row)}
                className="text-muted-foreground transition-colors hover:text-brand"
                aria-label="Edit group"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => del.mutate(row.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Delete group"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(false);
            reset();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit group" : "New WhatsApp group"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Join code</Label>
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="SKA-GROUP-01"
                className="h-11 rounded-2xl tracking-[0.12em]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Group name</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp invite link</Label>
              <Input
                value={inviteUrl}
                onChange={(e) => setInviteUrl(e.target.value)}
                placeholder="https://chat.whatsapp.com/XXXXXXXXXXXX"
                className="h-11 rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value.replace(/\D/g, ""))}
                className="h-11 rounded-2xl"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Published (code unlocks the group)
            </label>
            <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Create group"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
