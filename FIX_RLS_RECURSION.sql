-- Quick fix for infinite recursion in band_members RLS policy
-- Run this if you already created the tables but hit the recursion error

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view members of their bands" ON band_members;

-- Recreate it using bands table instead of band_members to avoid recursion
CREATE POLICY "Users can view members of their bands"
  ON band_members FOR SELECT
  USING (
    -- User is the band owner (check via bands table)
    EXISTS (
      SELECT 1 FROM bands
      WHERE bands.id = band_members.band_id
      AND bands.owner_id = auth.uid()
    )
    OR
    -- User is viewing their own membership record
    user_id = auth.uid()
  );

-- Verify it works
SELECT 'Policy fixed successfully!' AS status;
