-- songs.updated_at, set by the database on every UPDATE, for the offline
-- update check (docs/specs/offline-performance-phase2-3.md §6.1–§6.2, PR 3.0):
-- the fingerprint compares it byte-for-byte to detect lyrics, chords, key,
-- tempo or timing edits of a song in a downloaded setlist.
--
-- Also adds the same BEFORE UPDATE trigger to setlists: setlists.updated_at
-- exists but is only written by setlistsService (client clock), so any other
-- write would be invisible to the fingerprint.
--
-- No RLS change: the column is covered by the existing row policies of both
-- tables. Idempotent: safe to run again on top of itself.

-- ============================================================================
-- songs
-- ============================================================================

-- Added without a default first, so the backfill below can give existing rows
-- their created_at (a DEFAULT NOW() would stamp them all with the migration
-- time, which reads as "every song changed").
ALTER TABLE songs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Before the trigger exists, or this UPDATE would stamp NOW() instead.
DROP TRIGGER IF EXISTS update_songs_updated_at ON songs;

UPDATE songs
  SET updated_at = COALESCE(created_at, NOW())
  WHERE updated_at IS NULL;

ALTER TABLE songs ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE songs ALTER COLUMN updated_at SET NOT NULL;

COMMENT ON COLUMN songs.updated_at IS
  'Last update, set by the update_songs_updated_at trigger. Offline update check fingerprint.';

-- The shared trigger function already exists (baseline); recreated for safety,
-- as 20260924120000_user_sheet_music_preferences.sql does.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- setlists
-- ============================================================================

DROP TRIGGER IF EXISTS update_setlists_updated_at ON setlists;
CREATE TRIGGER update_setlists_updated_at
  BEFORE UPDATE ON setlists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
