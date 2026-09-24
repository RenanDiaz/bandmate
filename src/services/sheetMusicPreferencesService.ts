import { supabase } from "../lib/supabaseClient";
import type { SheetMusic } from "./songSheetMusicService";

/**
 * Per-user preferred sheet music (PDF) for a song.
 *
 * The band decides the default order of a song's PDFs (song_sheet_music.position).
 * Each musician usually only reads one of them, so we remember which one they
 * picked and open it first next time. Rows live in
 * `user_sheet_music_preferences`, protected by RLS (a user only sees their own).
 */
export interface SheetMusicPreference {
  user_id: string;
  song_id: string;
  sheet_music_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get the current user's preferred sheet music for a set of songs.
 * Returns a map of song_id -> sheet_music_id. Songs without a preference are absent.
 */
export async function getMySheetMusicPreferences(
  songIds: string[]
): Promise<Record<string, string>> {
  if (songIds.length === 0) return {};

  const { data, error } = await supabase
    .from("user_sheet_music_preferences")
    .select("song_id, sheet_music_id")
    .in("song_id", songIds);

  if (error) {
    console.error("Error fetching sheet music preferences:", error);
    throw error;
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.song_id] = row.sheet_music_id;
  }
  return map;
}

/**
 * Remember `sheetMusicId` as the current user's preferred PDF for `songId`.
 */
export async function setMySheetMusicPreference(
  songId: string,
  sheetMusicId: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_sheet_music_preferences")
    .upsert(
      { user_id: user.id, song_id: songId, sheet_music_id: sheetMusicId },
      { onConflict: "user_id,song_id" }
    );

  if (error) {
    console.error("Error saving sheet music preference:", error);
    throw error;
  }
}

/**
 * Forget the current user's preference for `songId` (falls back to the band order).
 */
export async function clearMySheetMusicPreference(songId: string): Promise<void> {
  const { error } = await supabase
    .from("user_sheet_music_preferences")
    .delete()
    .eq("song_id", songId);

  if (error) {
    console.error("Error clearing sheet music preference:", error);
    throw error;
  }
}

/**
 * Pick which PDF to open first for a song, in priority order:
 *  1. the user's explicit preference for this song (if that PDF still exists),
 *  2. the first PDF whose instrument matches the user's last chosen instrument,
 *  3. the band's default: the first PDF by position.
 *
 * `list` must already be sorted by position. Returns null for an empty list.
 */
export function resolveInitialSheetMusic(
  list: SheetMusic[],
  preferredId: string | undefined,
  preferredInstrument: string | null | undefined
): SheetMusic | null {
  if (list.length === 0) return null;

  if (preferredId) {
    const explicit = list.find((sm) => sm.id === preferredId);
    if (explicit) return explicit;
  }

  if (preferredInstrument) {
    const byInstrument = list.find((sm) => sm.instrument === preferredInstrument);
    if (byInstrument) return byInstrument;
  }

  return list[0];
}

// ---------------------------------------------------------------------------
// Preferred instrument (per device, per band)
//
// A convenience heuristic, not the source of truth: when a user has no explicit
// preference for a song, we open the PDF matching the instrument they last
// picked in this band. Kept in localStorage because it is only a shortcut —
// the explicit per-song preference above is what syncs across devices.
// ---------------------------------------------------------------------------

const PREFERRED_INSTRUMENT_KEY = "bandmate_preferred_instrument";

export function getPreferredInstrument(bandId: number): string | null {
  try {
    return localStorage.getItem(`${PREFERRED_INSTRUMENT_KEY}_${bandId}`);
  } catch {
    return null;
  }
}

export function setPreferredInstrument(bandId: number, instrument: string | null | undefined): void {
  try {
    const key = `${PREFERRED_INSTRUMENT_KEY}_${bandId}`;
    if (instrument) {
      localStorage.setItem(key, instrument);
    } else {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error("Error saving preferred instrument:", String(error));
  }
}
