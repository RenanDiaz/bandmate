import { supabase } from "../lib/supabaseClient";

// Timing data interfaces for syncing lyrics/chords with audio
export interface SectionTiming {
  name: string; // e.g., "Verse 1", "Chorus", "Bridge"
  lineStart: number; // First line index of the section
  lineEnd: number; // Last line index of the section
  startTime: number; // Start time in seconds
}

export interface LineTiming {
  lineIndex: number; // Line index in lyrics/chords text
  startTime: number; // Start time in seconds
}

export interface TimingData {
  sectionTimings?: SectionTiming[];
  lineTimings?: LineTiming[];
}

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
  language?: string;
  country?: string;
  created_at: string;
  has_backing_tracks?: boolean;
  timing_data?: TimingData;
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
  language?: string;
  country?: string;
  has_backing_tracks?: boolean;
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
  language?: string;
  country?: string;
  has_backing_tracks?: boolean;
  timing_data?: TimingData | null;
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

  const { error } = await supabase.from("songs").delete().eq("id", songId).eq("user_id", user.id);

  if (error) throw error;
}

// Timing data functions for syncing lyrics/chords with audio

export async function getSongTimingData(songId: string): Promise<TimingData | null> {
  const { data, error } = await supabase
    .from("songs")
    .select("timing_data")
    .eq("id", songId)
    .single();

  if (error) throw error;
  return data?.timing_data ?? null;
}

export async function updateSongTimingData(
  songId: string,
  timingData: TimingData | null
): Promise<Song> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("songs")
    .update({ timing_data: timingData })
    .eq("id", songId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
