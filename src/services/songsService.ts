import { supabase } from "../lib/supabaseClient";

export interface Song {
  id: string;
  user_id: string;
  band_id: number;
  title: string;
  artist?: string;
  album?: string;
  album_art?: string;
  release_date?: string;
  spotify_url?: string;
  lyrics?: string;
  chords?: string;
  key?: string;
  tempo?: number;
  duration?: number;
  time_signature?: number;
  energy?: number;
  danceability?: number;
  tags?: string[];
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
  album?: string;
  album_art?: string;
  release_date?: string;
  spotify_url?: string;
  lyrics?: string;
  chords?: string;
  key?: string;
  tempo?: number;
  duration?: number;
  time_signature?: number;
  energy?: number;
  danceability?: number;
  tags?: string[];
}

export interface UpdateSongInput {
  title?: string;
  artist?: string;
  album?: string;
  album_art?: string;
  release_date?: string;
  spotify_url?: string;
  lyrics?: string;
  chords?: string;
  key?: string;
  tempo?: number;
  duration?: number;
  time_signature?: number;
  energy?: number;
  danceability?: number;
  tags?: string[];
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

export async function updateSong(songId: string, updates: UpdateSongInput) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("songs")
    .update(updates)
    .eq("id", songId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSong(songId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("songs")
    .delete()
    .eq("id", songId)
    .eq("user_id", user.id);

  if (error) throw error;
}
