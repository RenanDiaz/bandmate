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

export interface CompleteSongMetadata {
  // Basic info
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  releaseDate?: string;
  spotifyUrl?: string;
  duration?: number;     // seconds

  // Musical properties (from MusicBrainz/AcousticBrainz)
  key?: string;          // Human-readable (e.g., "C", "D minor")
  tempo?: number;        // BPM
  timeSignature?: number;

  // Audio characteristics (from AcousticBrainz)
  danceability?: number; // 0.0-1.0
  acousticness?: number; // 0.0-1.0

  // Data sources (for debugging)
  sources: {
    basic: 'spotify' | 'musicbrainz' | 'none';
    audio: 'acousticbrainz' | 'none';
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

    // Get MusicBrainz data (for audio features and fallback metadata)
    const mbData = await musicBrainzService.getSongData(title, artist);

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

      // Audio features from AcousticBrainz
      key: mbData.audioFeatures?.key,
      tempo: mbData.audioFeatures?.tempo,
      danceability: mbData.audioFeatures?.danceability,
      acousticness: mbData.audioFeatures?.acousticness,

      // Track data sources
      sources: {
        basic: spotifyData ? 'spotify' : mbData.metadata ? 'musicbrainz' : 'none',
        audio: mbData.audioFeatures ? 'acousticbrainz' : 'none',
      },
    };

    console.log('📊 Complete metadata:', {
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      hasAlbumArt: !!metadata.albumArt,
      hasSpotifyUrl: !!metadata.spotifyUrl,
      hasKey: !!metadata.key,
      hasTempo: !!metadata.tempo,
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
