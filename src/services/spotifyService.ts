/**
 * Spotify Web API Service
 *
 * Song metadata (album, artwork, release date, duration, popularity) from
 * Spotify. The client secret never reaches the browser: lookups go through
 * the `spotify-metadata` Edge Function (supabase/functions/spotify-metadata),
 * which holds `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` and requires a
 * signed-in user. When the function isn't set up, lookups return null and
 * the other metadata sources still answer.
 */

import { supabase } from "../lib/supabaseClient";

export interface SongMetadata {
  // Basic info
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  releaseDate?: string;
  spotifyUrl?: string;

  // Musical properties
  key?: string;          // Human-readable (e.g., "C", "D minor")
  keyNumber?: number;    // 0-11
  mode?: 'major' | 'minor';
  tempo?: number;        // BPM
  timeSignature?: number;
  duration?: number;     // seconds
  popularity?: number;   // 0-100 (Spotify popularity score)

  // Audio characteristics
  energy?: number;
  danceability?: number;
  acousticness?: number;
  instrumentalness?: number;
}

class SpotifyService {
  /**
   * The lookup is always offered: the server decides whether Spotify is set
   * up, and answers "not configured" (→ null here) when it isn't.
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Metadata of the best Spotify match for a title (and artist), or null when
   * there is none or the lookup fails. Audio features (key, tempo) are not
   * included: Spotify needs user authentication for them; the unified
   * metadataService gets them elsewhere.
   */
  async getSongMetadata(title: string, artist?: string): Promise<SongMetadata | null> {
    if (!title.trim()) return null;
    try {
      const { data, error } = await supabase.functions.invoke<{ metadata: SongMetadata | null }>(
        "spotify-metadata",
        { body: { title, artist } }
      );
      if (error) {
        console.warn("Spotify metadata lookup failed:", error.message);
        return null;
      }
      return data?.metadata ?? null;
    } catch (error) {
      console.warn("Spotify metadata lookup failed:", error);
      return null;
    }
  }
}

// Export singleton instance
export const spotifyService = new SpotifyService();
