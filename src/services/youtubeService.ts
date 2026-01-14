/**
 * YouTube Music Service
 *
 * Provides YouTube Music playlist creation from setlists.
 * Uses OAuth 2.0 for user authentication via Google.
 *
 * Required scope: https://www.googleapis.com/auth/youtube
 *
 * Setup:
 * 1. Enable YouTube Data API v3 in Google Cloud Console
 * 2. Add the YouTube scope to your OAuth consent screen
 * 3. Users will need to re-authorize to grant the new scope
 */

import { supabase } from "../lib/supabaseClient";

interface YouTubeSearchResult {
  id: {
    kind: string;
    videoId?: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
}

interface YouTubePlaylist {
  id: string;
  snippet: {
    title: string;
    description: string;
  };
}

interface YouTubePlaylistItem {
  id: string;
  snippet: {
    playlistId: string;
    resourceId: {
      kind: string;
      videoId: string;
    };
  };
}

export interface PlaylistCreationResult {
  success: boolean;
  playlistId?: string;
  playlistUrl?: string;
  addedSongs: number;
  failedSongs: string[];
  error?: string;
}

export interface SongSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

class YouTubeService {
  private accessToken: string | null = null;
  private baseUrl = "https://www.googleapis.com/youtube/v3";

  /**
   * Check if user has YouTube access (Google OAuth with YouTube scope)
   */
  async hasYouTubeAccess(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) {
        return false;
      }

      // Try a simple API call to verify the token has YouTube scope
      const response = await fetch(
        `${this.baseUrl}/channels?part=id&mine=true`,
        {
          headers: {
            Authorization: `Bearer ${session.provider_token}`,
          },
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get the current access token from Supabase session
   */
  private async getAccessToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.provider_token) {
      throw new Error(
        "YouTube access not available. Please sign out and sign in again with Google to grant YouTube permissions."
      );
    }

    this.accessToken = session.provider_token;
    return this.accessToken;
  }

  /**
   * Make authenticated request to YouTube API
   */
  private async youtubeFetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("YouTube API error:", errorBody);

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "YouTube access denied. Please sign out and sign in again with Google to grant YouTube permissions."
        );
      }
      if (response.status === 429) {
        throw new Error(
          "YouTube API rate limit exceeded. Please try again later."
        );
      }

      throw new Error(`YouTube API error: ${response.status} - ${errorBody}`);
    }

    return response.json();
  }

  /**
   * Search for a video on YouTube
   */
  async searchVideo(
    title: string,
    artist?: string
  ): Promise<SongSearchResult | null> {
    const query = artist ? `${title} ${artist}` : title;
    const encodedQuery = encodeURIComponent(query);

    try {
      const data = await this.youtubeFetch<{ items: YouTubeSearchResult[] }>(
        `/search?part=snippet&q=${encodedQuery}&type=video&videoCategoryId=10&maxResults=1`
      );

      if (data.items.length === 0) {
        return null;
      }

      const item = data.items[0];
      if (!item.id.videoId) {
        return null;
      }

      return {
        videoId: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
      };
    } catch (error) {
      console.error("Error searching YouTube:", error);
      return null;
    }
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(
    title: string,
    description?: string
  ): Promise<YouTubePlaylist> {
    const data = await this.youtubeFetch<YouTubePlaylist>(
      "/playlists?part=snippet,status",
      {
        method: "POST",
        body: JSON.stringify({
          snippet: {
            title,
            description: description || `Created with Bandmate`,
          },
          status: {
            privacyStatus: "private", // Start as private, user can change later
          },
        }),
      }
    );

    return data;
  }

  /**
   * Add a video to a playlist
   */
  async addVideoToPlaylist(
    playlistId: string,
    videoId: string
  ): Promise<YouTubePlaylistItem> {
    const data = await this.youtubeFetch<YouTubePlaylistItem>(
      "/playlistItems?part=snippet",
      {
        method: "POST",
        body: JSON.stringify({
          snippet: {
            playlistId,
            resourceId: {
              kind: "youtube#video",
              videoId,
            },
          },
        }),
      }
    );

    return data;
  }

  /**
   * Create a YouTube Music playlist from a setlist
   */
  async createPlaylistFromSetlist(
    playlistName: string,
    songs: Array<{ title: string; artist?: string }>,
    description?: string,
    onProgress?: (current: number, total: number, songTitle: string) => void
  ): Promise<PlaylistCreationResult> {
    try {
      // Create the playlist
      const playlist = await this.createPlaylist(
        playlistName,
        description
      );

      const addedSongs: number[] = [];
      const failedSongs: string[] = [];

      // Search and add each song
      for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        const songLabel = song.artist
          ? `${song.title} - ${song.artist}`
          : song.title;

        if (onProgress) {
          onProgress(i + 1, songs.length, songLabel);
        }

        try {
          const result = await this.searchVideo(song.title, song.artist);

          if (result) {
            await this.addVideoToPlaylist(playlist.id, result.videoId);
            addedSongs.push(i);

            // Rate limiting: wait a bit between requests
            if (i < songs.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          } else {
            failedSongs.push(songLabel);
          }
        } catch (error) {
          console.error(`Failed to add song "${songLabel}":`, error);
          failedSongs.push(songLabel);
        }
      }

      return {
        success: true,
        playlistId: playlist.id,
        playlistUrl: `https://music.youtube.com/playlist?list=${playlist.id}`,
        addedSongs: addedSongs.length,
        failedSongs,
      };
    } catch (error) {
      console.error("Failed to create playlist:", error);
      return {
        success: false,
        addedSongs: 0,
        failedSongs: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Request YouTube authorization by triggering re-authentication
   * This will redirect the user to sign in again with the YouTube scope
   */
  async requestAuthorization(): Promise<void> {
    // Sign out first
    await supabase.auth.signOut();

    // Sign in with Google including YouTube scope
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
        scopes: "https://www.googleapis.com/auth/youtube",
      },
    });

    if (error) {
      throw error;
    }
  }
}

// Export singleton instance
export const youtubeService = new YouTubeService();
