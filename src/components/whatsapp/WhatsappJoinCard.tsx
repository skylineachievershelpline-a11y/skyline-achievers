import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, MessageCircle, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openWhatsappGroup } from "@/lib/whatsapp.functions";

type Group = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  inviteUrl: string;
};

function inviteToken(url: string) {
  const match = url.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

export function WhatsappJoinCard() {
  const verify = useServerFn(openWhatsappGroup);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);

  async function onSubmit() {
    setError(null);
    const value = code.trim().toUpperCase();
    if (value.length < 4) {
      setError("Enter the group code you were given.");
      return;
    }
    setPending(true);
    try {
      const result = await verify({ data: { code: value } });
      if (result.status !== "ok") {
        setError("That group code is not valid. Please check it and try again.");
        return;
      }
      setGroup(result.group);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function openLink(href: string) {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openIn(app: "whatsapp" | "business") {
    if (!group) return;
    const token = inviteToken(group.inviteUrl);
    const isAndroid = /android/i.test(navigator.userAgent);

    if (token && isAndroid) {
      // Open ONLY the package-specific intent. Opening the plain https invite
      // first lets Android's default handler (often WhatsApp Business) grab it,
      // which is why every button opened the same app before.
      const pkg = app === "business" ? "com.whatsapp.w4b" : "com.whatsapp";
      const intentUrl = `intent://chat.whatsapp.com/${token}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${encodeURIComponent(
        group.inviteUrl,
      )};end`;
      openLink(intentUrl);
    } else {
      openLink(group.inviteUrl);
    }

    setGroup(null);
  }


  return (
    <>
      <div className="glass-panel-strong rounded-3xl p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" />
          Enter your group code
        </div>

        <div className="space-y-2">
          <Label htmlFor="groupCode">Group code</Label>
          <Input
            id="groupCode"
            placeholder="e.g. SKA-GROUP-01"
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onSubmit();
              }
            }}
            className="h-12 rounded-2xl text-base tracking-[0.14em]"
          />
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          variant="brand"
          size="xl"
          className="mt-6 w-full"
          disabled={pending}
          onClick={() => void onSubmit()}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          {pending ? "Checking your code" : "Join WhatsApp group"}
        </Button>
      </div>

      <Dialog open={Boolean(group)} onOpenChange={(open) => (open ? null : setGroup(null))}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Which WhatsApp do you want to use?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {group?.title}
            {group?.description ? ` — ${group.description}` : ""}. Choose the app you want to join
            the group with.
          </p>
          <div className="mt-4 grid gap-3">
            <Button variant="brand" size="xl" onClick={() => openIn("whatsapp")}>
              <MessageCircle className="h-4 w-4" />
              WhatsApp (normal)
            </Button>
            <Button variant="outline" size="xl" onClick={() => openIn("business")}>
              <Users className="h-4 w-4" />
              WhatsApp Business
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            If the chosen app is not installed, the invite opens in your browser instead.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
