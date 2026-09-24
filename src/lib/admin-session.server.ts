import { useSession } from "@tanstack/react-start/server";
import { getRequest } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual, randomInt } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AdminSessionData = { admin?: boolean; since?: string };

function sessionConfig() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("SESSION_SECRET is not configured");
  const request = getRequest();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isHttps = forwardedProtocol === "https" || new URL(request.url).protocol === "https:";
  return {
    password,
    name: "skyline-admin",
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? ("none" as const) : ("lax" as const),
      partitioned: isHttps,
      path: "/",
    },
  };
}

export async function readAdminSession() {
  return useSession<AdminSessionData>(sessionConfig());
}

export async function isAdminRequest(): Promise<boolean> {
  const session = await readAdminSession();
  return session.data.admin === true;
}

/** Every admin server function calls this first. Never trust the UI. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminRequest())) {
    throw new Error("Administrator authorisation required.");
  }
}

function requestIp(): string {
  try {
    const request = getRequest();
    return (
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

const MAX_ATTEMPTS = 8;
const WINDOW_MINUTES = 15;

export async function verifyAdminPasscode(
  passcode: string,
  username?: string,
): Promise<{ ok: true } | { ok: false; reason: "invalid" | "throttled" }> {
  const ip = requestIp();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count } = await supabaseAdmin
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("succeeded", false)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_ATTEMPTS) return { ok: false, reason: "throttled" };

  const expected = process.env["ADMIN_PASSCODE"];
  if (!expected) throw new Error("ADMIN_PASSCODE is not configured");
  const expectedUser = process.env["ADMIN_USERNAME"];

  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  let matches = timingSafeEqual(digest(passcode ?? ""), digest(expected));

  // When a staff username is configured it must match too.
  if (expectedUser) {
    const userMatches = timingSafeEqual(
      digest((username ?? "").trim().toLowerCase()),
      digest(expectedUser.trim().toLowerCase()),
    );
    matches = matches && userMatches;
  }

  await supabaseAdmin.from("admin_login_attempts").insert({ ip, succeeded: matches });

  if (!matches) return { ok: false, reason: "invalid" };

  const session = await readAdminSession();
  await session.update({ admin: true, since: new Date().toISOString() });
  return { ok: true };
}


export async function endAdminSession(): Promise<void> {
  const session = await readAdminSession();
  await session.clear();
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

export function buildCredentialMessage(input: {
  fullName: string;
  memberId: string;
  password: string;
  levelName: string;
}): string {
  return [
    "Subject: Welcome to Skyline Achievers — Your Training Account",
    "",
    `Dear ${input.fullName},`,
    "",
    "Congratulations on successfully joining Skyline Achievers.",
    "",
    "Your official training account has been created. Please use the credentials below to access the Skyline Achievers Training Platform.",
    "",
    `Member ID: ${input.memberId}`,
    "",
    `Password: ${input.password}`,
    "",
    `Assigned Level: ${input.levelName}`,
    "",
    "Please keep your login credentials confidential and do not share them with unauthorized individuals.",
    "",
    "You can now log in to access the training resources available for your assigned level.",
    "",
    "Regards,",
    "",
    "Skyline Achievers",
    "Training & Development Team",
  ].join("\n");
}