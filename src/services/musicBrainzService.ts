/**
 * MusicBrainz + AcousticBrainz API Service
 *
 * Provides song metadata and audio features using free, open APIs.
 * No authentication required.
 *
 * MusicBrainz: https://musicbrainz.org/doc/MusicBrainz_API
 * AcousticBrainz: https://acousticbrainz.org/
 */

interface MusicBrainzRecording {
  id: string;
  title: string;
  'artist-credit': {
    name: string;
    artist: {
      id: string;
      name: string;
    };
  }[];
  releases?: {
    id: string;
    title: string;
    date?: string;
  }[];
  length?: number; // milliseconds
}

interface MusicBrainzSearchResponse {
  recordings: MusicBrainzRecording[];
}

interface AcousticBrainzHighLevel {
  danceability?: {
    all?: {
      danceable?: number;
      not_danceable?: number;
    };
  };
  mood_acoustic?: {
    all?: {
      acoustic?: number;
      not_acoustic?: number;
    };
  };
}

interface AcousticBrainzData {
  metadata?: {
    tags?: {
      musicbrainz_recordingid?: string[];
    };
  };
  rhythm?: {
    bpm?: number;
  };
  tonal?: {
    key_key?: string;
    key_scale?: string;
  };
  highlevel?: AcousticBrainzHighLevel;
}

export interface AudioFeatures {
  // Musical properties
  key?: string;          // Human-readable (e.g., "C", "D minor")
  tempo?: number;        // BPM

  // Audio characteristics
  danceability?: number; // 0.0-1.0
  acousticness?: number; // 0.0-1.0
}

export interface MusicBrainzMetadata {
  // Basic info
  title: string;
  artist: string;
  album?: string;
  releaseDate?: string;
  duration?: number;     // seconds

  // MusicBrainz IDs (for further lookups)
  recordingId?: string;
  artistId?: string;
  releaseId?: string;
}

class MusicBrainzService {
  private musicBrainzBaseUrl = 'https://musicbrainz.org/ws/2';
  private acousticBrainzBaseUrl = 'https://acousticbrainz.org/api/v1';

  // MusicBrainz requires User-Agent header
  private userAgent = 'Bandmate/1.0 ( https://github.com/yourusername/bandmate )';

  // Rate limiting: MusicBrainz allows 1 request per second
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 second

  /**
   * Rate limiter to respect MusicBrainz's 1 req/sec limit
   */
  private async rateLimitWait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Search MusicBrainz for a recording
   */
  async searchRecording(title: string, artist?: string): Promise<MusicBrainzMetadata | null> {
    await this.rateLimitWait();

    try {
      // Build search query
      let query = `recording:"${title}"`;
      if (artist) {
        query += ` AND artist:"${artist}"`;
      }

      const encodedQuery = encodeURIComponent(query);
      const url = `${this.musicBrainzBaseUrl}/recording/?query=${encodedQuery}&fmt=json&limit=1`;

      console.log('MusicBrainz API Request:', url);

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('MusicBrainz API error:', response.status);
        return null;
      }

      const data: MusicBrainzSearchResponse = await response.json();

      if (!data.recordings || data.recordings.length === 0) {
        console.log('No recordings found in MusicBrainz');
        return null;
      }

      const recording = data.recordings[0];

      const metadata: MusicBrainzMetadata = {
        title: recording.title,
        artist: recording['artist-credit']?.map(ac => ac.name).join(', ') || 'Unknown Artist',
        recordingId: recording.id,
        artistId: recording['artist-credit']?.[0]?.artist?.id,
      };

      // Add release info if available
      if (recording.releases && recording.releases.length > 0) {
        const release = recording.releases[0];
        metadata.album = release.title;
        metadata.releaseDate = release.date;
        metadata.releaseId = release.id;
      }

      // Add duration if available
      if (recording.length) {
        metadata.duration = Math.round(recording.length / 1000); // Convert ms to seconds
      }

      console.log('MusicBrainz metadata found:', metadata);
      return metadata;

    } catch (error) {
      console.error('Error searching MusicBrainz:', error);
      return null;
    }
  }

  /**
   * Get audio features from AcousticBrainz
   */
  async getAudioFeatures(musicBrainzId: string): Promise<AudioFeatures | null> {
    try {
      const url = `${this.acousticBrainzBaseUrl}/${musicBrainzId}/low-level`;

      console.log('AcousticBrainz API Request:', url);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log('AcousticBrainz data not available for this recording');
        return null;
      }

      const data: AcousticBrainzData = await response.json();

      const features: AudioFeatures = {};

      // Extract tempo (BPM)
      if (data.rhythm?.bpm) {
        features.tempo = Math.round(data.rhythm.bpm);
      }

      // Extract key and scale
      if (data.tonal?.key_key && data.tonal?.key_scale) {
        const key = data.tonal.key_key;
        const scale = data.tonal.key_scale;
        features.key = scale === 'minor' ? `${key} minor` : key;
      }

      // Try to get high-level features
      try {
        const hlUrl = `${this.acousticBrainzBaseUrl}/${musicBrainzId}/high-level`;
        const hlResponse = await fetch(hlUrl);

        if (hlResponse.ok) {
          const hlData: { highlevel: AcousticBrainzHighLevel } = await hlResponse.json();

          // Extract danceability
          if (hlData.highlevel?.danceability?.all?.danceable) {
            features.danceability = Math.round(hlData.highlevel.danceability.all.danceable * 100) / 100;
          }

          // Extract acousticness
          if (hlData.highlevel?.mood_acoustic?.all?.acoustic) {
            features.acousticness = Math.round(hlData.highlevel.mood_acoustic.all.acoustic * 100) / 100;
          }
        }
      } catch (hlError) {
        console.log('High-level features not available');
      }

      console.log('AcousticBrainz features found:', features);
      return Object.keys(features).length > 0 ? features : null;

    } catch (error) {
      console.error('Error fetching AcousticBrainz data:', error);
      return null;
    }
  }

  /**
   * Get comprehensive metadata and audio features
   */
  async getSongData(title: string, artist?: string): Promise<{
    metadata: MusicBrainzMetadata | null;
    audioFeatures: AudioFeatures | null;
  }> {
    const metadata = await this.searchRecording(title, artist);

    let audioFeatures: AudioFeatures | null = null;

    if (metadata?.recordingId) {
      audioFeatures = await this.getAudioFeatures(metadata.recordingId);
    }

    return { metadata, audioFeatures };
  }
}

// Export singleton instance
export const musicBrainzService = new MusicBrainzService();
