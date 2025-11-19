import { supabase } from "../lib/supabaseClient";

export type BandRole = "owner" | "member" | "guest";
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
}

export interface CreateInvitationInput {
  band_id: number;
  email: string;
  role: Exclude<BandRole, "owner">;
  expires_in_days?: number;
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

  // Fallback: just get band_members without emails
  console.warn("RPC function not available, fetching without emails:", rpcError);
  const { data, error } = await supabase
    .from("band_members")
    .select("*")
    .eq("band_id", bandId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  // Get current user's email to at least show it for yourself
  const { data: { user } } = await supabase.auth.getUser();

  return (data || []).map((member: any) => ({
    ...member,
    email: member.user_id === user?.id ? user?.email : `User ${member.user_id.substring(0, 8)}...`,
  }));
}

/**
 * Get current user's role in a band
 */
export async function getUserBandRole(bandId: number): Promise<BandRole | null> {
  const { data: { user } } = await supabase.auth.getUser();
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
): Promise<BandInvitation> {
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
  return data;
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
  return data || [];
}

/**
 * Get invitations for current user's email
 */
export async function getMyInvitations(): Promise<BandInvitation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("band_invitations")
    .select("*")
    .eq("email", user.email)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
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
