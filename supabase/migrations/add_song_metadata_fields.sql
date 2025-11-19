-- Add metadata fields to songs table
-- Migration: Add album, Spotify URL, time signature, and audio features

-- Add new columns for enhanced song metadata
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS album TEXT,
ADD COLUMN IF NOT EXISTS album_art TEXT,
ADD COLUMN IF NOT EXISTS release_date TEXT,
ADD COLUMN IF NOT EXISTS spotify_url TEXT,
ADD COLUMN IF NOT EXISTS time_signature INTEGER,
ADD COLUMN IF NOT EXISTS energy DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS danceability DECIMAL(3,2);

-- Add comments for documentation
COMMENT ON COLUMN songs.album IS 'Album name from Spotify metadata';
COMMENT ON COLUMN songs.album_art IS 'URL to album artwork from Spotify';
COMMENT ON COLUMN songs.release_date IS 'Release date in YYYY-MM-DD format';
COMMENT ON COLUMN songs.spotify_url IS 'Spotify URL for the track';
COMMENT ON COLUMN songs.time_signature IS 'Time signature (3, 4, 5, etc.)';
COMMENT ON COLUMN songs.energy IS 'Energy level from 0.0 to 1.0 (Spotify audio features)';
COMMENT ON COLUMN songs.danceability IS 'Danceability from 0.0 to 1.0 (Spotify audio features)';

-- Add index on spotify_url for quick lookups
CREATE INDEX IF NOT EXISTS idx_songs_spotify_url ON songs(spotify_url);
