/**
 * Who receives a band push notification (docs/specs/band-push-notifications.md
 * §1 decision 3). Dependency-free, like pushMessages.ts; tested from
 * `src/lib/__tests__/pushRecipients.test.ts`.
 */

export interface MemberRow {
  user_id: string;
  expires_at: string | null;
}

/**
 * Every current member except the actor and the users who muted the band.
 * Guests are members too; a guest whose `expires_at` has passed is not.
 */
export function selectRecipients(
  members: MemberRow[],
  mutedUserIds: Iterable<string>,
  actorId: string,
  now: Date
): string[] {
  const muted = new Set(mutedUserIds);
  const recipients = new Set<string>();
  for (const member of members) {
    if (member.user_id === actorId || muted.has(member.user_id)) continue;
    if (member.expires_at && new Date(member.expires_at).getTime() <= now.getTime()) continue;
    recipients.add(member.user_id);
  }
  return [...recipients];
}

/**
 * The recipient of an invitation event: the invitee alone, unless they are
 * the actor, already a member, or muted the band (a mute left over from an
 * earlier membership still means "nothing about this band").
 */
export function selectInvitee(
  inviteeId: unknown,
  memberUserIds: Iterable<string>,
  mutedUserIds: Iterable<string>,
  actorId: string
): string[] {
  if (typeof inviteeId !== "string" || !inviteeId || inviteeId === actorId) return [];
  if (new Set(memberUserIds).has(inviteeId) || new Set(mutedUserIds).has(inviteeId)) return [];
  return [inviteeId];
}

/** A push service answer that means the subscription is gone for good. */
export function isSubscriptionGone(status: number): boolean {
  return status === 404 || status === 410;
}

/** Compares two secrets in time independent of where they first differ. */
export function secretsMatch(given: string | null, expected: string): boolean {
  if (given === null || expected.length === 0) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(given);
  const b = encoder.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) {
    diff |= (a[i] ?? 0) ^ b[i];
  }
  return diff === 0;
}
