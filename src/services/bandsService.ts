import { supabase } from "../lib/supabaseClient";
import type { BandRole } from "./bandMembersService";

export interface Band {
  id: number;
  name: string;
  owner_id: string;
  created_at: string;
  genre?: string;
  description?: string;
  // Additional fields for member context
  member_count?: number;
  user_role?: BandRole;
}

export async function getMyBands(): Promise<Band[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("User not authenticated");

  // Get bands where user is a member (any role)
  const { data: memberData, error: memberError } = await supabase
    .from("band_members")
    .select("band_id, role")
    .eq("user_id", user.id);

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

  const { data, error } = await supabase
    .from("bands")
    .update(updates)
    .eq("id", id)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
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
