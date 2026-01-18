import { supabase } from "../lib/supabaseClient";
import { canUserEditContent } from "./bandMembersService";

// ============================================
// Setlist Item Types
// ============================================

/** Base properties shared by all setlist items */
interface SetlistItemBase {
  position: number;
}

/** A song item in the setlist */
export interface SetlistSongItem extends SetlistItemBase {
  type: "song";
  song_id: string;
  notes?: string;
}

/** A break/pause item (e.g., intermission, 15 min break) */
export interface SetlistBreakItem extends SetlistItemBase {
  type: "break";
  label: string;
  duration?: number; // Duration in minutes
}

/** A section header item (e.g., Set 1, Set 2, Encore) */
export interface SetlistSectionItem extends SetlistItemBase {
  type: "section";
  label: string;
}

/** A note/annotation item (e.g., tuning change, instrument swap) */
export interface SetlistNoteItem extends SetlistItemBase {
  type: "note";
  label: string;
}

/** Union type for all possible setlist items */
export type SetlistItem =
  | SetlistSongItem
  | SetlistBreakItem
  | SetlistSectionItem
  | SetlistNoteItem;

/** Special item types (non-song items) */
export type SetlistSpecialItem =
  | SetlistBreakItem
  | SetlistSectionItem
  | SetlistNoteItem;

export type SetlistItemType = SetlistItem["type"];

// ============================================
// Legacy Support
// ============================================

/** @deprecated Use SetlistSongItem instead. Kept for backward compatibility. */
export interface SetlistSong {
  song_id: string;
  position: number;
  notes?: string;
}

/** Legacy item without type field (for migration) */
interface LegacySetlistSong {
  song_id: string;
  position: number;
  notes?: string;
  type?: undefined;
}

// ============================================
// Type Guards
// ============================================

/** Check if an item is a song */
export function isSongItem(
  item: SetlistItem | LegacySetlistSong
): item is SetlistSongItem {
  return item.type === "song" || (!item.type && "song_id" in item);
}

/** Check if an item is a break */
export function isBreakItem(item: SetlistItem): item is SetlistBreakItem {
  return item.type === "break";
}

/** Check if an item is a section header */
export function isSectionItem(item: SetlistItem): item is SetlistSectionItem {
  return item.type === "section";
}

/** Check if an item is a note */
export function isNoteItem(item: SetlistItem): item is SetlistNoteItem {
  return item.type === "note";
}

/** Check if an item is any special (non-song) item */
export function isSpecialItem(item: SetlistItem): item is SetlistSpecialItem {
  return item.type === "break" || item.type === "section" || item.type === "note";
}

// ============================================
// Migration & Utility Functions
// ============================================

/**
 * Normalize a setlist item to ensure it has a type field.
 * Legacy items without type are converted to song items.
 */
export function normalizeSetlistItem(
  item: SetlistItem | LegacySetlistSong
): SetlistItem {
  if (item.type) {
    return item as SetlistItem;
  }
  // Legacy song item without type
  return {
    type: "song",
    song_id: (item as LegacySetlistSong).song_id,
    position: item.position,
    notes: (item as LegacySetlistSong).notes,
  };
}

/**
 * Normalize all items in a setlist's items array.
 * Ensures backward compatibility with legacy setlists.
 */
export function normalizeSetlistItems(
  items: (SetlistItem | LegacySetlistSong)[]
): SetlistItem[] {
  return items.map(normalizeSetlistItem);
}

/**
 * Get only the song items from a setlist (filters out special items).
 * Useful when you need to calculate duration, get song count, etc.
 */
export function getSongItems(items: SetlistItem[]): SetlistSongItem[] {
  return items.filter(isSongItem);
}

/**
 * Get the label for a setlist item (for display purposes)
 */
export function getItemLabel(item: SetlistItem): string {
  if (isSongItem(item)) {
    return item.song_id; // Will be resolved to song title by the component
  }
  return item.label;
}

// ============================================
// Setlist Interface
// ============================================

export interface Setlist {
  id: string;
  band_id: number;
  user_id: string;
  name: string;
  description?: string;
  songs: SetlistItem[]; // Now supports all item types
  youtube_playlist_url?: string; // URL of exported YouTube Music playlist
  created_at: string;
  updated_at: string;
}

export interface CreateSetlistInput {
  band_id: number;
  name: string;
  description?: string;
  songs?: SetlistItem[];
}

export interface UpdateSetlistInput {
  name?: string;
  description?: string;
  songs?: SetlistItem[];
}

/**
 * Normalize a setlist from the database (ensures all items have type field)
 */
function normalizeSetlist(setlist: Setlist): Setlist {
  return {
    ...setlist,
    songs: normalizeSetlistItems(setlist.songs || []),
  };
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
  return (data || []).map(normalizeSetlist);
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
  return normalizeSetlist(data);
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
  return normalizeSetlist(data);
}

/**
 * Update an existing setlist
 */
export async function updateSetlist(setlistId: string, updates: UpdateSetlistInput): Promise<Setlist> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // First get the setlist to check band membership
  const { data: setlist, error: fetchError } = await supabase
    .from("setlists")
    .select("band_id")
    .eq("id", setlistId)
    .single();

  if (fetchError) throw fetchError;
  if (!setlist) throw new Error("Setlist not found");

  // Check if user has permission to edit content in this band
  const hasPermission = await canUserEditContent(setlist.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to edit setlists in this band");
  }

  const { data, error } = await supabase
    .from("setlists")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", setlistId)
    .select()
    .single();

  if (error) throw error;
  return normalizeSetlist(data);
}

/**
 * Delete a setlist
 */
export async function deleteSetlist(setlistId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // First get the setlist to check band membership
  const { data: setlist, error: fetchError } = await supabase
    .from("setlists")
    .select("band_id")
    .eq("id", setlistId)
    .single();

  if (fetchError) throw fetchError;
  if (!setlist) throw new Error("Setlist not found");

  // Check if user has permission to edit content in this band
  const hasPermission = await canUserEditContent(setlist.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to delete setlists in this band");
  }

  const { error } = await supabase
    .from("setlists")
    .delete()
    .eq("id", setlistId);

  if (error) throw error;
}

/**
 * Update the YouTube playlist URL for a setlist
 */
export async function updateSetlistYouTubePlaylist(
  setlistId: string,
  youtubePlaylistUrl: string | null
): Promise<Setlist> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // First get the setlist to check band membership
  const { data: setlist, error: fetchError } = await supabase
    .from("setlists")
    .select("band_id")
    .eq("id", setlistId)
    .single();

  if (fetchError) throw fetchError;
  if (!setlist) throw new Error("Setlist not found");

  // Check if user has permission to edit content in this band
  const hasPermission = await canUserEditContent(setlist.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to edit setlists in this band");
  }

  const { data, error } = await supabase
    .from("setlists")
    .update({
      youtube_playlist_url: youtubePlaylistUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", setlistId)
    .select()
    .single();

  if (error) throw error;
  return normalizeSetlist(data);
}
