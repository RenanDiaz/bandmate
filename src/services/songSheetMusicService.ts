import { supabase } from "../lib/supabaseClient";
import type { PageTiming } from "./songsService";

export interface SheetMusic {
  id: string;
  song_id: string;
  name: string;
  instrument?: string;
  file_url: string;
  page_timings: PageTiming[];
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSheetMusicInput {
  song_id: string;
  name: string;
  instrument?: string;
  file_url: string;
  position?: number;
}

export interface UpdateSheetMusicInput {
  name?: string;
  instrument?: string;
  file_url?: string;
  page_timings?: PageTiming[];
  position?: number;
}

// Common instrument options for UI
export const INSTRUMENT_OPTIONS = [
  { value: "guitar", label: "Guitar", icon: "bi-music-note" },
  { value: "bass", label: "Bass", icon: "bi-music-note" },
  { value: "drums", label: "Drums", icon: "bi-music-note-beamed" },
  { value: "piano", label: "Piano/Keys", icon: "bi-music-note-list" },
  { value: "vocals", label: "Vocals", icon: "bi-mic" },
  { value: "brass", label: "Brass", icon: "bi-music-note" },
  { value: "strings", label: "Strings", icon: "bi-music-note" },
  { value: "full", label: "Full Score", icon: "bi-file-earmark-music" },
  { value: "other", label: "Other", icon: "bi-file-earmark" },
] as const;

/**
 * Get all sheet music for a song
 */
export async function getSheetMusicForSong(songId: string): Promise<SheetMusic[]> {
  const { data, error } = await supabase
    .from("song_sheet_music")
    .select("*")
    .eq("song_id", songId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching sheet music:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get a single sheet music entry by ID
 */
export async function getSheetMusicById(id: string): Promise<SheetMusic | null> {
  const { data, error } = await supabase
    .from("song_sheet_music")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("Error fetching sheet music:", error);
    throw error;
  }

  return data;
}

/**
 * Create a new sheet music entry
 */
export async function createSheetMusic(
  input: CreateSheetMusicInput
): Promise<SheetMusic> {
  // Get the next position if not provided
  let position = input.position;
  if (position === undefined) {
    const existing = await getSheetMusicForSong(input.song_id);
    position = existing.length;
  }

  const { data, error } = await supabase
    .from("song_sheet_music")
    .insert({
      song_id: input.song_id,
      name: input.name,
      instrument: input.instrument,
      file_url: input.file_url,
      position,
      page_timings: [],
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating sheet music:", error);
    throw error;
  }

  return data;
}

/**
 * Update a sheet music entry
 */
export async function updateSheetMusic(
  id: string,
  updates: UpdateSheetMusicInput
): Promise<SheetMusic> {
  const { data, error } = await supabase
    .from("song_sheet_music")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating sheet music:", error);
    throw error;
  }

  return data;
}

/**
 * Update page timings for a sheet music entry
 */
export async function updateSheetMusicPageTimings(
  id: string,
  pageTimings: PageTiming[]
): Promise<SheetMusic> {
  return updateSheetMusic(id, { page_timings: pageTimings });
}

/**
 * Delete a sheet music entry
 */
export async function deleteSheetMusic(id: string): Promise<void> {
  const { error } = await supabase
    .from("song_sheet_music")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting sheet music:", error);
    throw error;
  }
}

/**
 * Reorder sheet music entries for a song
 */
export async function reorderSheetMusic(
  songId: string,
  orderedIds: string[]
): Promise<void> {
  // Update positions based on array order
  const updates = orderedIds.map((id, index) => ({
    id,
    position: index,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from("song_sheet_music")
      .update({ position: update.position })
      .eq("id", update.id)
      .eq("song_id", songId);

    if (error) {
      console.error("Error reordering sheet music:", error);
      throw error;
    }
  }
}

/**
 * Get the icon class for an instrument
 */
export function getInstrumentIcon(instrument?: string): string {
  const option = INSTRUMENT_OPTIONS.find((o) => o.value === instrument);
  return option?.icon || "bi-file-earmark-music";
}

/**
 * Get the label for an instrument
 */
export function getInstrumentLabel(instrument?: string): string {
  const option = INSTRUMENT_OPTIONS.find((o) => o.value === instrument);
  return option?.label || instrument || "Sheet Music";
}
