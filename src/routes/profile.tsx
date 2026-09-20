import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { InstallApp } from "@/components/member/InstallApp";
import { MemberShell, SectionTitle, useMemberGuard } from "@/components/member/MemberShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { memberIdToAuthEmail } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import { getMemberSession, saveMemberBio } from "@/lib/member.functions";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Skyline Achievers" },
      {
        name: "description",
        content:
          "View your Skyline Achievers membership details, change your password and install the training app.",
      },
      { property: "og:title", content: "My Profile — Skyline Achievers" },
      { property: "og:description", content: "Manage your Skyline Achievers member account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const ready = useMemberGuard();
  const load = useServerFn(getMemberSession);
  const { data, isPending } = useQuery({
    queryKey: ["member-session"],
    queryFn: () => load(),
    enabled: ready,
  });

  const member = data?.member ?? null;

  return (
    <MemberShell title="My profile" subtitle={member?.memberId ?? "Member account"}>
      {!ready || isPending ? (
        <div className="flex justify-center py-16">
          <SkylineLoader />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="glass-panel-strong rounded-3xl p-5">
            <SectionTitle className="mb-4">Membership</SectionTitle>
            <dl className="space-y-2.5 text-sm">
              <Row label="Full name" value={member?.fullName ?? "—"} />
              <Row label="Member ID" value={member?.memberId ?? "—"} />
              <Row label="Level" value={member?.level?.name ?? "Not assigned"} />
              <Row label="Phone" value={member?.phone ?? "—"} />
              <Row label="Email" value={member?.email ?? "—"} />
              <Row label="Joined" value={member ? formatDate(member.createdAt) : "—"} />
            </dl>
            {member ? <BioEditor initialBio={member.bio ?? ""} onSaved={() => {
              void queryClient.invalidateQueries({ queryKey: ["member-session"] });
              void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            }} /> : null}
          </section>

          <div className="space-y-4">
            <PasswordCard memberId={member?.memberId ?? ""} />
            <InstallApp />
          </div>
        </div>
      )}
    </MemberShell>
  );
}

function BioEditor({ initialBio, onSaved }: { initialBio: string; onSaved: () => void }) {
  const save = useServerFn(saveMemberBio);
  const [bio, setBio] = useState(initialBio);
  const mutation = useMutation({
    mutationFn: () => save({ data: { bio } } as never),
    onSuccess: () => { toast.success("Bio updated"); onSaved(); },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="mt-5 space-y-2 border-t border-hairline pt-4">
      <Label htmlFor="profile-bio">Dashboard bio</Label>
      <Textarea id="profile-bio" rows={4} maxLength={240} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Write a short introduction about yourself…" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground">{bio.length}/240</span>
        <Button type="button" size="sm" variant="brand" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save bio
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-hairline/60 pb-2 last:border-0">
      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function PasswordCard({ memberId }: { memberId: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      // Re-check the current password before changing it.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: memberIdToAuthEmail(memberId),
        password: current,
      });
      if (signInError) {
        toast.error("Your current password is incorrect.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated. Use it the next time you sign in.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass-panel rounded-3xl p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-brand-glow" /> Change password
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose your own password — at least 8 characters.
      </p>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">Current password</Label>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">New password</Label>
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Confirm new password</Label>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>
        <Button type="submit" variant="brand" size="xl" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Update password
        </Button>
      </div>
    </form>
  );
}
