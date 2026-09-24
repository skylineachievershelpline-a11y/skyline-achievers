import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Ban, CircleDollarSign, Copy, ExternalLink, KeyRound, ListChecks, Loader2, ReceiptText, Search, Trash2, UserCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PaymentSlip, type PaymentSlipData } from "@/components/courses/PaymentSlip";
import { formatRankName } from "@/components/member/RankPin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  adminAddMember,
  adminEditMember,
  adminDeleteMember,
  adminGetMembers,
  adminGetUplines,
  adminGetMemberMenuAccess,
  adminSetMemberMenuAccess,
  adminResetPassword,
  adminSetMentorship,
} from "@/lib/admin.functions";

import { ACCOUNT_STATUS_LABEL } from "@/lib/brand";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Level = { id: string; name: string; rank_order: number };
type Upline = {
  id: string;
  memberId: string;
  fullName: string;
  isOfficial: boolean;
  levelName: string | null;
};


const STATUSES = ["all", "active", "blocked", "removed"] as const;
const MEMBER_GROUPS = ["all", "mentorship", "fbo"] as const;


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
  const [memberGroup, setMemberGroup] = useState<(typeof MEMBER_GROUPS)[number]>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [credentials, setCredentials] = useState<{
    memberId: string;
    password: string;
    message: string;
    accountId?: string;
  } | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["admin-members", term, status],
    queryFn: () => listMembers({ data: { search: term, status } }),
  });

  const loadUplines = useServerFn(adminGetUplines);
  const { data: uplineData } = useQuery({
    queryKey: ["admin-uplines"],
    queryFn: () => loadUplines(),
  });
  const uplines = (uplineData?.uplines ?? []) as Upline[];


  const create = useMutation({
    mutationFn: (input: Parameters<typeof adminAddMember>[0]) => addMember(input),
    onSuccess: (result) => {
      setShowAdd(false);
      setCredentials(result);
      void queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-uplines"] });

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
  const [moneyTarget, setMoneyTarget] = useState<any | null>(null);
  const [menuTarget, setMenuTarget] = useState<{ id: string; name: string } | null>(null);
  const [mentorshipSlip, setMentorshipSlip] = useState<PaymentSlipData | null>(null);

  const setMentorship = useServerFn(adminSetMentorship);
  const mentorship = useMutation({
    mutationFn: (input: Record<string, unknown>) => setMentorship({ data: input } as never),
    onSuccess: (_result, input) => {
      if (input["printSlip"] && moneyTarget) {
        const total = Number(input["feeTotal"] ?? moneyTarget.mentorship_fee_pkr ?? 50000);
        const received = Number(input["paid"] ?? moneyTarget.mentorship_paid_pkr ?? 0);
        const remaining = Math.max(total - received, 0);
        setMentorshipSlip({
          kind: "mentorship",
          title: "Personal Mentorship Amount",
          buyerName: moneyTarget.full_name,
          buyerId: moneyTarget.member_id,
          rank: moneyTarget.levels?.name ?? null,
          amount: received,
          totalAmount: total,
          remainingAmount: remaining,
          status: remaining <= 0 ? "Amount complete" : "Part payment received",
          note: remaining <= 0
            ? "Training unlocks after admin verification. Keep this receipt for your record."
            : "Remaining amount must be completed before the deadline.",
          submittedAt: new Date(),
        });
      }
      toast.success("Personal Mentorship updated");
      setMoneyTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

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

  const allMembers = data?.members ?? [];
  const members = allMembers.filter((member: any) => {
    const isFbo = Number(member.levels?.rank_order ?? 0) >= 2;
    if (memberGroup === "fbo") return isFbo;
    if (memberGroup === "mentorship") return !isFbo;
    return true;
  });
  const allSelected = members.length > 0 && members.every((member: any) => selectedIds.includes(member.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function applyBulk(action: "active" | "blocked" | "delete") {
    if (selectedIds.length === 0) return;
    const label = action === "delete" ? "delete permanently" : `set to ${action}`;
    if (!window.confirm(`${label[0]?.toUpperCase()}${label.slice(1)} for ${selectedIds.length} selected members?`)) return;
    setBulkBusy(true);
    try {
      if (action === "delete") {
        await Promise.all(selectedIds.map((id) => deleteMember({ data: { id } } as never)));
      } else {
        await Promise.all(selectedIds.map((id) => editMember({ data: { id, status: action } } as never)));
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

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" aria-label="Member type">
        {MEMBER_GROUPS.map((option) => (
          <Button
            key={option}
            type="button"
            variant={memberGroup === option ? "brand" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => {
              setMemberGroup(option);
              setSelectedIds([]);
            }}
          >
            {option === "all" ? "All members" : option === "mentorship" ? "Personal Mentorship" : "FBO"}
          </Button>
        ))}
      </div>

      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
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
      {selectedIds.length > 0 ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-2"><span className="mr-auto px-1 text-xs font-semibold text-primary">{selectedIds.length} selected</span><Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void applyBulk("active")}><UserCheck />Activate</Button><Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void applyBulk("blocked")}><Ban />Block</Button><Button size="sm" variant="destructive" disabled={bulkBusy} onClick={() => void applyBulk("delete")}><Trash2 />Delete</Button></div> : null}
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
          <div className="hidden grid-cols-[34px_minmax(210px,1.35fr)_minmax(150px,1fr)_130px_150px_290px] items-center gap-3 border-b border-border bg-surface/70 px-5 py-2.5 text-[10px] font-bold uppercase text-muted-foreground lg:grid">
            <input type="checkbox" aria-label="Select all shown members" checked={allSelected} onChange={() => setSelectedIds(allSelected ? selectedIds.filter((id) => !members.some((member: any) => member.id === id)) : Array.from(new Set([...selectedIds, ...members.map((member: any) => member.id)])))} className="h-4 w-4 accent-primary" />
            <span>Member</span><span>Rank</span><span>Status</span><span>Access</span><span className="text-right">Actions</span>
          </div>
          {members.map((member: any) => (
            <article key={member.id} className={`border-b border-border px-4 py-3 transition-colors last:border-b-0 sm:px-5 ${selectedIds.includes(member.id) ? "bg-primary/15" : "hover:bg-primary/5"}`}>
              <div className="grid gap-3 lg:grid-cols-[34px_minmax(210px,1.35fr)_minmax(150px,1fr)_130px_150px_290px] lg:items-center">
                <input type="checkbox" aria-label={`Select ${member.full_name}`} checked={selectedIds.includes(member.id)} onChange={() => toggleSelected(member.id)} className="absolute h-4 w-4 accent-primary lg:static" />
                <div className="ml-7 min-w-0 lg:ml-0">
                  <div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 font-display text-xs font-bold text-primary">{member.full_name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{member.full_name}{member.is_official ? <span className="ml-1 rounded-full border border-cyan/30 bg-cyan/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan">Official</span> : null}</p><p className="truncate text-[10px] text-muted-foreground">{member.member_id} · {member.phone ?? "No phone"}</p><p className="text-[10px] text-muted-foreground">Joined {formatDate(member.created_at)} · {formatDateTime(member.last_login_at)}</p></div></div>
                  {member.is_official ? null : (
                    <select
                      aria-label={`Upline for ${member.full_name}`}
                      title="Upline ID"
                      value={member.upline_id ?? ""}
                      onChange={(e) =>
                        update.mutate({ data: { id: member.id, uplineId: e.target.value } } as never)
                      }
                      className="mt-2 h-8 w-full min-w-0 rounded-lg border border-hairline bg-surface-2 px-2 text-[11px]"
                    >
                      <option value="" disabled>
                        No upline — select one
                      </option>
                      {uplines
                        .filter((upline) => upline.id !== member.id)
                        .map((upline) => (
                          <option key={upline.id} value={upline.id}>
                            {upline.isOfficial ? "★ " : ""}
                            {upline.fullName} · {upline.memberId}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

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
                  <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                  <Button asChild variant="brand" size="sm" className="h-8 rounded-lg px-2 text-[11px]">
                    <Link to="/admin/member/$memberId" params={{ memberId: member.id }}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Dashboard
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-2 text-[11px]"
                    onClick={() => setMoneyTarget(member)}
                  >
                    <CircleDollarSign className="h-3.5 w-3.5" />
                    Payment
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-2 text-[11px]"
                    onClick={() => setMenuTarget({ id: member.id, name: member.full_name })}
                  >
                    <ListChecks className="h-3.5 w-3.5" />
                    Menu access
                  </Button>
                  <Button
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
        uplines={uplines}

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


      <Dialog open={menuTarget !== null} onOpenChange={(open) => !open && setMenuTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Menu access — {menuTarget?.name}</DialogTitle>
          </DialogHeader>
          {menuTarget ? <MenuAccessPicker memberId={menuTarget.id} /> : null}
        </DialogContent>
      </Dialog>

      <MentorshipDialog
        member={moneyTarget}
        onClose={() => setMoneyTarget(null)}
        onSave={(input) => mentorship.mutate(input)}
        pending={mentorship.isPending}
      />

      <PaymentSlip
        open={mentorshipSlip !== null}
        data={mentorshipSlip}
        onClose={() => setMentorshipSlip(null)}
      />

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
              {credentials.accountId ? <MenuAccessPicker memberId={credentials.accountId} /> : null}
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
  uplines,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  levels: Level[];
  uplines: Upline[];
  pending: boolean;
  onSubmit: (values: {
    fullName: string;
    age: number | null;
    email: string | null;
    phone: string | null;
    levelId: string;
    uplineId: string;
    status: string;
    workingEnabled: boolean;
    feePkr: number;
    paidPkr: number;
  }) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [feePkr, setFeePkr] = useState("50000");
  const [paidPkr, setPaidPkr] = useState("0");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const [uplineId, setUplineId] = useState("");
  const workingEnabled = true;

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

  // Every new account must sit under an upline; default to the official one.
  useEffect(() => {
    if (!open || uplines.length === 0) return;
    if (!uplines.some((upline) => upline.id === uplineId)) {
      setUplineId((uplines.find((upline) => upline.isOfficial) ?? uplines[0]!).id);
    }
  }, [open, uplineId, uplines]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!fullName.trim() || !levelId || !uplineId) return;
            onSubmit({
              fullName: fullName.trim(),
              age: age ? Number(age) : null,
              email: email.trim() || null,
              phone: phone.trim() || null,
              levelId,
              uplineId,

              status: "active",
              workingEnabled,
              feePkr: Number(feePkr || 0),
              paidPkr: Number(paidPkr || 0),
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="feePkr">Personal Mentorship amount (Rs.)</Label>
              <Input id="feePkr" inputMode="numeric" value={feePkr} onChange={(e) => setFeePkr(e.target.value)} className="h-11 rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paidPkr">Amount received (Rs.)</Label>
              <Input id="paidPkr" inputMode="numeric" value={paidPkr} onChange={(e) => setPaidPkr(e.target.value)} className="h-11 rounded-2xl" />
            </div>
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
            <Label htmlFor="upline">Upline ID (required)</Label>
            <select
              id="upline"
              value={uplineId}
              onChange={(e) => setUplineId(e.target.value)}
              className="h-11 w-full rounded-2xl border border-hairline bg-surface-2 px-3 text-sm"
            >
              {uplines.length === 0 ? <option value="">Loading upline accounts…</option> : null}
              {uplines.map((upline) => (
                <option key={upline.id} value={upline.id}>
                  {upline.isOfficial ? "★ " : ""}
                  {upline.fullName} · {upline.memberId}
                  {upline.levelName ? ` · ${upline.levelName}` : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              If the new member has no personal upline, keep the official Skyline Achievers account.
            </p>
          </div>

          <Button type="submit" variant="brand" size="xl" className="w-full" disabled={pending || !levelId || !uplineId}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create member
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Personal Mentorship money, extra days, training lock and account unblock. */
function MentorshipDialog({
  member,
  onClose,
  onSave,
  pending,
}: {
  member: any | null;
  onClose: () => void;
  onSave: (input: Record<string, unknown>) => void;
  pending: boolean;
}) {
  if (!member) return null;
  const isFbo = Number(member.levels?.rank_order ?? 0) >= 2;
  const total = Number(member.mentorship_fee_pkr ?? 50000);
  const received = Number(member.mentorship_paid_pkr ?? 0);
  const remaining = Math.max(total - received, 0);
  const used = Number(member.mentorship_extensions ?? 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{isFbo ? "2CC Status" : "Personal Mentorship"} — {member.full_name}</DialogTitle>
        </DialogHeader>
        {isFbo ? (
          <div className="rounded-2xl border border-cyan/30 bg-primary/10 p-6 text-center">
            <BadgeCheck className="mx-auto h-10 w-10 text-cyan" />
            <p className="mt-3 font-display text-xl font-semibold text-cyan">2CC Complete</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatRankName(member.levels?.name)} rank confirmed. This member is an FBO.
            </p>
          </div>
        ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Payment summary
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface px-2 py-3">
                <p className="text-[10px] uppercase text-muted-foreground">Required</p>
                <p className="mt-1 text-sm font-semibold">Rs. {total.toLocaleString("en-PK")}</p>
              </div>
              <div className="rounded-xl bg-surface px-2 py-3">
                <p className="text-[10px] uppercase text-muted-foreground">Verified</p>
                <p className="mt-1 text-sm font-semibold">Rs. {received.toLocaleString("en-PK")}</p>
              </div>
              <div className="rounded-xl bg-surface px-2 py-3">
                <p className="text-[10px] uppercase text-muted-foreground">Remaining</p>
                <p className="mt-1 text-sm font-semibold">Rs. {remaining.toLocaleString("en-PK")}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Amounts and the payment deadline are set in the Journey &amp; Payments tab when a claim
              is verified. Deadline:{" "}
              {member.mentorship_due_at ? formatDateTime(member.mentorship_due_at) : "not set"} ·
              Extra days used: {used}/3
            </p>
          </div>

          <Button
            variant="outline"
            size="xl"
            className="w-full"
            disabled={pending}
            onClick={() => onSave({ id: member.id, printSlip: true })}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
            Print receipt
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" className="h-10 rounded-xl" disabled={pending} onClick={() => onSave({ id: member.id, grantDay: true })}>
              +1 day for payment
            </Button>
            <Button variant="secondary" size="sm" className="h-10 rounded-xl" disabled={pending} onClick={() => onSave({ id: member.id, grantCcDay: true })}>
              +1 day for CC target
            </Button>
            <Button variant="outline" size="sm" className="h-10 rounded-xl" disabled={pending} onClick={() => onSave({ id: member.id, resetCcTimer: true })}>
              Restart CC week
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-xl"
              disabled={pending}
              onClick={() => onSave({ id: member.id, trainingLocked: !member.training_locked })}
            >
              {member.training_locked ? "Unlock training" : "Lock training"}
            </Button>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Sidebar menu entries the admin can show or hide for one member. */
const MENU_OPTIONS = [
  { key: "/training", label: "Training" },
  { key: "/courses", label: "Premium Courses" },
  { key: "/sessions", label: "Beginners Sessions" },
  { key: "/reels", label: "Reels" },
  { key: "/chat", label: "Messages" },
  { key: "/ai", label: "Skyline Achievers AI" },
  { key: "/seats", label: "Seat Reservation" },
  { key: "/leave", label: "Leave Application" },
  { key: "/team", label: "Team Tree" },
  { key: "/resources", label: "Files & Resources" },
  { key: "/search", label: "Search" },
  { key: "/profile", label: "My Profile" },
];

function MenuAccessPicker({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient();
  const loadMenu = useServerFn(adminGetMemberMenuAccess);
  const saveMenu = useServerFn(adminSetMemberMenuAccess);
  const [hidden, setHidden] = useState<string[] | null>(null);
  const { data, isPending } = useQuery({
    queryKey: ["admin-member-menu-access", memberId],
    queryFn: () => loadMenu({ data: { memberId } } as never),
  });
  useEffect(() => {
    if (data) setHidden((data as any).hidden as string[]);
  }, [data]);
  const save = useMutation({
    mutationFn: (list: string[]) => saveMenu({ data: { memberId, hidden: list } } as never),
    onSuccess: () => {
      toast.success("Menu access saved");
      void queryClient.invalidateQueries({ queryKey: ["admin-member-menu-access", memberId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const off = hidden ?? [];
  function toggle(key: string) {
    setHidden((current) => {
      const list = current ?? [];
      return list.includes(key) ? list.filter((value) => value !== key) : [...list, key];
    });
  }
  return (
    <div className="rounded-2xl border border-hairline bg-surface-2 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Sidebar menu access
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Ticked options are visible in this member's side menu. Untick to hide a section completely.
        Home always stays visible.
      </p>
      {isPending ? (
        <div className="py-4 text-xs text-muted-foreground">Loading menu…</div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MENU_OPTIONS.map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={!off.includes(item.key)}
                onChange={() => toggle(item.key)}
                className="h-4 w-4"
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </label>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-10 rounded-xl"
          disabled={save.isPending || isPending}
          onClick={() => save.mutate(off)}
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save menu access
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 rounded-xl"
          disabled={save.isPending || isPending}
          onClick={() => setHidden([])}
        >
          Show all
        </Button>
      </div>
    </div>
  );
}
