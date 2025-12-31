import { supabase } from "../lib/supabaseClient";

export interface Setlist {
  id: string;
  band_id: number;
  user_id: string;
  name: string;
  description?: string;
  songs: SetlistSong[];
  created_at: string;
  updated_at: string;
}

export interface SetlistSong {
  song_id: string;
  position: number;
  notes?: string;
}

export interface CreateSetlistInput {
  band_id: number;
  name: string;
  description?: string;
  songs?: SetlistSong[];
}

export interface UpdateSetlistInput {
  name?: string;
  description?: string;
  songs?: SetlistSong[];
}

/**
 * Get all setlists for a band
 */
export async function getBandSetlists(bandId: number): Promise<Setlist[]> {
  const { data, error } = await supabase
    .from("setlists")
    .select("*")
    .eq("band_id", bandId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single setlist by ID
 */
export async function getSetlist(setlistId: string): Promise<Setlist> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("setlists")
    .select("*")
    .eq("id", setlistId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new setlist
 */
export async function createSetlist(setlist: CreateSetlistInput): Promise<Setlist> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("setlists")
    .insert([
      {
        ...setlist,
        user_id: user.id,
        songs: setlist.songs || [],
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing setlist
 */
export async function updateSetlist(setlistId: string, updates: UpdateSetlistInput): Promise<Setlist> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("setlists")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", setlistId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a setlist
 */
export async function deleteSetlist(setlistId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("setlists")
    .delete()
    .eq("id", setlistId)
    .eq("user_id", user.id);

  if (error) throw error;
}
