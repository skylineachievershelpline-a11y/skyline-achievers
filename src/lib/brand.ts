/**
 * Central branding configuration for Skyline Achievers.
 * Replace the logo asset or wording here — never in individual pages.
 */
import logoAsset from "@/assets/skyline-logo.png.asset.json";

export const BRAND = {
  name: "Skyline Achievers",
  shortName: "Skyline",
  tagline: "Learn. Earn. Lead.",
  logoUrl: logoAsset.url,
  logoAlt: "Skyline Achievers",
  supportContact: "your Skyline Achievers administrator",
} as const;

/**
 * Members sign in with a Member ID, never an email address. Auth records are
 * keyed to a deterministic internal address derived from the Member ID.
 */
export const MEMBER_AUTH_DOMAIN = "members.skyline-achievers.app";

export function normalizeMemberId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function memberIdToAuthEmail(memberId: string): string {
  return `${normalizeMemberId(memberId).toLowerCase()}@${MEMBER_AUTH_DOMAIN}`;
}

export const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  blocked: "Temporarily Blocked",
  removed: "Permanently Removed",
};

export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  pdf: "PDF",
  audio: "Audio",
  presentation: "Presentation",
  book: "Book",
  link: "Important Link",
  note: "Notes",
};
