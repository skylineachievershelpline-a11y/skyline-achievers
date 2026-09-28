import { startRegistration } from "@simplewebauthn/browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, Loader2, Plus, Smartphone, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { beginPasskeyRegistration, finishPasskeyRegistration, listPasskeys, removePasskey } from "@/lib/passkeys.functions";
import { formatDateTime } from "@/lib/format";
export function PasskeyManager() {
  const qc = useQueryClient(); const list = useServerFn(listPasskeys); const begin = useServerFn(beginPasskeyRegistration); const finish = useServerFn(finishPasskeyRegistration); const remove = useServerFn(removePasskey); const [name, setName] = useState("");
  const supported = typeof window !== "undefined" && "PublicKeyCredential" in window;
  const devices = useQuery({ queryKey: ["passkeys"], queryFn: () => list() });
  const add = useMutation({ mutationFn: async () => { if (!supported) throw new Error("Fingerprint or Face ID login is not supported by this browser."); const started = await begin(); const response = await startRegistration({ optionsJSON: started.options }); return finish({ data: { challengeId: started.challengeId, deviceName: name.trim() || "My phone", response } }); }, onSuccess: () => { setName(""); toast.success("Secure device added"); void qc.invalidateQueries({ queryKey: ["passkeys"] }); }, onError: (error: Error) => toast.error(error.name === "NotAllowedError" ? "Fingerprint or Face ID was cancelled." : error.message) });
  const del = useMutation({ mutationFn: (id: string) => remove({ data: { id } }), onSuccess: () => { toast.success("Secure device removed"); void qc.invalidateQueries({ queryKey: ["passkeys"] }); }, onError: (error: Error) => toast.error(error.message) });
  const rows = devices.data?.devices ?? [];
  return <section className="glass-panel rounded-3xl p-5"><p className="flex items-center gap-2 text-sm font-semibold"><Fingerprint className="text-brand-glow" /> Fingerprint &amp; Face ID</p><p className="mt-1 text-xs text-muted-foreground">Use your phone’s secure unlock. Skyline never receives your fingerprint or face data.</p><div className="mt-4 space-y-2">{rows.map((device) => <div key={device.id} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface-2 p-3"><Smartphone className="shrink-0 text-brand-glow" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{device.name}</p><p className="text-[10px] text-muted-foreground">Added {formatDateTime(device.createdAt)}{device.lastUsedAt ? ` · Used ${formatDateTime(device.lastUsedAt)}` : ""}</p></div><Button type="button" size="icon" variant="ghost" aria-label={`Remove ${device.name}`} disabled={del.isPending} onClick={() => del.mutate(device.id)}><Trash2 /></Button></div>)}{!devices.isPending && rows.length === 0 ? <p className="rounded-2xl border border-dashed border-hairline p-4 text-center text-xs text-muted-foreground">No secure device added yet.</p> : null}</div><div className="mt-4 flex gap-2"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Device name, e.g. My phone" className="h-11" /><Button type="button" variant="brand" className="h-11 shrink-0" disabled={!supported || add.isPending || rows.length >= 3} onClick={() => add.mutate()}>{add.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add</Button></div><p className="mt-2 text-[10px] text-muted-foreground">{rows.length}/3 devices registered</p></section>;
}
