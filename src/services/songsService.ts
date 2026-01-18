import { supabase } from "../lib/supabaseClient";
import { canUserEditContent } from "./bandMembersService";
import {
  transposeChordSheet,
  transposeKey,
  usesFlats,
  getSemitonesBetweenKeys,
} from "../lib/transposition";

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
  original_key?: string;
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

  // First get the song to check band membership
  const { data: song, error: fetchError } = await supabase
    .from("songs")
    .select("band_id")
    .eq("id", songId)
    .single();

  if (fetchError) throw fetchError;
  if (!song) throw new Error("Song not found");

  // Check if user has permission to edit content in this band
  const hasPermission = await canUserEditContent(song.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to edit songs in this band");
  }

  const { data, error } = await supabase
    .from("songs")
    .update(updates)
    .eq("id", songId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSong(songId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("User not authenticated");

  // First get the song to check band membership
  const { data: song, error: fetchError } = await supabase
    .from("songs")
    .select("band_id")
    .eq("id", songId)
    .single();

  if (fetchError) throw fetchError;
  if (!song) throw new Error("Song not found");

  // Check if user has permission to edit content in this band
  const hasPermission = await canUserEditContent(song.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to delete songs in this band");
  }

  const { error } = await supabase.from("songs").delete().eq("id", songId);

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

  // First get the song to check band membership
  const { data: song, error: fetchError } = await supabase
    .from("songs")
    .select("band_id")
    .eq("id", songId)
    .single();

  if (fetchError) throw fetchError;
  if (!song) throw new Error("Song not found");

  // Check if user has permission to edit content in this band
  const hasPermission = await canUserEditContent(song.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to edit songs in this band");
  }

  const { data, error } = await supabase
    .from("songs")
    .update({ timing_data: timingData })
    .eq("id", songId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Transposes a song by the given number of semitones
 *
 * @param songId - The ID of the song to transpose
 * @param semitones - Number of semitones to transpose (positive = up, negative = down)
 * @returns The updated song with transposed chords and key
 */
export async function transposeSong(
  songId: string,
  semitones: number
): Promise<Song> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("User not authenticated");

  // Get the full song data
  const { data: song, error: fetchError } = await supabase
    .from("songs")
    .select("*")
    .eq("id", songId)
    .single();

  if (fetchError) throw fetchError;
  if (!song) throw new Error("Song not found");

  // Check if user has permission to edit content in this band
  const hasPermission = await canUserEditContent(song.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to edit songs in this band");
  }

  // If this is the first transposition, save the original key
  const originalKey = song.original_key || song.key;

  // Determine if we should use flats based on the target key
  const currentKey = song.key || "C";
  const preferFlats = usesFlats(currentKey);

  // Transpose chords if present
  const transposedChords = song.chords
    ? transposeChordSheet(song.chords, semitones, preferFlats)
    : song.chords;

  // Transpose the key if present
  const transposedKey = song.key
    ? transposeKey(song.key, semitones)
    : song.key;

  // Update the song
  const { data, error } = await supabase
    .from("songs")
    .update({
      chords: transposedChords,
      key: transposedKey,
      original_key: originalKey,
    })
    .eq("id", songId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Resets a song's transposition back to its original key
 *
 * @param songId - The ID of the song to reset
 * @returns The updated song with original chords and key
 */
export async function resetSongTransposition(songId: string): Promise<Song> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) throw new Error("User not authenticated");

  // Get the full song data
  const { data: song, error: fetchError } = await supabase
    .from("songs")
    .select("*")
    .eq("id", songId)
    .single();

  if (fetchError) throw fetchError;
  if (!song) throw new Error("Song not found");

  // If there's no original key, nothing to reset
  if (!song.original_key || song.original_key === song.key) {
    return song;
  }

  // Check if user has permission to edit content in this band
  const hasPermission = await canUserEditContent(song.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to edit songs in this band");
  }

  // Calculate semitones to get back to original
  const semitones = getSemitonesBetweenKeys(song.key, song.original_key);
  const preferFlats = usesFlats(song.original_key);

  // Transpose chords back to original
  const originalChords = song.chords
    ? transposeChordSheet(song.chords, semitones, preferFlats)
    : song.chords;

  // Update the song back to original key
  const { data, error } = await supabase
    .from("songs")
    .update({
      chords: originalChords,
      key: song.original_key,
    })
    .eq("id", songId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
