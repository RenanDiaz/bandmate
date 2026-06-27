-- Band Avatar & Ownership Transfer Migration
-- 1. Adds an avatar_url column to the bands table
-- 2. Creates a public storage bucket for band avatars with RLS policies
-- 3. Adds a transfer_band_ownership() RPC for safely handing a band to another member
-- Run this in the Supabase SQL Editor.

-- ============================================
-- BAND AVATAR COLUMN
-- ============================================

ALTER TABLE bands
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN bands.avatar_url IS 'Public URL of the band avatar/logo stored in the band-avatars bucket';

-- ============================================
-- BAND UPDATE POLICY (owners AND admins)
-- The documented role matrix allows both owners and admins to manage band
-- settings, but the previous policy only allowed owners. Widen it so admins
-- can edit band details (name, genre, description, avatar). Ownership itself
-- is only ever changed through the transfer_band_ownership() RPC below.
-- ============================================

DROP POLICY IF EXISTS "Users can update their own bands" ON bands;
DROP POLICY IF EXISTS "Band owners can update band details" ON bands;
DROP POLICY IF EXISTS "Owners and admins can update band details" ON bands;
CREATE POLICY "Owners and admins can update band details"
  ON bands FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = bands.id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================

-- Public bucket so avatars can be rendered via a plain public URL (navbar, lists).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'band-avatars',
  'band-avatars',
  true,
  5242880, -- 5MB limit per file
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- File path format: {bandId}/avatar
-- Only owners/admins may upload, replace or remove a band's avatar.
-- ============================================

DROP POLICY IF EXISTS "Anyone can view band avatars" ON storage.objects;
DROP POLICY IF EXISTS "Owners and admins can upload band avatars" ON storage.objects;
DROP POLICY IF EXISTS "Owners and admins can update band avatars" ON storage.objects;
DROP POLICY IF EXISTS "Owners and admins can delete band avatars" ON storage.objects;

CREATE POLICY "Anyone can view band avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'band-avatars');

CREATE POLICY "Owners and admins can upload band avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'band-avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT band_id::text FROM band_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Owners and admins can update band avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'band-avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT band_id::text FROM band_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Owners and admins can delete band avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'band-avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT band_id::text FROM band_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- ============================================
-- TRANSFER OWNERSHIP RPC
-- Atomically promotes a member to owner and demotes the previous owner to admin.
-- Runs as SECURITY DEFINER but verifies the caller is the current owner.
-- ============================================

CREATE OR REPLACE FUNCTION transfer_band_ownership(
  p_band_id BIGINT,
  p_new_owner_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The caller must currently own the band.
  IF NOT EXISTS (
    SELECT 1 FROM bands WHERE id = p_band_id AND owner_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Only the current owner can transfer ownership';
  END IF;

  IF p_new_owner_id = v_caller THEN
    RAISE EXCEPTION 'You already own this band';
  END IF;

  -- The new owner must already be a member of the band.
  IF NOT EXISTS (
    SELECT 1 FROM band_members WHERE band_id = p_band_id AND user_id = p_new_owner_id
  ) THEN
    RAISE EXCEPTION 'The new owner must be a member of the band';
  END IF;

  -- Promote the new owner.
  UPDATE band_members SET role = 'owner'
  WHERE band_id = p_band_id AND user_id = p_new_owner_id;

  -- Demote the previous owner to admin.
  UPDATE band_members SET role = 'admin'
  WHERE band_id = p_band_id AND user_id = v_caller;

  -- Point the band at its new owner.
  UPDATE bands SET owner_id = p_new_owner_id WHERE id = p_band_id;
END;
$$;

GRANT EXECUTE ON FUNCTION transfer_band_ownership(BIGINT, UUID) TO authenticated;

-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Band avatar & ownership migration completed successfully!';
  RAISE NOTICE 'Added bands.avatar_url, created band-avatars bucket, added transfer_band_ownership()';
END $$;
