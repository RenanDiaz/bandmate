-- Song Timing Data Migration
-- Adds timing_data field to songs table for syncing lyrics/chords with audio
-- Run this in Supabase SQL Editor

-- Add timing_data JSONB column to songs table
-- Structure:
-- {
--   "sectionTimings": [
--     { "name": "Verse 1", "lineStart": 0, "lineEnd": 5, "startTime": 0.0 },
--     { "name": "Chorus", "lineStart": 6, "lineEnd": 10, "startTime": 25.5 }
--   ],
--   "lineTimings": [
--     { "lineIndex": 0, "startTime": 0.0 },
--     { "lineIndex": 1, "startTime": 4.5 }
--   ]
-- }

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS timing_data JSONB DEFAULT NULL;

-- Create index for songs with timing data (for filtering)
CREATE INDEX IF NOT EXISTS idx_songs_has_timing
ON songs ((timing_data IS NOT NULL));

-- Add comment for documentation
COMMENT ON COLUMN songs.timing_data IS 'JSONB containing timing data for syncing lyrics/chords with audio. Contains sectionTimings and/or lineTimings arrays.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Song timing data migration completed successfully!';
END $$;
