import { supabase } from "../lib/supabaseClient";
import type { BandRole } from "./bandMembersService";

export interface Band {
  id: number;
  name: string;
  owner_id: string;
  created_at: string;
  genre?: string;
  description?: string;
  avatar_url?: string | null;
  // Additional fields for member context
  member_count?: number;
  user_role?: BandRole;
}

/**
 * Bands the user is a member of. Takes the id from the caller (BandContext's
 * resolved user) instead of reading the session again: with a token near
 * expiry on a weak signal, a second getSession() can wait ≈25 s (spec §7.2).
 */
export async function getMyBands(userId: string): Promise<Band[]> {

  // Get bands where user is a member (any role)
  const { data: memberData, error: memberError } = await supabase
    .from("band_members")
    .select("band_id, role")
    .eq("user_id", userId);

  if (memberError) throw memberError;

  if (!memberData || memberData.length === 0) {
    return [];
  }

  const bandIds = memberData.map((m) => m.band_id);
  const bandRoles = new Map(memberData.map((m) => [m.band_id, m.role]));

  // Get full band details
  const { data, error } = await supabase
    .from("bands")
    .select("*")
    .in("id", bandIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Add user's role to each band
  return (data || []).map((band) => ({
    ...band,
    user_role: bandRoles.get(band.id),
  }));
}

export interface CreateBandInput {
  name: string;
  genre?: string;
  description?: string;
}

export interface UpdateBandInput {
  name?: string;
  genre?: string;
  description?: string;
  avatar_url?: string | null;
}

export async function createBand(input: CreateBandInput) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("User not authenticated");

  // Create the band
  const { data, error } = await supabase
    .from("bands")
    .insert([{ ...input, owner_id: user.id }])
    .select()
    .single();

  if (error) throw error;

  // Add the creator as an owner in band_members
  const { error: memberError } = await supabase
    .from("band_members")
    .insert([
      {
        band_id: data.id,
        user_id: user.id,
        role: "owner",
      },
    ]);

  if (memberError) {
    // If member insert fails, clean up the band
    await supabase.from("bands").delete().eq("id", data.id);
    throw memberError;
  }

  return data;
}

export async function updateBand(id: number, updates: UpdateBandInput) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("User not authenticated");

  // Owner/admin enforcement is handled by the bands UPDATE RLS policy; we no
  // longer filter by owner_id here so admins can edit band details too.
  const { data, error } = await supabase
    .from("bands")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Transfer band ownership to another member. The previous owner becomes an
 * admin. Enforced server-side by the transfer_band_ownership() RPC, which
 * verifies the caller is the current owner.
 */
export async function transferBandOwnership(
  bandId: number,
  newOwnerId: string
): Promise<void> {
  const { error } = await supabase.rpc("transfer_band_ownership", {
    p_band_id: bandId,
    p_new_owner_id: newOwnerId,
  });

  if (error) throw error;
}

export async function deleteBand(id: number) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("bands")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw error;
}
