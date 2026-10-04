import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MessageCircle, Users } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getOfficialGroup, type GroupPlacement } from "@/lib/official-groups.functions";

const joinedKey = (placement: GroupPlacement) => `skyline-group-joined:${placement}`;

export function hasJoinedGroup(placement: GroupPlacement) {
  try {
    return localStorage.getItem(joinedKey(placement)) === "1";
  } catch {
    return false;
  }
}

export function useOfficialGroup(placement: GroupPlacement) {
  const load = useServerFn(getOfficialGroup);
  return useQuery({
    queryKey: ["official-group", placement],
    queryFn: () => load({ data: { placement } }),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

function openInvite(url: string, app: "whatsapp" | "business") {
  const token = url.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]+)/)?.[1];
  if (token && /android/i.test(navigator.userAgent)) {
    const pkg = app === "business" ? "com.whatsapp.w4b" : "com.whatsapp";
    window.location.assign(
      `intent://chat?code=${encodeURIComponent(token)}#Intent;scheme=whatsapp;package=${pkg};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`,
    );
    return;
  }
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) window.location.assign(url);
}

/** Rules first, Accept, then pick WhatsApp app to join. */
export function OfficialGroupDialog({
  placement,
  open,
  onOpenChange,
  onJoined,
}: {
  placement: GroupPlacement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined?: () => void;
}) {
  const { data, isPending } = useOfficialGroup(placement);
  const [accepted, setAccepted] = useState(false);
  const group = data?.group ?? null;

  function join(app: "whatsapp" | "business") {
    if (!group) return;
    try {
      localStorage.setItem(joinedKey(placement), "1");
    } catch {
      /* ignore */
    }
    openInvite(group.inviteUrl, app);
    onOpenChange(false);
    setAccepted(false);
    onJoined?.();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setAccepted(false);
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{group?.title ?? "Official WhatsApp Group"}</DialogTitle>
        </DialogHeader>
        {isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !group ? (
          <p className="text-sm text-muted-foreground">
            The official group has not been added yet. Please check again later.
          </p>
        ) : !accepted ? (
          <>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Please read the group rules
            </p>
            <div className="whitespace-pre-wrap rounded-2xl border border-hairline bg-surface-2 p-4 text-sm leading-relaxed">
              {group.rules || "Respect every member. Share only Skyline work updates."}
            </div>
            <Button variant="brand" size="xl" className="w-full" onClick={() => setAccepted(true)}>
              <CheckCircle2 className="h-4 w-4" /> I have read — Accept
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Choose the WhatsApp app to join with.</p>
            <div className="grid gap-3">
              <Button variant="brand" size="xl" onClick={() => join("whatsapp")}>
                <MessageCircle className="h-4 w-4" /> WhatsApp (normal)
              </Button>
              <Button variant="outline" size="xl" onClick={() => join("business")}>
                <Users className="h-4 w-4" /> WhatsApp Business
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Menu entry that opens the official group for this dashboard. */
export function OfficialGroupMenuButton({
  placement,
  className,
  children,
}: {
  placement: GroupPlacement;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex w-full items-center gap-3 rounded-xl border border-cyan/40 bg-gradient-to-r from-primary/20 to-transparent px-3 py-2.5 text-left text-sm font-semibold text-foreground shadow-glass"
        }
      >
        {children ?? (
          <>
            <MessageCircle className="h-4.5 w-4.5 text-brand-glow" /> Official WhatsApp Group
          </>
        )}
      </button>
      <OfficialGroupDialog placement={placement} open={open} onOpenChange={setOpen} />
    </>
  );
}
