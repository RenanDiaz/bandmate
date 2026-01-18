-- Fix Band Role Permissions Migration
-- This migration:
-- 1. Adds 'admin' role to band_members table constraint
-- 2. Updates RLS policies for songs and setlists to include 'admin' role
-- 3. Allows members (not just owners) to delete songs/setlists they have access to

-- ============================================================================
-- 1. UPDATE BAND_MEMBERS TABLE TO ALLOW 'admin' ROLE
-- ============================================================================

-- Drop the existing constraint and add a new one with 'admin'
ALTER TABLE band_members DROP CONSTRAINT IF EXISTS band_members_role_check;
ALTER TABLE band_members ADD CONSTRAINT band_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'guest'));

-- ============================================================================
-- 2. UPDATE BAND_INVITATIONS TABLE TO ALLOW 'admin' ROLE
-- ============================================================================

-- Drop the existing constraint and add a new one with 'admin'
ALTER TABLE band_invitations DROP CONSTRAINT IF EXISTS band_invitations_role_check;
ALTER TABLE band_invitations ADD CONSTRAINT band_invitations_role_check
  CHECK (role IN ('admin', 'member', 'guest'));

-- ============================================================================
-- 3. UPDATE SONGS RLS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Band members can update songs" ON songs;
DROP POLICY IF EXISTS "Band owners and song creators can delete songs" ON songs;

-- Create new UPDATE policy including 'admin' role
CREATE POLICY "Band members can update songs"
  ON songs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = songs.band_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- Create new DELETE policy: owner/admin can delete any, member can delete their own
CREATE POLICY "Band members can delete songs"
  ON songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = songs.band_id
      AND bm.user_id = auth.uid()
      AND (
        bm.role IN ('owner', 'admin')
        OR (bm.role = 'member' AND songs.user_id = auth.uid())
      )
    )
  );

-- ============================================================================
-- 4. UPDATE SETLISTS RLS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Band members can update setlists" ON setlists;
DROP POLICY IF EXISTS "Band owners and setlist creators can delete setlists" ON setlists;

-- Create new UPDATE policy including 'admin' role
CREATE POLICY "Band members can update setlists"
  ON setlists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = setlists.band_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- Create new DELETE policy: owner/admin can delete any, member can delete their own
CREATE POLICY "Band members can delete setlists"
  ON setlists FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = setlists.band_id
      AND bm.user_id = auth.uid()
      AND (
        bm.role IN ('owner', 'admin')
        OR (bm.role = 'member' AND setlists.user_id = auth.uid())
      )
    )
  );

-- ============================================================================
-- 5. UPDATE SONGS CREATE POLICY TO INCLUDE 'admin'
-- ============================================================================

DROP POLICY IF EXISTS "Band members can create songs" ON songs;
CREATE POLICY "Band members can create songs"
  ON songs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = songs.band_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- ============================================================================
-- 6. UPDATE SETLISTS CREATE POLICY TO INCLUDE 'admin'
-- ============================================================================

DROP POLICY IF EXISTS "Band members can create setlists" ON setlists;
CREATE POLICY "Band members can create setlists"
  ON setlists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = setlists.band_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Band role permissions migration completed successfully!';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  - Added admin role to band_members constraint';
  RAISE NOTICE '  - Added admin role to band_invitations constraint';
  RAISE NOTICE '  - Updated songs RLS policies (create, update, delete)';
  RAISE NOTICE '  - Updated setlists RLS policies (create, update, delete)';
END $$;
