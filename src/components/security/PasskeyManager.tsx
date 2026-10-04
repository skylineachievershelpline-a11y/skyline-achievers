import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, Loader2, ScanFace, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { beginPasskeyRegistration, finishPasskeyRegistration, listPasskeys, removePasskey } from "@/lib/passkeys.functions";
import { friendlyErrorMessage, isCancelledBiometric } from "@/lib/friendly-error";
import { formatDateTime } from "@/lib/format";

type BiometricMethod = "fingerprint" | "face";

const METHOD_LABEL: Record<BiometricMethod, string> = {
  fingerprint: "Fingerprint",
  face: "Face ID",
};

function detectDeviceName(): string {
  if (typeof navigator === "undefined") return "My device";
  const ua = navigator.userAgent;
  const model = /Android[^;]*;\s*([^;)]+?)\s*(?:Build\/|\w+\)|\))/i.exec(ua)?.[1];
  if (model && model.trim()) return model.replace(/_/g, " ").trim();
  if (/iPhone|iPad|iPod/.test(ua)) return "iPhone";
  if (/Mobi|Android/i.test(ua)) return "Android phone";
  return "Desktop";
}

export function PasskeyManager() {
  const qc = useQueryClient(); const list = useServerFn(listPasskeys); const begin = useServerFn(beginPasskeyRegistration); const finish = useServerFn(finishPasskeyRegistration); const remove = useServerFn(removePasskey);
  const supported = typeof window !== "undefined" && "PublicKeyCredential" in window;
  const devices = useQuery({ queryKey: ["passkeys"], queryFn: () => list() });
  const add = useMutation({ mutationFn: async (method: BiometricMethod) => { if (!supported) throw new Error("Fingerprint or Face ID login is not supported by this browser."); if (!window.isSecureContext) throw new Error("Open Skyline Achievers using its secure website or installed app."); const origin = window.location.origin; let started; try { started = await begin({ data: { origin } }); } catch (error) { throw new Error(friendlyErrorMessage(error, "Secure device setup could not start. Sign in again, then retry.")); } const options = JSON.parse(started.optionsJson) as PublicKeyCredentialCreationOptionsJSON; const response = await startRegistration({ optionsJSON: options }); try { return await finish({ data: { challengeId: started.challengeId, deviceName: `${METHOD_LABEL[method]} · ${detectDeviceName()}`, origin, responseJson: JSON.stringify(response) } }); } catch (error) { throw new Error(friendlyErrorMessage(error, "Your phone verified you, but the device could not be saved. Please retry once.")); } }, onSuccess: () => { toast.success("Biometric Login Enabled"); void qc.invalidateQueries({ queryKey: ["passkeys"] }); }, onError: (error: Error) => toast.error(isCancelledBiometric(error) ? "Fingerprint or Face ID was cancelled." : friendlyErrorMessage(error, "This device could not be added. Please try again."), { duration: 8000 }) });
  const del = useMutation({ mutationFn: (id: string) => remove({ data: { id } }), onSuccess: () => { toast.success("Secure device removed"); void qc.invalidateQueries({ queryKey: ["passkeys"] }); }, onError: (error: Error) => toast.error(friendlyErrorMessage(error)) });
  const rows = devices.data?.devices ?? [];
  const full = rows.length >= 3;
  const busy = add.isPending;
  return <section className="glass-panel rounded-3xl p-5"><p className="flex items-center gap-2 text-sm font-semibold"><Fingerprint className="text-brand-glow" /> Biometric Login{rows.length ? <span className="ml-auto rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">Biometric Login Enabled</span> : null}</p><p className="mt-1 text-xs text-muted-foreground">Use your phone’s secure unlock. Skyline never receives your fingerprint or face data.</p><div className="mt-4 space-y-2">{rows.map((device) => <div key={device.id} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface-2 p-3">{device.name.startsWith("Face ID") ? <ScanFace className="shrink-0 text-brand-glow" /> : device.name.startsWith("Fingerprint") ? <Fingerprint className="shrink-0 text-brand-glow" /> : <Smartphone className="shrink-0 text-brand-glow" />}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{device.name}</p><p className="text-[10px] text-muted-foreground">Added {formatDateTime(device.createdAt)}{device.lastUsedAt ? ` · Used ${formatDateTime(device.lastUsedAt)}` : ""}</p></div><Button type="button" size="icon" variant="ghost" aria-label={`Remove ${device.name}`} disabled={del.isPending} onClick={() => del.mutate(device.id)}><Trash2 /></Button></div>)}{!devices.isPending && rows.length === 0 ? <p className="rounded-2xl border border-dashed border-hairline p-4 text-center text-xs text-muted-foreground">No secure device added yet.</p> : null}</div><div className="mt-4 grid grid-cols-2 gap-3"><Button type="button" variant="brand" className="h-12" disabled={!supported || busy || full} onClick={() => add.mutate("fingerprint")}>{busy && add.variables === "fingerprint" ? <Loader2 className="animate-spin" /> : <Fingerprint />} Fingerprint</Button><Button type="button" variant="brand" className="h-12" disabled={!supported || busy || full} onClick={() => add.mutate("face")}>{busy && add.variables === "face" ? <Loader2 className="animate-spin" /> : <ScanFace />} Face ID</Button></div><p className="mt-2 text-[10px] text-muted-foreground">{rows.length}/3 devices registered · Your phone opens the scanner or camera it supports.</p></section>;
}
