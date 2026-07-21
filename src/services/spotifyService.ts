/**
 * Spotify Web API Service
 *
 * Provides song metadata enrichment using Spotify's Web API.
 * Uses Client Credentials flow for public data access.
 *
 * Setup:
 * 1. Create an app at https://developer.spotify.com/dashboard
 * 2. Get Client ID and Client Secret from app settings
 * 3. Add to .env: VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_CLIENT_SECRET
 */

interface SpotifyToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    release_date: string;
    images: { url: string; height: number; width: number }[];
  };
  duration_ms: number;
  popularity: number;    // 0-100
  external_urls: {
    spotify: string;
  };
}

interface SpotifyAudioFeatures {
  key: number;           // 0-11 (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
  mode: number;          // 0 = minor, 1 = major
  tempo: number;         // BPM
  time_signature: number; // 3, 4, 5, etc.
  duration_ms: number;
  energy: number;        // 0.0 to 1.0
  danceability: number;  // 0.0 to 1.0
  loudness: number;      // dB
  acousticness: number;  // 0.0 to 1.0
  instrumentalness: number; // 0.0 to 1.0
  liveness: number;      // 0.0 to 1.0
  speechiness: number;   // 0.0 to 1.0
  valence: number;       // 0.0 to 1.0 (musical positiveness)
}

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
  private clientId: string;
  private clientSecret: string;
  private token: SpotifyToken | null = null;
  private baseUrl = 'https://api.spotify.com/v1';

  constructor() {
    this.clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
    this.clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      console.warn('Spotify API credentials not configured. Set VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_CLIENT_SECRET in .env');
    }
  }

  /**
   * Check if Spotify API is configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Get access token using Client Credentials flow
   */
  private async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Spotify API not configured');
    }

    // Return cached token if still valid
    if (this.token && this.token.expires_at > Date.now()) {
      return this.token.access_token;
    }

    // Request new token
    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Failed to get Spotify access token: ${response.status}`);
    }

    const data = await response.json();
    this.token = {
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
      expires_at: Date.now() + (data.expires_in * 1000) - 60000, // Subtract 1 min for safety
    };

    return this.token.access_token;
  }

  /**
   * Make authenticated request to Spotify API
   */
  private async spotifyFetch<T>(endpoint: string): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${endpoint}`;
    console.log('Spotify API Request:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log('Spotify API Response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Spotify API error body:', errorBody);

      if (response.status === 429) {
        throw new Error('Spotify API rate limit exceeded. Please try again later.');
      }
      if (response.status === 403) {
        throw new Error(`Spotify API access forbidden (403). Check your app permissions and credentials.`);
      }
      throw new Error(`Spotify API error: ${response.status} - ${errorBody}`);
    }

    return response.json();
  }

  /**
   * Search for a track by title and artist
   */
  async searchTrack(title: string, artist?: string): Promise<SpotifyTrack | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const query = artist ? `track:${title} artist:${artist}` : title;
    const encodedQuery = encodeURIComponent(query);

    try {
      const data = await this.spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
        `/search?q=${encodedQuery}&type=track&limit=1`
      );

      if (data.tracks.items.length === 0) {
        return null;
      }

      return data.tracks.items[0];
    } catch (error) {
      console.error('Error searching Spotify:', error);
      return null;
    }
  }

  /**
   * Get audio features for a track
   *
   * NOTE: This endpoint requires user authentication in Development Mode.
   * For now, we skip this and use MusicBrainz/AcousticBrainz instead.
   *
   * @deprecated Use musicBrainzService.getAudioFeatures() instead
   */
  async getAudioFeatures(_trackId: string): Promise<SpotifyAudioFeatures | null> {
    console.warn('Spotify audio features require user authentication. Use MusicBrainz service instead.');
    return null;

    // Keeping original implementation commented for future OAuth implementation
    /*
    if (!this.isConfigured()) {
      return null;
    }

    try {
      console.log('Fetching audio features for track:', trackId);
      const data = await this.spotifyFetch<SpotifyAudioFeatures>(
        `/audio-features/${trackId}`
      );
      console.log('Audio features received:', data);
      return data;
    } catch (error) {
      console.error('Error getting audio features:', error);
      console.error('Track ID:', trackId);
      return null;
    }
    */
  }

  /**
   * Get comprehensive metadata for a song
   *
   * NOTE: Audio features (key, tempo, etc.) are NOT included from Spotify
   * due to authentication requirements. Use the unified metadataService instead.
   */
  async getSongMetadata(title: string, artist?: string): Promise<SongMetadata | null> {
    if (!this.isConfigured()) {
      console.warn('Spotify API not configured. Skipping metadata lookup.');
      return null;
    }

    try {
      // Search for track
      const track = await this.searchTrack(title, artist);
      if (!track) {
        return null;
      }

      // Build metadata object (without audio features)
      const metadata: SongMetadata = {
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        albumArt: track.album.images[0]?.url,
        releaseDate: track.album.release_date,
        spotifyUrl: track.external_urls.spotify,
        duration: Math.round(track.duration_ms / 1000),
        popularity: track.popularity,
      };

      console.log('Spotify metadata retrieved (without audio features):', metadata);
      return metadata;
    } catch (error) {
      console.error('Error getting song metadata:', error);
      return null;
    }
  }

  /**
   * Search for multiple tracks (for autocomplete/suggestions)
   */
  async searchTracks(query: string, limit: number = 10): Promise<SpotifyTrack[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const encodedQuery = encodeURIComponent(query);

    try {
      const data = await this.spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
        `/search?q=${encodedQuery}&type=track&limit=${limit}`
      );

      return data.tracks.items;
    } catch (error) {
      console.error('Error searching tracks:', error);
      return [];
    }
  }
}

// Export singleton instance
export const spotifyService = new SpotifyService();
