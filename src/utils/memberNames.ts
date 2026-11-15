/**
 * What a person is called in a band (docs/specs/member-names.md): their
 * nickname in that band, else their name (`full_name`, else `name`, as
 * Google fills them), else their email. Pure; the server applies the same
 * rule in `get_band_member_names()`.
 */

/** Longest nickname the database accepts (band_members_nickname_length). */
export const NICKNAME_MAX_LENGTH = 40;

/** Longest name an account can give itself in the app. */
export const ACCOUNT_NAME_MAX_LENGTH = 80;

interface NamedMetadata {
  full_name?: unknown;
  name?: unknown;
  avatar_url?: unknown;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** The account's own name from its metadata, or null (email accounts that never set one). */
export function accountName(metadata: NamedMetadata | null | undefined): string | null {
  return text(metadata?.full_name) ?? text(metadata?.name);
}

/** The Google photo URL, or null. Only https URLs are used as an image source. */
export function avatarUrl(metadata: NamedMetadata | null | undefined): string | null {
  const url = text(metadata?.avatar_url);
  return url && url.startsWith("https://") ? url : null;
}

export function memberDisplayName(member: {
  nickname?: string | null;
  email?: string | null;
  user_metadata?: NamedMetadata | null;
}): string | null {
  return text(member.nickname) ?? accountName(member.user_metadata) ?? text(member.email);
}

/** Up to two initials of a display name ("Ana López" → "AL", "chino" → "C", an email → its first letter). */
export function initialsOf(name: string | null | undefined): string {
  const value = text(name);
  if (!value) return "?";
  if (value.includes("@")) return value[0].toUpperCase();
  const words = value.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return letters.map((w) => [...w][0]?.toUpperCase() ?? "").join("");
}

/** A nickname as stored: trimmed, empty → null. Throws past the length limit. */
export function normalizeNickname(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if ([...trimmed].length > NICKNAME_MAX_LENGTH) throw new RangeError("nickname-too-long");
  return trimmed;
}

/**
 * Whether the account signs in with Google (`app_metadata.providers`, else
 * `provider`): Google sets its name, so the app doesn't offer to edit it.
 */
export function isGoogleAccount(appMetadata: { provider?: unknown; providers?: unknown } | null | undefined): boolean {
  const providers = Array.isArray(appMetadata?.providers) ? appMetadata.providers : [appMetadata?.provider];
  return providers.includes("google");
}

