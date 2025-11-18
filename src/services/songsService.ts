import { supabase } from "../lib/supabaseClient";

export interface Song {
  id: string;
  user_id: string;
  band_id: number;
  title: string;
  artist?: string;
  lyrics?: string;
  chords?: string;
  created_at: string;
}

export async function getMySongs(): Promise<Song[]> {
  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getBandSongs(bandId: number): Promise<Song[]> {
  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .eq("band_id", bandId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export interface CreateSongInput {
  title: string;
  band_id: number;
  artist?: string;
  lyrics?: string;
  chords?: string;
}

export async function createSong(song: CreateSongInput) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("songs")
    .insert([{ ...song, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data;
}
