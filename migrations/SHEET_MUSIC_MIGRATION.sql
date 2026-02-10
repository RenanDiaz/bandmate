-- Sheet Music Migration
-- Creates song_sheet_music table for multiple PDFs per song
-- Also creates the storage bucket for PDF files
-- Run this in Supabase SQL Editor

-- ============================================
-- SONG SHEET MUSIC TABLE
-- ============================================

-- Create the song_sheet_music table
CREATE TABLE IF NOT EXISTS song_sheet_music (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- e.g., "Guitar", "Bass", "Full Score"
  instrument TEXT,                       -- Optional: for filtering/icons
  file_url TEXT NOT NULL,                -- Path in Supabase Storage
  page_timings JSONB DEFAULT '[]'::jsonb, -- Array of {page, startTime}
  position INTEGER DEFAULT 0,            -- For ordering
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sheet_music_song_id ON song_sheet_music(song_id);
CREATE INDEX IF NOT EXISTS idx_sheet_music_position ON song_sheet_music(song_id, position);

-- Add comments for documentation
COMMENT ON TABLE song_sheet_music IS 'Stores sheet music PDFs for songs. Each song can have multiple PDFs (one per instrument).';
COMMENT ON COLUMN song_sheet_music.name IS 'Display name for the sheet music (e.g., Guitar, Piano, Vocals)';
COMMENT ON COLUMN song_sheet_music.instrument IS 'Optional instrument identifier for filtering and icons';
COMMENT ON COLUMN song_sheet_music.file_url IS 'Path to PDF file in Supabase Storage (sheet-music bucket)';
COMMENT ON COLUMN song_sheet_music.page_timings IS 'JSONB array of page timing data for syncing with audio: [{page: 1, startTime: 0.0}, ...]';
COMMENT ON COLUMN song_sheet_music.position IS 'Order position for displaying multiple sheet music files';

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_sheet_music_updated_at ON song_sheet_music;
CREATE TRIGGER update_sheet_music_updated_at
  BEFORE UPDATE ON song_sheet_music
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE song_sheet_music ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view sheet music for songs in their bands
CREATE POLICY "Users can view sheet music for their bands"
ON song_sheet_music
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM songs s
    JOIN band_members bm ON bm.band_id = s.band_id
    WHERE s.id = song_sheet_music.song_id
    AND bm.user_id = auth.uid()
  )
);

-- Policy: Users can insert sheet music for songs in bands they can edit
CREATE POLICY "Users can insert sheet music for editable bands"
ON song_sheet_music
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM songs s
    JOIN band_members bm ON bm.band_id = s.band_id
    WHERE s.id = song_sheet_music.song_id
    AND bm.user_id = auth.uid()
    AND bm.role IN ('owner', 'admin', 'member')
  )
);

-- Policy: Users can update sheet music for songs in bands they can edit
CREATE POLICY "Users can update sheet music for editable bands"
ON song_sheet_music
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM songs s
    JOIN band_members bm ON bm.band_id = s.band_id
    WHERE s.id = song_sheet_music.song_id
    AND bm.user_id = auth.uid()
    AND bm.role IN ('owner', 'admin', 'member')
  )
);

-- Policy: Users can delete sheet music for songs in bands they can edit
CREATE POLICY "Users can delete sheet music for editable bands"
ON song_sheet_music
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM songs s
    JOIN band_members bm ON bm.band_id = s.band_id
    WHERE s.id = song_sheet_music.song_id
    AND bm.user_id = auth.uid()
    AND bm.role IN ('owner', 'admin', 'member')
  )
);

-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================

-- Create the sheet-music storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sheet-music',
  'sheet-music',
  false,
  52428800, -- 50MB limit per file
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload sheet music for their bands" ON storage.objects;
DROP POLICY IF EXISTS "Users can view sheet music from their bands" ON storage.objects;
DROP POLICY IF EXISTS "Users can update sheet music for editable bands" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete sheet music for editable bands" ON storage.objects;

-- Policy: Users can upload sheet music for songs in their bands
-- File path format: {bandId}/{songId}/{sheetMusicId}.pdf
CREATE POLICY "Users can upload sheet music for their bands"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sheet-music'
  AND (storage.foldername(name))[1] IN (
    SELECT band_id::text FROM band_members WHERE user_id = auth.uid()
  )
);

-- Policy: Users can view sheet music from their bands
CREATE POLICY "Users can view sheet music from their bands"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'sheet-music'
  AND (storage.foldername(name))[1] IN (
    SELECT band_id::text FROM band_members WHERE user_id = auth.uid()
  )
);

-- Policy: Users can update sheet music for songs in bands they can edit
CREATE POLICY "Users can update sheet music for editable bands"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'sheet-music'
  AND (storage.foldername(name))[1] IN (
    SELECT band_id::text FROM band_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'member')
  )
);

-- Policy: Users can delete sheet music for songs in bands they can edit
CREATE POLICY "Users can delete sheet music for editable bands"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'sheet-music'
  AND (storage.foldername(name))[1] IN (
    SELECT band_id::text FROM band_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin', 'member')
  )
);

-- ============================================
-- CLEANUP OLD COLUMNS (Optional - run after migration)
-- ============================================

-- If you had previously added sheet_music_url and sheet_music_page_timings to songs table,
-- you can remove them after migrating data:
-- ALTER TABLE songs DROP COLUMN IF EXISTS sheet_music_url;
-- ALTER TABLE songs DROP COLUMN IF EXISTS sheet_music_page_timings;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Sheet music migration completed successfully!';
  RAISE NOTICE 'Created table: song_sheet_music with RLS policies';
  RAISE NOTICE 'Created storage bucket: sheet-music with policies';
END $$;
