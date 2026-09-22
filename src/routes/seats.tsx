import { SkylineLoader } from "@/components/brand/SkylineLoader";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  MemberShell,
  SectionTitle,
  TrainingOnlyLock,
  useMemberGuard,
  useTrainingOnly,
} from "@/components/member/MemberShell";
import { UplineMasterSchedule } from "@/components/journey/UplineMasterSchedule";
import { WelcomeCard, type Credentials } from "@/components/team/WelcomeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createInviteLink,
  deleteInviteLink,
  getMyTeam,
  reserveSeat,
  setInviteActive,
} from "@/lib/team.functions";

export const Route = createFileRoute("/seats")({
  head: () => ({
    meta: [
      { title: "Seat Reservation — Skyline Achievers" },
      {
        name: "description",
        content:
          "Reserve a Beginners Training seat, create a Skyline ID instantly and share one-time registration links.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Seat Reservation — Skyline Achievers" },
      {
        property: "og:description",
        content: "Create Skyline IDs and share one-time registration links.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeatsPage,
});

function SeatsPage() {
  const ready = useMemberGuard();
  const trainingOnly = useTrainingOnly();
  const queryClient = useQueryClient();
  const load = useServerFn(getMyTeam);
  const reserve = useServerFn(reserveSeat);
  const makeLink = useServerFn(createInviteLink);
  const toggleLink = useServerFn(setInviteActive);
  const dropLink = useServerFn(deleteInviteLink);

  const [form, setForm] = useState({ fullName: "", phone: "", age: "" });
  const [card, setCard] = useState<Credentials | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["my-team"],
    queryFn: () => load(),
    enabled: ready,
    retry: false,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["my-team"] });
  }

  const create = useMutation({
    mutationFn: () =>
      reserve({
        data: {
          fullName: form.fullName,
          phone: form.phone,
          age: form.age ? Number(form.age) : null,
        },
      } as never),
    onSuccess: (result: any) => {
      setCard(result.credentials as Credentials);
      setForm({ fullName: "", phone: "", age: "" });
      toast.success("Seat reserved");
      refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const newLink = useMutation({
    mutationFn: (label: string) => makeLink({ data: { label } } as never),
    onSuccess: () => {
      toast.success("Registration link created");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const linkState = useMutation({
    mutationFn: (values: { id: string; isActive: boolean }) =>
      toggleLink({ data: values } as never),
    onSuccess: () => refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  const linkDelete = useMutation({
    mutationFn: (id: string) => dropLink({ data: { id } } as never),
    onSuccess: () => {
      toast.success("Link deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (trainingOnly) {
    return (
      <MemberShell title="Seat Reservation" executive>
        <TrainingOnlyLock area="Seat Reservation" />
      </MemberShell>
    );
  }

  if (!ready || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <SkylineLoader variant="page" />
      </div>
    );
  }

  const invites = (data?.invites ?? []) as any[];
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <MemberShell title="Seat Reservation" subtitle="Create IDs and share your links" executive>
      {card ? (
        <div className="mb-6">
          <WelcomeCard credentials={card} />
          <div className="mt-3 flex justify-center">
            <Button variant="outline" className="rounded-2xl" onClick={() => setCard(null)}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
      ) : null}

      <UplineMasterSchedule />

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          className="raised-panel metal-edge rounded-3xl p-6 animate-rise-in"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <SectionTitle className="mb-1">Reserve a seat</SectionTitle>
          <p className="mb-5 text-xs text-muted-foreground">
            Fill the form and the Skyline ID with password is created instantly. Your member ID is
            attached automatically as the upline.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Age (18+ only)</Label>
                <Input
                  id="age"
                  type="number"
                  min={18}
                  max={90}
                  value={form.age}
                  onChange={(event) => setForm({ ...form, age: event.target.value })}
                  required
                />
              </div>
            </div>
          </div>
          <Button
            type="submit"
            variant="brand"
            size="xl"
            className="mt-6 w-full"
            disabled={create.isPending}
          >
            {create.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Create Skyline ID
          </Button>
        </form>

        <section className="raised-panel metal-edge rounded-3xl p-6 animate-rise-in">
          <SectionTitle className="mb-1">Registration links</SectionTitle>
          <p className="mb-5 text-xs text-muted-foreground">
            Share a link so the person fills their own form. Every link works one time only — after
            one registration it expires and disappears from here. Create a fresh link for the next
            person.
          </p>
          <Button
            variant="outline"
            className="mb-4 w-full rounded-2xl"
            disabled={newLink.isPending}
            onClick={() => newLink.mutate("")}
          >
            {newLink.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create a new link
          </Button>

          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No links yet.</p>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => {
                const url = `${origin}/join/${invite.token}`;
                return (
                  <div key={invite.id} className="inset-panel rounded-xl p-4">
                    <p className="break-all text-xs text-muted-foreground">{url}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      One-time link · {invite.is_active ? "Ready to share" : "Paused"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="brand"
                        className="min-w-fit rounded-xl"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(url)
                            .then(() => toast.success("Link copied"))
                            .catch(() => toast.error("Could not copy the link"));
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-w-fit rounded-xl"
                        onClick={() =>
                          linkState.mutate({ id: invite.id, isActive: !invite.is_active })
                        }
                      >
                        {invite.is_active ? "Pause" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="min-w-fit rounded-xl"
                        onClick={() => linkDelete.mutate(invite.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </MemberShell>
  );
}
