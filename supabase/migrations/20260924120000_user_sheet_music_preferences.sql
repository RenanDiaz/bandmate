-- Per-user preferred sheet music (PDF) for a song.
--
-- A song can have several PDFs (guitar, bass, full score...). The band-wide
-- order lives in song_sheet_music.position; this table records which PDF a
-- given user wants opened first in performance mode. One row per (user, song).
--
-- Rows are private to the user that owns them: RLS below only lets a user
-- read and write their own preferences. Deleting the PDF or the song removes
-- the preference through the foreign keys.

CREATE TABLE IF NOT EXISTS user_sheet_music_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  sheet_music_id UUID NOT NULL REFERENCES song_sheet_music(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, song_id)
);

COMMENT ON TABLE user_sheet_music_preferences IS
  'Which sheet music PDF each user wants opened first for a song (performance mode).';
COMMENT ON COLUMN user_sheet_music_preferences.sheet_music_id IS
  'The preferred song_sheet_music row. Must belong to song_id (checked in the app).';

CREATE INDEX IF NOT EXISTS idx_user_sheet_music_preferences_sheet
  ON user_sheet_music_preferences(sheet_music_id);

-- Reuse the shared updated_at trigger function (created by SHEET_MUSIC_MIGRATION.sql).
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_sheet_music_preferences_updated_at
  ON user_sheet_music_preferences;
CREATE TRIGGER update_user_sheet_music_preferences_updated_at
  BEFORE UPDATE ON user_sheet_music_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY: each user sees only their own rows
-- ============================================

ALTER TABLE user_sheet_music_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their sheet music preferences"
  ON user_sheet_music_preferences;
CREATE POLICY "Users can view their sheet music preferences"
ON user_sheet_music_preferences
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Insert/update additionally require that the user can see the PDF, i.e. is
-- a member of the band that owns the song (song_sheet_music has its own
-- SELECT policy for that).
DROP POLICY IF EXISTS "Users can insert their sheet music preferences"
  ON user_sheet_music_preferences;
CREATE POLICY "Users can insert their sheet music preferences"
ON user_sheet_music_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM song_sheet_music sm
    WHERE sm.id = user_sheet_music_preferences.sheet_music_id
    AND sm.song_id = user_sheet_music_preferences.song_id
  )
);

DROP POLICY IF EXISTS "Users can update their sheet music preferences"
  ON user_sheet_music_preferences;
CREATE POLICY "Users can update their sheet music preferences"
ON user_sheet_music_preferences
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM song_sheet_music sm
    WHERE sm.id = user_sheet_music_preferences.sheet_music_id
    AND sm.song_id = user_sheet_music_preferences.song_id
  )
);

DROP POLICY IF EXISTS "Users can delete their sheet music preferences"
  ON user_sheet_music_preferences;
CREATE POLICY "Users can delete their sheet music preferences"
ON user_sheet_music_preferences
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
