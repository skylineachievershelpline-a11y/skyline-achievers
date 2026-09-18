import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Copy, KeyRound, Loader2, Search, Trash2, UserCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  adminAddMember,
  adminEditMember,
  adminDeleteMember,
  adminGetMembers,
  adminResetPassword,
} from "@/lib/admin.functions";
import { ACCOUNT_STATUS_LABEL } from "@/lib/brand";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SkylineLoader } from "@/components/brand/SkylineLoader";

type Level = { id: string; name: string; rank_order: number };

const STATUSES = ["all", "active", "blocked", "removed"] as const;

export function MembersTab({ levels }: { levels: Level[] }) {
  const queryClient = useQueryClient();
  const listMembers = useServerFn(adminGetMembers);
  const addMember = useServerFn(adminAddMember);
  const editMember = useServerFn(adminEditMember);
  const resetPassword = useServerFn(adminResetPassword);
  const deleteMember = useServerFn(adminDeleteMember);

  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [credentials, setCredentials] = useState<{
    memberId: string;
    password: string;
    message: string;
  } | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["admin-members", term, status],
    queryFn: () => listMembers({ data: { search: term, status } }),
  });

  const create = useMutation({
    mutationFn: (input: Parameters<typeof adminAddMember>[0]) => addMember(input),
    onSuccess: (result) => {
      setShowAdd(false);
      setCredentials(result);
      void queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: (input: Parameters<typeof adminEditMember>[0]) => editMember(input),
    onSuccess: () => {
      toast.success("Member updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMember({ data: { id } } as never),
    onSuccess: () => {
      toast.success("Member deleted");
      void queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });



  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [manualPassword, setManualPassword] = useState("");

  const reset = useMutation({
    mutationFn: (input: { id: string; newPassword: string | null }) =>
      resetPassword({ data: input } as never),
    onSuccess: (result) => {
      setResetTarget(null);
      setManualPassword("");
      setCredentials(result);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const members = data?.members ?? [];
  const allSelected = members.length > 0 && members.every((member: any) => selectedIds.includes(member.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function applyBulk(action: "active" | "blocked" | "working" | "training" | "delete") {
    if (selectedIds.length === 0) return;
    const label = action === "delete" ? "delete permanently" : `set to ${action}`;
    if (!window.confirm(`${label[0]?.toUpperCase()}${label.slice(1)} for ${selectedIds.length} selected members?`)) return;
    setBulkBusy(true);
    try {
      if (action === "delete") {
        await Promise.all(selectedIds.map((id) => deleteMember({ data: { id } } as never)));
      } else {
        await Promise.all(selectedIds.map((id) => editMember({ data: action === "working" || action === "training" ? { id, workingEnabled: action === "working" } : { id, status: action } } as never)));
      }
      toast.success(`${selectedIds.length} members updated`);
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update selected members");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="raised-panel metal-edge overflow-hidden rounded-2xl">
      <div className="border-b border-border p-4 sm:p-5">
        <div className="mb-4 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
          <div><h2 className="font-display text-lg font-semibold">Member hierarchy</h2><p className="text-xs text-muted-foreground">Search, filter and manage every Skyline member</p></div>
          <p className="text-xs text-muted-foreground">{members.length} members shown</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTerm(search.trim());
          }}
          className="relative min-w-[200px] flex-1"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, Member ID, phone or email"
            className="h-9 rounded-lg pl-10 text-xs"
          />
        </form>
        <Button
          variant="brand"
          size="sm"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ["admin-library"] });
            setShowAdd(true);
          }}
        >
          <UserPlus className="h-4 w-4" />
          Add member
        </Button>
        </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {STATUSES.map((option) => (
          <button
            key={option}
            onClick={() => setStatus(option)}
            className={cn(
              "shrink-0 rounded-lg border border-hairline px-3 py-1.5 text-xs",
              status === option ? "brand-gradient text-brand-foreground" : "bg-glass text-muted-foreground",
            )}
          >
            {option === "all" ? "All" : (ACCOUNT_STATUS_LABEL[option] ?? option)}
          </button>
        ))}
      </div>
      {selectedIds.length > 0 ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-2"><span className="mr-auto px-1 text-xs font-semibold text-primary">{selectedIds.length} selected</span><Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void applyBulk("active")}><UserCheck />Activate</Button><Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void applyBulk("blocked")}><Ban />Block</Button><Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void applyBulk("working")}>Full access</Button><Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void applyBulk("training")}>Training only</Button><Button size="sm" variant="destructive" disabled={bulkBusy} onClick={() => void applyBulk("delete")}><Trash2 />Delete</Button></div> : null}
      </div>

      {isPending ? (
        <div className="flex justify-center py-12">
          <SkylineLoader />
        </div>
      ) : (data?.members.length ?? 0) === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          No members found.
        </p>
      ) : (
        <div>
          <div className="hidden grid-cols-[34px_minmax(210px,1.35fr)_minmax(150px,1fr)_130px_150px_190px] items-center gap-3 border-b border-border bg-surface/70 px-5 py-2.5 text-[10px] font-bold uppercase text-muted-foreground lg:grid">
            <input type="checkbox" aria-label="Select all shown members" checked={allSelected} onChange={() => setSelectedIds(allSelected ? selectedIds.filter((id) => !members.some((member: any) => member.id === id)) : Array.from(new Set([...selectedIds, ...members.map((member: any) => member.id)])))} className="h-4 w-4 accent-primary" />
            <span>Member</span><span>Rank</span><span>Status</span><span>Access</span><span className="text-right">Actions</span>
          </div>
          {members.map((member: any) => (
            <article key={member.id} className={`border-b border-border px-4 py-3 transition-colors last:border-b-0 sm:px-5 ${selectedIds.includes(member.id) ? "bg-primary/15" : "hover:bg-primary/5"}`}>
              <div className="grid gap-3 lg:grid-cols-[34px_minmax(210px,1.35fr)_minmax(150px,1fr)_130px_150px_190px] lg:items-center">
                <input type="checkbox" aria-label={`Select ${member.full_name}`} checked={selectedIds.includes(member.id)} onChange={() => toggleSelected(member.id)} className="absolute h-4 w-4 accent-primary lg:static" />
                <div className="ml-7 flex min-w-0 items-center gap-3 lg:ml-0"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 font-display text-xs font-bold text-primary">{member.full_name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{member.full_name}</p><p className="truncate text-[10px] text-muted-foreground">{member.member_id} · {member.phone ?? "No phone"}</p><p className="text-[10px] text-muted-foreground">Joined {formatDate(member.created_at)} · {formatDateTime(member.last_login_at)}</p></div></div>
                  <select
                    value={member.level_id ?? ""}
                    onChange={(e) =>
                      update.mutate({ data: { id: member.id, levelId: e.target.value } } as never)
                    }
                    className="h-8 min-w-0 rounded-lg border border-hairline bg-surface-2 px-2 text-xs"
                  >
                    {levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                  <select aria-label={`Status for ${member.full_name}`}
                    value={member.status}
                    onChange={(e) =>
                      update.mutate({ data: { id: member.id, status: e.target.value } } as never)
                    }
                    className="h-8 rounded-lg border border-hairline bg-surface-2 px-2 text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <select aria-label={`Access for ${member.full_name}`}
                    value={member.working_enabled === false ? "training" : "working"}
                    onChange={(e) =>
                      update.mutate({
                        data: { id: member.id, workingEnabled: e.target.value === "working" },
                      } as never)
                    }
                    className="h-8 min-w-0 rounded-lg border border-hairline bg-surface-2 px-2 text-xs"
                    title="Access"
                  >
                    <option value="training">Training only</option>
                    <option value="working">Training + working</option>
                  </select>
                  <div className="flex items-center gap-1.5 lg:justify-end"><Button
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-lg px-2 text-[11px]"
                    onClick={() => {
                      setManualPassword("");
                      setResetTarget({ id: member.id, name: member.full_name });
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Password
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete ${member.full_name} permanently? Their login and records are gone for good.`,
                        )
                      )
                        return;
                      remove.mutate(member.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  </div>
              </div>
            </article>
          ))}
          <div className="flex items-center justify-between border-t border-border bg-surface/60 px-4 py-3 text-[11px] text-muted-foreground sm:px-5"><span>Showing {members.length} members</span><span>{selectedIds.length} selected</span></div>
        </div>
      )}

      <AddMemberDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        levels={levels}
        pending={create.isPending}
        onSubmit={(values) => create.mutate({ data: values } as never)}
      />

      <Dialog open={resetTarget !== null} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Reset password{resetTarget ? ` — ${resetTarget.name}` : ""}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!resetTarget) return;
              const manual = manualPassword.trim();
              if (manual && manual.length < 8) {
                toast.error("Use at least 8 characters");
                return;
              }
              reset.mutate({ id: resetTarget.id, newPassword: manual || null });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="manual-password">Set your own password (optional)</Label>
              <Input
                id="manual-password"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                placeholder="Leave empty to generate one automatically"
                className="h-11 rounded-2xl"
              />
            </div>
            <Button
              type="submit"
              variant="brand"
              size="xl"
              className="w-full"
              disabled={reset.isPending}
            >
              {reset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reset password
            </Button>
          </form>
        </DialogContent>
      </Dialog>


      <Dialog open={credentials !== null} onOpenChange={() => setCredentials(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Member credentials</DialogTitle>
          </DialogHeader>
          {credentials ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Save these now — the password cannot be shown again.
              </p>
              <div className="rounded-2xl border border-hairline bg-surface-2 p-3 text-sm">
                <p>
                  Member ID: <span className="font-semibold">{credentials.memberId}</span>
                </p>
                <p>
                  Password: <span className="font-semibold">{credentials.password}</span>
                </p>
              </div>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-hairline bg-surface p-3 text-xs leading-relaxed">
                {credentials.message}
              </pre>
              <Button
                variant="brand"
                size="xl"
                className="w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(credentials.message);
                  toast.success("Message copied");
                }}
              >
                <Copy className="h-4 w-4" />
                Copy WhatsApp message
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddMemberDialog({
  open,
  onOpenChange,
  levels,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  levels: Level[];
  pending: boolean;
  onSubmit: (values: {
    fullName: string;
    age: number | null;
    cnic: string | null;
    email: string | null;
    phone: string | null;
    levelId: string;
    status: string;
    workingEnabled: boolean;
  }) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [cnic, setCnic] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const [workingEnabled, setWorkingEnabled] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (levels.length === 0) {
      setLevelId("");
      return;
    }
    if (!levels.some((level) => level.id === levelId)) {
      setLevelId(levels[0]?.id ?? "");
    }
  }, [levelId, levels, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!fullName.trim() || !levelId) return;
            onSubmit({
              fullName: fullName.trim(),
              age: age ? Number(age) : null,
              cnic: cnic.trim() || null,
              email: email.trim() || null,
              phone: phone.trim() || null,
              levelId,
              status: "active",
              workingEnabled,
            });
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 rounded-2xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="age">Age</Label>
              <Input id="age" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className="h-11 rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-2xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnic">CNIC</Label>
            <Input id="cnic" value={cnic} onChange={(e) => setCnic(e.target.value)} className="h-11 rounded-2xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-2xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="level">Training level</Label>
            <select
              id="level"
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
              className="h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm"
            >
              {levels.length === 0 ? <option value="">No training levels found</option> : null}
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="access">Access</Label>
            <select
              id="access"
              value={workingEnabled ? "working" : "training"}
              onChange={(e) => setWorkingEnabled(e.target.value === "working")}
              className="h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm"
            >
              <option value="working">Training + working (everything unlocked)</option>
              <option value="training">Training only (working sections locked)</option>
            </select>
          </div>
          <Button type="submit" variant="brand" size="xl" className="w-full" disabled={pending || !levelId}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create member
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
