// A failing request can answer with a whole error web page instead of a short
// sentence. Never show that raw text to a member — reduce it to one clear line.
const FALLBACK = "Something went wrong. Please try again.";

export function friendlyErrorMessage(error: unknown, fallback = FALLBACK): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const message = raw.trim();
  if (!message) return fallback;
  if (/^<|<!doctype|<html|didn't load|\[object /i.test(message)) return fallback;
  if (message.length > 160) return fallback;
  return message;
}

export function isCancelledBiometric(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "NotAllowedError" || error.name === "AbortError";
}
