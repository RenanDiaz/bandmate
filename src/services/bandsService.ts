import { supabase } from "../lib/supabaseClient";

export interface Band {
  id: number;
  name: string;
  owner_id: string;
  created_at: string;
  genre?: string;
  description?: string;
}

export async function getMyBands(): Promise<Band[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("bands")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
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

  const { data, error } = await supabase
    .from("bands")
    .insert([{ ...input, owner_id: user.id }])
    .select()
    .single();

  if (error) throw error;
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
