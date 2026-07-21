/**
 * Unified Metadata Service
 *
 * Combines Spotify and MusicBrainz/AcousticBrainz APIs to provide
 * comprehensive song metadata without requiring user authentication.
 *
 * Strategy:
 * 1. Try Spotify first for basic metadata (artist, album, artwork, Spotify link)
 * 2. Use MusicBrainz/AcousticBrainz for audio features (key, tempo, etc.)
 * 3. Fallback to MusicBrainz for all metadata if Spotify fails
 */

import { spotifyService, type SongMetadata as SpotifySongMetadata } from './spotifyService';
import { musicBrainzService } from './musicBrainzService';
import { lyricsService } from './lyricsService';

export interface CompleteSongMetadata {
  // Basic info
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  releaseDate?: string;
  spotifyUrl?: string;
  duration?: number;     // seconds
  popularity?: number;   // 0-100 (Spotify popularity score)

  // Artist info (from MusicBrainz)
  country?: string;      // Artist's country

  // Lyrics (from Lyrics.ovh)
  lyrics?: string;

  // Musical properties (from MusicBrainz/AcousticBrainz)
  key?: string;          // Human-readable (e.g., "C", "D minor")
  tempo?: number;        // BPM
  timeSignature?: number;

  // Audio characteristics (from AcousticBrainz)
  danceability?: number; // 0.0-1.0
  acousticness?: number; // 0.0-1.0

  // Genre and classification (from AcousticBrainz)
  genre?: string;        // e.g., "Rock", "Pop", "Jazz"
  isInstrumental?: boolean; // true if instrumental

  // Mood/emotion (from AcousticBrainz)
  mood?: {
    happy?: number;      // 0.0-1.0
    sad?: number;        // 0.0-1.0
    aggressive?: number; // 0.0-1.0
  };

  // Data sources (for debugging)
  sources: {
    basic: 'spotify' | 'musicbrainz' | 'none';
    audio: 'acousticbrainz' | 'none';
    lyrics: 'lyricsovh' | 'none';
  };
}

class MetadataService {
  /**
   * Get comprehensive song metadata using hybrid approach
   */
  async getSongMetadata(title: string, artist?: string): Promise<CompleteSongMetadata | null> {
    console.log(`🔍 Fetching metadata for: "${title}" by ${artist || 'Unknown'}`);

    // Try Spotify first for basic metadata
    let spotifyData: SpotifySongMetadata | null = null;
    try {
      spotifyData = await spotifyService.getSongMetadata(title, artist);
      if (spotifyData) {
        console.log('✅ Spotify basic metadata retrieved');
      }
    } catch (error) {
      console.log('⚠️  Spotify metadata failed, will try MusicBrainz');
    }

    // Get MusicBrainz data (for audio features, artist info, and fallback metadata)
    const mbData = await musicBrainzService.getSongData(title, artist);

    // Get lyrics from Lyrics.ovh
    let lyrics: string | null = null;
    if (spotifyData?.artist || mbData.metadata?.artist || artist) {
      const artistName = spotifyData?.artist || mbData.metadata?.artist || artist!;
      lyrics = await lyricsService.getLyrics(artistName, title);
    }

    // Build complete metadata
    const metadata: CompleteSongMetadata = {
      // Use Spotify data if available, otherwise MusicBrainz
      title: spotifyData?.title || mbData.metadata?.title || title,
      artist: spotifyData?.artist || mbData.metadata?.artist || artist || 'Unknown Artist',
      album: spotifyData?.album || mbData.metadata?.album,
      releaseDate: spotifyData?.releaseDate || mbData.metadata?.releaseDate,
      duration: spotifyData?.duration || mbData.metadata?.duration,

      // Spotify-specific data
      albumArt: spotifyData?.albumArt,
      spotifyUrl: spotifyData?.spotifyUrl,
      popularity: spotifyData?.popularity,

      // Artist info from MusicBrainz
      country: mbData.artistInfo?.country,

      // Lyrics from Lyrics.ovh
      lyrics: lyrics || undefined,

      // Audio features from AcousticBrainz
      key: mbData.audioFeatures?.key,
      tempo: mbData.audioFeatures?.tempo,
      danceability: mbData.audioFeatures?.danceability,
      acousticness: mbData.audioFeatures?.acousticness,

      // Genre and classification from AcousticBrainz
      genre: mbData.audioFeatures?.genre,
      isInstrumental: mbData.audioFeatures?.isInstrumental,

      // Mood from AcousticBrainz
      mood: mbData.audioFeatures?.mood,

      // Track data sources
      sources: {
        basic: spotifyData ? 'spotify' : mbData.metadata ? 'musicbrainz' : 'none',
        audio: mbData.audioFeatures ? 'acousticbrainz' : 'none',
        lyrics: lyrics ? 'lyricsovh' : 'none',
      },
    };

    console.log('📊 Complete metadata:', {
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      country: metadata.country,
      hasAlbumArt: !!metadata.albumArt,
      hasSpotifyUrl: !!metadata.spotifyUrl,
      hasLyrics: !!metadata.lyrics,
      lyricsLength: metadata.lyrics?.length,
      hasKey: !!metadata.key,
      hasTempo: !!metadata.tempo,
      genre: metadata.genre,
      isInstrumental: metadata.isInstrumental,
      mood: metadata.mood,
      sources: metadata.sources,
    });

    // Only return if we got at least some data
    if (metadata.sources.basic === 'none' && metadata.sources.audio === 'none') {
      console.log('❌ No metadata found from any source');
      return null;
    }

    return metadata;
  }

  /**
   * Check if the metadata service is available
   */
  isAvailable(): boolean {
    return spotifyService.isConfigured();
  }

  /**
   * Get service status information
   */
  getStatus(): {
    spotify: boolean;
    musicbrainz: boolean;
  } {
    return {
      spotify: spotifyService.isConfigured(),
      musicbrainz: true, // MusicBrainz doesn't require configuration
    };
  }
}

// Export singleton instance
export const metadataService = new MetadataService();
