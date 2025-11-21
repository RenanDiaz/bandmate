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
    value?: string;
  };
  mood_acoustic?: {
    all?: {
      acoustic?: number;
      not_acoustic?: number;
    };
  };
  mood_happy?: {
    all?: {
      happy?: number;
      not_happy?: number;
    };
  };
  mood_sad?: {
    all?: {
      sad?: number;
      not_sad?: number;
    };
  };
  mood_aggressive?: {
    all?: {
      aggressive?: number;
      not_aggressive?: number;
    };
  };
  genre_rosamerica?: {
    value?: string;  // 'roc', 'pop', 'jaz', etc.
    all?: {
      cla?: number;  // classical
      dan?: number;  // dance
      hip?: number;  // hip hop
      jaz?: number;  // jazz
      pop?: number;  // pop
      rhy?: number;  // rhythm & blues
      roc?: number;  // rock
      spe?: number;  // speech
    };
  };
  voice_instrumental?: {
    value?: string;  // 'voice' or 'instrumental'
    all?: {
      instrumental?: number;
      voice?: number;
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

  // Genre and classification
  genre?: string;        // e.g., "rock", "pop", "jazz"
  isInstrumental?: boolean; // true if instrumental, false if vocals

  // Mood/emotion
  mood?: {
    happy?: number;      // 0.0-1.0
    sad?: number;        // 0.0-1.0
    aggressive?: number; // 0.0-1.0
  };
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
   *
   * NOTE: AcousticBrainz stopped accepting submissions in 2022.
   * Only songs that were submitted before 2022 will have data available.
   */
  async getAudioFeatures(musicBrainzId: string): Promise<AudioFeatures | null> {
    try {
      const url = `${this.acousticBrainzBaseUrl}/${musicBrainzId}/low-level`;

      console.log('🔍 AcousticBrainz API Request:', url);
      console.log('ℹ️  Note: AcousticBrainz stopped accepting submissions in 2022. Limited data available.');

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const statusText = response.statusText;
        console.log(`⚠️  AcousticBrainz: No data available (${response.status} ${statusText})`);
        console.log('💡 Tip: Not all songs have AcousticBrainz data. Try a different song or enter values manually.');
        return null;
      }

      const data: AcousticBrainzData = await response.json();

      console.log('📦 Raw AcousticBrainz data keys:', Object.keys(data));
      console.log('🎵 Tonal data:', data.tonal);
      console.log('🥁 Rhythm data:', data.rhythm);

      const features: AudioFeatures = {};

      // Extract tempo (BPM)
      if (data.rhythm?.bpm) {
        features.tempo = Math.round(data.rhythm.bpm);
        console.log('✅ Tempo found:', features.tempo);
      } else {
        console.log('❌ No tempo data in response');
      }

      // Extract key and scale
      if (data.tonal?.key_key && data.tonal?.key_scale) {
        const key = data.tonal.key_key;
        const scale = data.tonal.key_scale;
        features.key = scale === 'minor' ? `${key} minor` : key;
        console.log('✅ Key found:', features.key);
      } else {
        console.log('❌ No key data in response');
        console.log('   Available tonal fields:', data.tonal ? Object.keys(data.tonal) : 'none');
      }

      // Try to get high-level features
      try {
        const hlUrl = `${this.acousticBrainzBaseUrl}/${musicBrainzId}/high-level`;
        console.log('🔍 Fetching high-level features...');
        const hlResponse = await fetch(hlUrl);

        if (hlResponse.ok) {
          const hlData: { highlevel: AcousticBrainzHighLevel } = await hlResponse.json();
          const hl = hlData.highlevel;

          console.log('📊 High-level data keys:', Object.keys(hl));

          // Extract danceability
          if (hl?.danceability?.all?.danceable) {
            features.danceability = Math.round(hl.danceability.all.danceable * 100) / 100;
            console.log('✅ Danceability found:', features.danceability);
          }

          // Extract acousticness
          if (hl?.mood_acoustic?.all?.acoustic) {
            features.acousticness = Math.round(hl.mood_acoustic.all.acoustic * 100) / 100;
            console.log('✅ Acousticness found:', features.acousticness);
          }

          // Extract genre
          if (hl?.genre_rosamerica?.value) {
            const genreMap: Record<string, string> = {
              'roc': 'Rock',
              'pop': 'Pop',
              'jaz': 'Jazz',
              'cla': 'Classical',
              'dan': 'Dance',
              'hip': 'Hip Hop',
              'rhy': 'R&B',
              'spe': 'Speech'
            };
            features.genre = genreMap[hl.genre_rosamerica.value] || hl.genre_rosamerica.value;
            console.log('✅ Genre found:', features.genre);
          }

          // Extract voice/instrumental
          if (hl?.voice_instrumental?.value) {
            features.isInstrumental = hl.voice_instrumental.value === 'instrumental';
            console.log('✅ Instrumental:', features.isInstrumental);
          }

          // Extract mood
          const mood: { happy?: number; sad?: number; aggressive?: number } = {};

          if (hl?.mood_happy?.all?.happy) {
            mood.happy = Math.round(hl.mood_happy.all.happy * 100) / 100;
          }

          if (hl?.mood_sad?.all?.sad) {
            mood.sad = Math.round(hl.mood_sad.all.sad * 100) / 100;
          }

          if (hl?.mood_aggressive?.all?.aggressive) {
            mood.aggressive = Math.round(hl.mood_aggressive.all.aggressive * 100) / 100;
          }

          if (Object.keys(mood).length > 0) {
            features.mood = mood;
            console.log('✅ Mood found:', mood);
          }
        } else {
          console.log('⚠️  High-level features not available');
        }
      } catch (hlError) {
        console.log('❌ Error fetching high-level features:', hlError);
      }

      console.log('🎉 Final AcousticBrainz features:', features);
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
