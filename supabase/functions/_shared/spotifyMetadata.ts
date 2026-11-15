/**
 * Request validation and the track → metadata mapping for the
 * `spotify-metadata` Edge Function, which holds the Spotify client secret
 * server-side (it used to be the public `VITE_SPOTIFY_CLIENT_SECRET`).
 * Dependency-free so the app's tests can import it
 * (src/lib/__tests__/spotifyMetadata.test.ts).
 */

export const SPOTIFY_MAX_FIELD_LENGTH = 200;

export interface SpotifyLookup {
  title: string;
  artist?: string;
}

/** Body: `{ title: string, artist?: string }`. */
export function parseSpotifyLookup(body: unknown): SpotifyLookup | null {
  if (!body || typeof body !== "object") return null;
  const { title, artist } = body as Record<string, unknown>;
  if (typeof title !== "string") return null;
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle.length > SPOTIFY_MAX_FIELD_LENGTH) return null;
  if (artist === undefined || artist === null || artist === "") return { title: cleanTitle };
  if (typeof artist !== "string" || artist.length > SPOTIFY_MAX_FIELD_LENGTH) return null;
  const cleanArtist = artist.trim();
  return cleanArtist ? { title: cleanTitle, artist: cleanArtist } : { title: cleanTitle };
}

/** Search path for the best match of a title (and artist). */
export function spotifySearchPath(lookup: SpotifyLookup): string {
  const query = lookup.artist ? `track:${lookup.title} artist:${lookup.artist}` : lookup.title;
  return `/search?q=${encodeURIComponent(query)}&type=track&limit=1`;
}

export interface SpotifyTrack {
  name: string;
  artists: { name: string }[];
  album: { name: string; release_date: string; images: { url: string }[] };
  duration_ms: number;
  popularity: number;
  external_urls: { spotify: string };
}

/** The fields the app keeps; same shape as the client's `SongMetadata`. */
export interface SpotifySongMetadata {
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  releaseDate?: string;
  spotifyUrl?: string;
  duration?: number;
  popularity?: number;
}

export function trackToMetadata(track: SpotifyTrack): SpotifySongMetadata {
  return {
    title: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    albumArt: track.album.images[0]?.url,
    releaseDate: track.album.release_date,
    spotifyUrl: track.external_urls.spotify,
    duration: Math.round(track.duration_ms / 1000),
    popularity: track.popularity,
  };
}
