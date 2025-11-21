/**
 * Lyrics.ovh API Service
 *
 * Free, community-sourced lyrics API.
 * No authentication required.
 *
 * API: https://lyricsovh.docs.apiary.io/
 */

interface LyricsResponse {
  lyrics: string;
}

class LyricsService {
  private baseUrl = 'https://api.lyrics.ovh/v1';

  /**
   * Get lyrics for a song
   *
   * @param artist - Artist name
   * @param title - Song title
   * @returns Lyrics string or null if not found
   */
  async getLyrics(artist: string, title: string): Promise<string | null> {
    try {
      const encodedArtist = encodeURIComponent(artist.trim());
      const encodedTitle = encodeURIComponent(title.trim());
      const url = `${this.baseUrl}/${encodedArtist}/${encodedTitle}`;

      console.log('🔍 Lyrics.ovh API Request:', url);

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('⚠️  Lyrics not found on Lyrics.ovh');
        } else {
          console.error('Lyrics.ovh API error:', response.status);
        }
        return null;
      }

      const data: LyricsResponse = await response.json();

      if (data.lyrics) {
        console.log('✅ Lyrics found!', `(${data.lyrics.length} characters)`);
        return data.lyrics.trim();
      }

      return null;

    } catch (error) {
      console.error('Error fetching lyrics:', error);
      return null;
    }
  }

  /**
   * Check if lyrics service is available
   */
  isAvailable(): boolean {
    return true; // No API key required
  }
}

// Export singleton instance
export const lyricsService = new LyricsService();
