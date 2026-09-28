import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const responseSchema = z.record(z.string(), z.unknown());
const deviceNameSchema = z.string().trim().min(1).max(60);

function relyingParty() {
  const request = getRequest();
  const url = new URL(request?.url ?? "https://skyline-achievers.lovable.app");
  return { origin: url.origin, rpID: url.hostname };
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

async function createChallenge(userId: string | null, purpose: "register" | "authenticate", challenge: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("biometric_challenges")
    .insert({ user_id: userId, purpose, challenge, expires_at: new Date(Date.now() + 5 * 60_000).toISOString() })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not start secure device login.");
  return data.id;
}

async function takeChallenge(id: string, purpose: "register" | "authenticate", userId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("biometric_challenges")
    .select("id, user_id, challenge, expires_at")
    .eq("id", id)
    .eq("purpose", purpose);
  if (userId) query = query.eq("user_id", userId);
  const { data } = await query.maybeSingle();
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) throw new Error("This secure login request expired. Please try again.");
  await supabaseAdmin.from("biometric_challenges").delete().eq("id", id);
  return data;
}

export const listPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("biometric_credentials")
      .select("id, device_name, created_at, last_used_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return { devices: (data ?? []).map((row) => ({ id: row.id, name: row.device_name, createdAt: row.created_at, lastUsedAt: row.last_used_at })) };
  });

export const beginPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ count }, { data: existing }, { data: member }, { data: trainee }] = await Promise.all([
      supabaseAdmin.from("biometric_credentials").select("id", { count: "exact", head: true }).eq("user_id", context.userId),
      supabaseAdmin.from("biometric_credentials").select("credential_id, transports").eq("user_id", context.userId),
      supabaseAdmin.from("member_profiles").select("member_id, full_name").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("trainees").select("trainee_code, full_name").eq("id", context.userId).maybeSingle(),
    ]);
    if ((count ?? 0) >= 3) throw new Error("Maximum 3 secure devices are allowed. Remove one first.");
    const identity = member ? { code: member.member_id, name: member.full_name } : trainee ? { code: trainee.trainee_code, name: trainee.full_name } : null;
    if (!identity) throw new Error("No Skyline profile is linked to this account.");
    const { rpID } = relyingParty();
    const options = await generateRegistrationOptions({
      rpName: "Skyline Achievers",
      rpID,
      userName: identity.code,
      userDisplayName: identity.name,
      userID: new TextEncoder().encode(context.userId),
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((row) => ({ id: row.credential_id, transports: row.transports })),
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      preferredAuthenticatorType: "localDevice",
    });
    return { options, challengeId: await createChallenge(context.userId, "register", options.challenge) };
  });

export const finishPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { challengeId: string; deviceName: string; response: Record<string, unknown> }) => z.object({ challengeId: z.string().uuid(), deviceName: deviceNameSchema, response: responseSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const challenge = await takeChallenge(data.challengeId, "register", context.userId);
    const { origin, rpID } = relyingParty();
    const verification = await verifyRegistrationResponse({
      response: data.response as RegistrationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) throw new Error("Fingerprint or Face ID could not be verified.");
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("biometric_credentials").select("id", { count: "exact", head: true }).eq("user_id", context.userId);
    if ((count ?? 0) >= 3) throw new Error("Maximum 3 secure devices are allowed.");
    const { error } = await supabaseAdmin.from("biometric_credentials").insert({
      user_id: context.userId,
      credential_id: credential.id,
      public_key: toBase64(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      device_name: data.deviceName,
    });
    if (error) throw new Error(error.code === "23505" ? "This device is already registered." : "Could not save this secure device.");
    return { ok: true as const };
  });

export const removePasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("biometric_credentials").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true as const };
  });

export const beginPasskeyLogin = createServerFn({ method: "POST" }).handler(async () => {
  const { rpID } = relyingParty();
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  return { options, challengeId: await createChallenge(null, "authenticate", options.challenge) };
});

export const finishPasskeyLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { challengeId: string; response: Record<string, unknown> }) => z.object({ challengeId: z.string().uuid(), response: responseSchema }).parse(data))
  .handler(async ({ data }) => {
    const challenge = await takeChallenge(data.challengeId, "authenticate");
    const response = data.response as AuthenticationResponseJSON;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: stored } = await supabaseAdmin.from("biometric_credentials").select("*").eq("credential_id", response.id).maybeSingle();
    if (!stored) throw new Error("This device is not registered with Skyline Achievers.");
    const [{ data: member }, { data: trainee }] = await Promise.all([
      supabaseAdmin.from("member_profiles").select("status").eq("id", stored.user_id).maybeSingle(),
      supabaseAdmin.from("trainees").select("status").eq("id", stored.user_id).maybeSingle(),
    ]);
    if ((member && member.status !== "active") || (trainee && trainee.status !== "active") || (!member && !trainee)) throw new Error("This Skyline account is not active.");
    const { origin, rpID } = relyingParty();
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: stored.credential_id, publicKey: fromBase64(stored.public_key), counter: Number(stored.counter), transports: stored.transports },
      requireUserVerification: true,
    });
    if (!verification.verified) throw new Error("Fingerprint or Face ID could not be verified.");
    await supabaseAdmin.from("biometric_credentials").update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("id", stored.id);
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(stored.user_id);
    const email = authUser.user?.email;
    if (userError || !email) throw new Error("Could not open this Skyline account.");
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link.properties?.hashed_token;
    if (linkError || !tokenHash) throw new Error("Could not create a secure account session.");
    return { tokenHash, accountType: trainee ? "trainee" as const : "member" as const };
  });
