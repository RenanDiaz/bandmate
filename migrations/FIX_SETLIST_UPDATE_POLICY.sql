-- Fix Setlist Update Policy
-- This migration fixes the UPDATE policy for setlists by adding WITH CHECK clause
-- and ensures all setlist policies are correctly configured.
--
-- Run this in Supabase SQL Editor if you're getting "Failed to save setlist" errors.

-- ============================================================================
-- 1. ENSURE BAND_MEMBERS CONSTRAINT ALLOWS 'admin' ROLE
-- ============================================================================

ALTER TABLE band_members DROP CONSTRAINT IF EXISTS band_members_role_check;
ALTER TABLE band_members ADD CONSTRAINT band_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'guest'));

-- ============================================================================
-- 2. FIX SETLISTS UPDATE POLICY (add WITH CHECK clause)
-- ============================================================================

-- Drop existing update policy
DROP POLICY IF EXISTS "Band members can update setlists" ON setlists;

-- Create new UPDATE policy with both USING and WITH CHECK
-- USING: which rows can be selected for update
-- WITH CHECK: what values the row can be updated to
CREATE POLICY "Band members can update setlists"
  ON setlists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = setlists.band_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = setlists.band_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- ============================================================================
-- 3. FIX SETLISTS INSERT POLICY
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
-- 4. FIX SETLISTS DELETE POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Band owners and setlist creators can delete setlists" ON setlists;
DROP POLICY IF EXISTS "Band members can delete setlists" ON setlists;

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
-- 5. VERIFY SETLISTS SELECT POLICY EXISTS
-- ============================================================================

-- Ensure the SELECT policy exists (this should already be there)
DROP POLICY IF EXISTS "Band members can view band setlists" ON setlists;

CREATE POLICY "Band members can view band setlists"
  ON setlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = setlists.band_id
      AND bm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. DIAGNOSTIC QUERIES
-- ============================================================================

-- Show all policies on setlists table
SELECT
  policyname as policy_name,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'setlists'
ORDER BY policyname;

-- Show current user's band memberships (run this while logged in as affected user)
-- SELECT bm.band_id, bm.role, b.name as band_name
-- FROM band_members bm
-- JOIN bands b ON b.id = bm.band_id
-- WHERE bm.user_id = auth.uid();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Setlist policy fix completed successfully!';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  - Added WITH CHECK to UPDATE policy';
  RAISE NOTICE '  - Ensured admin role is allowed in all policies';
  RAISE NOTICE '  - Recreated SELECT, INSERT, UPDATE, DELETE policies';
  RAISE NOTICE '';
  RAISE NOTICE 'If you still have issues, run this query to check your role:';
  RAISE NOTICE '  SELECT band_id, role FROM band_members WHERE user_id = auth.uid();';
END $$;
