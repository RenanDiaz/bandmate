-- Song Transposition Migration
-- Adds original_key field to songs table for tracking transposition
-- Run this in Supabase SQL Editor

-- Add original_key column to songs table
-- This stores the original key of the song before any transposition
-- The existing 'key' field will represent the current/transposed key
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS original_key TEXT DEFAULT NULL;

-- For existing songs that have a key set, copy it to original_key
-- This ensures we preserve the original key for songs already in the database
UPDATE songs
SET original_key = key
WHERE key IS NOT NULL AND original_key IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN songs.original_key IS 'The original key of the song before transposition. The key field contains the current (possibly transposed) key.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Song transposition migration completed successfully!';
END $$;
