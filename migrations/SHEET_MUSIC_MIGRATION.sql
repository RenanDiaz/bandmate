-- Sheet Music Migration
-- Adds sheet_music_url and sheet_music_page_timings fields to songs table
-- Also creates the storage bucket for PDF files
-- Run this in Supabase SQL Editor

-- Add sheet_music_url column to songs table
-- Stores the path to the PDF file in Supabase Storage
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS sheet_music_url TEXT DEFAULT NULL;

-- Add sheet_music_page_timings JSONB column for syncing PDF pages with audio
-- Structure:
-- [
--   { "page": 1, "startTime": 0.0 },
--   { "page": 2, "startTime": 45.5 },
--   { "page": 3, "startTime": 92.0 }
-- ]
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS sheet_music_page_timings JSONB DEFAULT NULL;

-- Create index for songs with sheet music (for filtering)
CREATE INDEX IF NOT EXISTS idx_songs_has_sheet_music
ON songs ((sheet_music_url IS NOT NULL));

-- Add comments for documentation
COMMENT ON COLUMN songs.sheet_music_url IS 'Path to PDF sheet music file in Supabase Storage (sheet-music bucket)';
COMMENT ON COLUMN songs.sheet_music_page_timings IS 'JSONB array containing page timing data for syncing PDF pages with audio playback';

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

-- Policy: Users can upload sheet music for songs in their bands
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

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Sheet music migration completed successfully!';
  RAISE NOTICE 'Storage bucket "sheet-music" created with RLS policies.';
END $$;
