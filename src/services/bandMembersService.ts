import { supabase } from "../lib/supabaseClient";
import { getSessionUser } from "../lib/authSession";

export type BandRole = "owner" | "admin" | "member" | "guest";
export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export interface BandMember {
  id: string;
  band_id: number;
  user_id: string;
  role: BandRole;
  invited_by: string | null;
  joined_at: string;
  expires_at: string | null;
  created_at: string;
  // Populated from auth.users via join
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

export interface BandInvitation {
  id: string;
  band_id: number;
  email: string;
  role: BandRole;
  invited_by: string;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  // Joined data
  band?: {
    id: number;
    name: string;
  };
  inviter_name?: string;
}

export interface CreateInvitationInput {
  band_id: number;
  email: string;
  role: Exclude<BandRole, "owner">;
  expires_in_days?: number;
}

export interface CreateInvitationResult {
  invitation: BandInvitation;
  /** Whether the invitation email was successfully dispatched via the Edge Function. */
  emailSent: boolean;
  /** Present when emailSent is false: the reason the email could not be sent. */
  emailError?: string;
}

export interface UpdateMemberRoleInput {
  role: BandRole;
}

/**
 * Get all members of a band
 */
export async function getBandMembers(bandId: number): Promise<BandMember[]> {
  // First, try using the RPC function
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_band_members_with_emails", {
    band_id_param: bandId,
  });

  // If RPC function exists and works, use it
  if (!rpcError && rpcData) {
    return rpcData;
  }

  // Fallback: get band_members and fetch display names individually
  console.warn("RPC function not available, fetching with individual lookups:", rpcError);
  const { data, error } = await supabase
    .from("band_members")
    .select("*")
    .eq("band_id", bandId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  const members = data || [];

  // Fetch display names for all members using the RPC function
  const displayNames: Record<string, string> = {};
  for (const member of members) {
    try {
      const { data: displayName } = await supabase.rpc("get_user_display_name", {
        user_id_param: member.user_id,
      });
      if (displayName) {
        displayNames[member.user_id] = displayName;
      }
    } catch {
      // Function may not exist
    }
  }

  return members.map((member: any) => ({
    ...member,
    email: displayNames[member.user_id] || "Band member",
  }));
}

/**
 * Get current user's role in a band
 */
export async function getUserBandRole(bandId: number): Promise<BandRole | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("band_members")
    .select("role")
    .eq("band_id", bandId)
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data?.role as BandRole;
}

/**
 * Check if current user is a band owner
 */
export async function isUserBandOwner(bandId: number): Promise<boolean> {
  const role = await getUserBandRole(bandId);
  return role === "owner";
}

/**
 * Check if current user is a band member (any role)
 */
export async function isUserBandMember(bandId: number): Promise<boolean> {
  const role = await getUserBandRole(bandId);
  return role !== null;
}

/**
 * Add a member to a band (used after invitation acceptance)
 */
export async function addBandMember(
  bandId: number,
  userId: string,
  role: BandRole,
  invitedBy?: string,
  expiresAt?: string
): Promise<BandMember> {
  const { data, error } = await supabase
    .from("band_members")
    .insert([
      {
        band_id: bandId,
        user_id: userId,
        role,
        invited_by: invitedBy,
        expires_at: expiresAt,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  memberId: string,
  updates: UpdateMemberRoleInput
): Promise<BandMember> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("band_members")
    .update(updates)
    .eq("id", memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a member from a band
 */
export async function removeBandMember(memberId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("band_members")
    .delete()
    .eq("id", memberId);

  if (error) throw error;
}

/**
 * Leave a band (remove yourself)
 */
export async function leaveBand(bandId: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("band_members")
    .delete()
    .eq("band_id", bandId)
    .eq("user_id", user.id);

  if (error) throw error;
}

/**
 * Create an invitation to join a band
 */
export async function createBandInvitation(
  invitation: CreateInvitationInput
): Promise<CreateInvitationResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Generate a unique token
  const token = crypto.randomUUID();

  // Calculate expiration date
  const expiresInDays = invitation.expires_in_days || 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data, error } = await supabase
    .from("band_invitations")
    .insert([
      {
        band_id: invitation.band_id,
        email: invitation.email,
        role: invitation.role,
        invited_by: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;

  // Send email via Edge Function (non-blocking).
  // The invitation is already created at this point, so email failures must NOT
  // throw - instead we report them back so the caller can tell the user the
  // invitation exists but the email didn't go out (they can share the link).
  //
  // Note: supabase.functions.invoke only throws on transport-level failures.
  // When the Edge Function itself responds with a non-2xx status, the failure
  // is returned in the `error` field (a FunctionsHttpError), so we must inspect
  // it explicitly rather than relying on try/catch alone.
  let emailSent = false;
  let emailError: string | undefined;
  try {
    const { error: invokeError } = await supabase.functions.invoke(
      "send-invitation-email",
      { body: { invitationId: data.id } }
    );
    if (invokeError) {
      emailError = invokeError.message || "Failed to send invitation email";
      console.warn("Failed to send invitation email:", invokeError);
    } else {
      emailSent = true;
    }
  } catch (err) {
    emailError = err instanceof Error ? err.message : "Failed to send invitation email";
    console.warn("Failed to send invitation email:", err);
  }

  return { invitation: data, emailSent, emailError };
}

/**
 * Get all invitations for a band
 */
export async function getBandInvitations(bandId: number): Promise<BandInvitation[]> {
  const { data, error } = await supabase
    .from("band_invitations")
    .select("*")
    .eq("band_id", bandId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Fetch inviter names
  const invitations = data || [];
  const inviterIds = [...new Set(invitations.map((inv) => inv.invited_by))];

  const inviterNames: Record<string, string> = {};
  for (const inviterId of inviterIds) {
    try {
      const { data: inviterData } = await supabase.rpc("get_user_display_name", {
        user_id_param: inviterId,
      });
      if (inviterData) {
        inviterNames[inviterId] = inviterData;
      }
    } catch {
      // Function may not exist, use fallback
    }
  }

  return invitations.map((inv) => ({
    ...inv,
    inviter_name: inviterNames[inv.invited_by] || "Unknown",
  }));
}

/**
 * Get invitations for current user's email
 */
export async function getMyInvitations(): Promise<BandInvitation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("band_invitations")
    .select(`
      *,
      band:bands (
        id,
        name
      )
    `)
    .eq("email", user.email)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Fetch inviter names using a separate query since we can't join auth.users directly
  const invitations = data || [];
  const inviterIds = [...new Set(invitations.map((inv) => inv.invited_by))];

  // Try to get inviter names via RPC function (if available)
  const inviterNames: Record<string, string> = {};
  for (const inviterId of inviterIds) {
    try {
      const { data: inviterData } = await supabase.rpc("get_user_display_name", {
        user_id_param: inviterId,
      });
      if (inviterData) {
        inviterNames[inviterId] = inviterData;
      }
    } catch {
      // Function may not exist, use fallback
    }
  }

  return invitations.map((inv) => ({
    ...inv,
    inviter_name: inviterNames[inv.invited_by] || "A band member",
  }));
}

/**
 * Accept a band invitation
 */
export async function acceptInvitation(invitationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Get the invitation
  const { data: invitation, error: invError } = await supabase
    .from("band_invitations")
    .select("*")
    .eq("id", invitationId)
    .single();

  if (invError) throw invError;
  if (!invitation) throw new Error("Invitation not found");

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    throw new Error("Invitation has expired");
  }

  // Add user as member
  await addBandMember(
    invitation.band_id,
    user.id,
    invitation.role,
    invitation.invited_by
  );

  // Mark invitation as accepted
  const { error: updateError } = await supabase
    .from("band_invitations")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", invitationId);

  if (updateError) throw updateError;
}

/**
 * Decline a band invitation
 */
export async function declineInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from("band_invitations")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", invitationId);

  if (error) throw error;
}

/**
 * Cancel/revoke an invitation (for band owners)
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from("band_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) throw error;
}

/**
 * Get invitation by token (for accepting via link)
 */
export async function getInvitationByToken(token: string): Promise<BandInvitation | null> {
  const { data, error } = await supabase
    .from("band_invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (error) return null;
  return data;
}

// ============================================
// Permission Utilities
// ============================================

/**
 * Check if a role can edit content (songs, setlists)
 * Allowed: owner, admin, member
 */
export function canEditContent(role: BandRole | null): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

/**
 * Check if a role can manage shows and rehearsals
 * Allowed: owner, admin, member
 */
export function canManageEvents(role: BandRole | null): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

/**
 * Check if a role can access band settings
 * Allowed: owner, admin
 */
export function canManageBandSettings(role: BandRole | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Check if a role can manage band members
 * Allowed: owner only
 */
export function canManageMembers(role: BandRole | null): boolean {
  return role === "owner";
}

/**
 * Check if current user can edit content in a band
 */
export async function canUserEditContent(bandId: number): Promise<boolean> {
  const role = await getUserBandRole(bandId);
  return canEditContent(role);
}

/**
 * Check if current user can manage events in a band
 */
export async function canUserManageEvents(bandId: number): Promise<boolean> {
  const role = await getUserBandRole(bandId);
  return canManageEvents(role);
}

// ============================================
// Sign-in help email (docs/specs/member-sign-in-help.md)
// ============================================

export type SignInHelpFailure =
  | "not-authenticated"
  | "forbidden"
  | "member-not-found"
  | "no-email"
  | "network"
  | "failed";

export type SignInHelpResult =
  | { ok: true }
  | { ok: false; reason: "too-soon"; retryAfterSeconds: number }
  | { ok: false; reason: SignInHelpFailure };

const SIGN_IN_HELP_FAILURES: readonly string[] = [
  "not-authenticated",
  "forbidden",
  "member-not-found",
  "no-email",
];

/**
 * Reads the `send-sign-in-help` error body (`{ error, retryAfterSeconds? }`)
 * into a result. Exported for tests.
 */
export function signInHelpResultFromBody(body: unknown): SignInHelpResult {
  const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (data.error === "too-soon") {
    const seconds = Number(data.retryAfterSeconds);
    return {
      ok: false,
      reason: "too-soon",
      retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 600,
    };
  }
  if (typeof data.error === "string" && SIGN_IN_HELP_FAILURES.includes(data.error)) {
    return { ok: false, reason: data.error as SignInHelpFailure };
  }
  return { ok: false, reason: "failed" };
}

/**
 * Emails a member of the band how to sign in to Bandmate (owner only; the
 * Edge Function re-checks the role, the membership and a per-recipient
 * limit). Never throws: failures come back as a result.
 */
export async function sendSignInHelpEmail(
  bandId: number,
  memberUserId: string,
  locale: string
): Promise<SignInHelpResult> {
  try {
    const { error } = await supabase.functions.invoke("send-sign-in-help", {
      body: { bandId, memberUserId, locale },
    });
    if (!error) return { ok: true };

    // FunctionsHttpError: the function answered non-2xx; its Response is in `context`.
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        return signInHelpResultFromBody(await context.clone().json());
      } catch {
        return { ok: false, reason: "failed" };
      }
    }
    // FunctionsFetchError / FunctionsRelayError: the request never reached it.
    console.warn("Failed to send sign-in help email:", error);
    return { ok: false, reason: error.name === "FunctionsFetchError" ? "network" : "failed" };
  } catch (err) {
    console.warn("Failed to send sign-in help email:", err);
    return { ok: false, reason: "network" };
  }
}
