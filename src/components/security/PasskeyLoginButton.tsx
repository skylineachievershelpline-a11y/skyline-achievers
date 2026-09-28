import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { rememberCurrentAccount } from "@/lib/device-accounts";
import { friendlyErrorMessage, isCancelledBiometric } from "@/lib/friendly-error";
import { beginPasskeyLogin, finishPasskeyLogin } from "@/lib/passkeys.functions";
export function PasskeyLoginButton() {
  const navigate = useNavigate(); const begin = useServerFn(beginPasskeyLogin); const finish = useServerFn(finishPasskeyLogin); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const supported = typeof window !== "undefined" && "PublicKeyCredential" in window;
  async function login() { setBusy(true); setError(null); try { if (!window.isSecureContext) throw new Error("Open Skyline Achievers using its secure website or installed app."); const origin = window.location.origin; const started = await begin({ data: { origin } }); const options = JSON.parse(started.optionsJson) as PublicKeyCredentialRequestOptionsJSON; const response = await startAuthentication({ optionsJSON: options }); const result = await finish({ data: { challengeId: started.challengeId, origin, responseJson: JSON.stringify(response) } }); const { data, error: authError } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: "magiclink" }); if (authError || !data.session) throw new Error("Could not open your account securely."); await rememberCurrentAccount({ kind: result.accountType }); await navigate({ to: result.accountType === "trainee" ? "/beginners" : "/dashboard" }); } catch (cause) { setError(isCancelledBiometric(cause) ? "Fingerprint or Face ID was cancelled." : friendlyErrorMessage(cause, "Fingerprint login did not work. Please try again.")); } finally { setBusy(false); } }
  if (!supported) return null;
  return <div className="mt-3"><Button type="button" variant="outline" size="xl" className="w-full" disabled={busy} onClick={() => void login()}>{busy ? <Loader2 className="animate-spin" /> : <Fingerprint />} Fingerprint / Face ID</Button>{error ? <p className="mt-2 text-xs text-destructive-foreground">{error}</p> : null}</div>;
}
