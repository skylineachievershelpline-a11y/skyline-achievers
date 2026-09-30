import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Download, Loader2, LogOut, Plus, Repeat, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { AppInstallDialog } from "@/components/pwa/AppInstallDialog";
import { Button } from "@/components/ui/button";

import { supabase } from "@/integrations/supabase/client";
import {
  listDeviceAccounts,
  startAddAccount,
  switchToAccount,
  type DeviceAccount,
} from "@/lib/device-accounts";

/** Settings sheet inside the side menu: profile, switch account, add account, log out. */
export function AccountSettings({
  currentName,
  currentCode,
  onClose,
  onSignOut,
  allowAccountManagement = true,
}: {
  currentName: string;
  currentCode: string;
  onClose: () => void;
  onSignOut: () => void;
  allowAccountManagement?: boolean;
}) {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<DeviceAccount[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setAccounts(listDeviceAccounts());
    void supabase.auth.getSession().then(({ data }) => setCurrentId(data.session?.user.id ?? null));
  }, []);

  const others = accounts.filter((a) => a.userId !== currentId);

  async function switchTo(userId: string) {
    setBusy(userId);
    const to = await switchToAccount(userId);
    setBusy(null);
    if (!to) {
      toast.error("Session expired — please enter this account's password once.");
      setAccounts(listDeviceAccounts());
      return;
    }
    // Full reload so every screen loads the new account's data.
    window.location.assign(to);
  }

  async function addAccount() {
    await startAddAccount();
    await navigate({ to: "/" });
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background/95 p-5 backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to menu
      </button>
      <h2 className="mt-4 font-display text-lg font-semibold">Settings</h2>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-cyan/30 bg-primary/10 p-3">
        <UserCircle2 className="h-9 w-9 text-brand-glow" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{currentName}</p>
          {currentCode ? (
            <p className="truncate font-mono text-[11px] text-muted-foreground">ID {currentCode}</p>
          ) : null}
        </div>
        <Check className="h-4 w-4 text-cyan" />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl border border-hairline bg-surface p-3">
        <div>
          <p className="text-sm font-semibold">Appearance</p>
          <p className="text-[11px] text-muted-foreground">Light or dark mode</p>
        </div>
        <ThemeSwitch />
      </div>

      <AppInstallDialog>
        <Button variant="outline" className="mt-3 h-auto w-full justify-start rounded-2xl p-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-brand-glow"><Download /></span>
          <span><span className="block text-sm font-semibold">Install Skyline Achievers</span><span className="block text-[11px] font-normal text-muted-foreground">Faster access from your home screen</span></span>
        </Button>
      </AppInstallDialog>

      {allowAccountManagement ? <><p className="mt-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Repeat className="h-3.5 w-3.5" /> Switch account
      </p>
      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {others.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            No other account on this device yet. Use Add account.
          </p>
        ) : (
          others.map((account) => (
            <button
              key={account.userId}
              type="button"
              disabled={busy !== null}
              onClick={() => void switchTo(account.userId)}
              className="flex w-full items-center gap-3 rounded-2xl border border-hairline bg-surface p-3 text-left hover:border-cyan/40"
            >
              <UserCircle2 className="h-7 w-7 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{account.name}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {account.code} · {account.kind === "trainee" ? "Beginners Training" : account.kind === "executive" ? "Growth Executive" : "Member"}
                </p>
              </div>
              {busy === account.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            </button>
          ))
        )}
      </div></> : <div className="min-h-4 flex-1" />}

      <div className="shrink-0 space-y-2 border-t border-hairline pt-3">
        {allowAccountManagement ? <button
          type="button"
          onClick={() => void addAccount()}
          className="flex w-full items-center gap-3 rounded-xl border border-metal/30 bg-surface px-3 py-2.5 text-sm font-semibold hover:border-cyan/40"
        >
          <Plus className="h-4.5 w-4.5 text-brand-glow" /> Add account
        </button> : null}
        <button type="button" onClick={onSignOut} className="logout-button w-full font-display text-sm">
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </div>
  );
}
