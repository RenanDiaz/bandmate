-- Add popularity field to songs table
-- Migration: Add popularity score (0-100, e.g. Spotify popularity)

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS popularity INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN songs.popularity IS 'Popularity score from 0 to 100 (Spotify popularity)';
