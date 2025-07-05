import { supabase } from "../lib/supabaseClient";

export interface Band {
  id: number;
  name: string;
  owner_id: string;
  created_at: string;
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

export async function createBand(name: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("bands")
    .insert([{ name, owner_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data;
}
