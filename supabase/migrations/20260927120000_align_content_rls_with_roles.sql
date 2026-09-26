-- Align the UPDATE and DELETE policies of songs, setlists, shows and
-- rehearsals with the role matrix (docs/specs/content-permissions.md):
-- owner, admin and member may edit and delete ANY row of their band,
-- whoever created it; guests are read-only. `user_id` stays as attribution
-- only; it is no longer a permission input on these four tables.
--
-- Supersedes the UPDATE/DELETE policies of the legacy files
-- migrations/FIX_BAND_ROLE_PERMISSIONS.sql, FIX_SETLIST_UPDATE_POLICY.sql,
-- SHOWS_MIGRATION.sql and REHEARSALS_MIGRATION.sql. INSERT and SELECT
-- policies are not touched.
--
-- Assumes RLS is already enabled on the four tables (it is: the legacy files
-- enable it). Idempotent: every policy is dropped (under each legacy name it
-- may have) and recreated.

-- ============================================================================
-- songs
-- ============================================================================

DROP POLICY IF EXISTS "Band members can update songs" ON songs;
DROP POLICY IF EXISTS "Band members can delete songs" ON songs;
DROP POLICY IF EXISTS "Band owners and song creators can delete songs" ON songs;

CREATE POLICY "Band members can update songs"
  ON songs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = songs.band_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = songs.band_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Band members can delete songs"
  ON songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = songs.band_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- ============================================================================
-- setlists
-- ============================================================================

DROP POLICY IF EXISTS "Band members can update setlists" ON setlists;
DROP POLICY IF EXISTS "Users can update their own setlists" ON setlists;
DROP POLICY IF EXISTS "Band members can delete setlists" ON setlists;
DROP POLICY IF EXISTS "Band owners and setlist creators can delete setlists" ON setlists;
DROP POLICY IF EXISTS "Users can delete their own setlists" ON setlists;

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

CREATE POLICY "Band members can delete setlists"
  ON setlists FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = setlists.band_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- ============================================================================
-- shows
-- ============================================================================

DROP POLICY IF EXISTS "Band members can update shows" ON shows;
DROP POLICY IF EXISTS "Band members can delete shows" ON shows;

CREATE POLICY "Band members can update shows"
  ON shows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = shows.band_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = shows.band_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Band members can delete shows"
  ON shows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = shows.band_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- ============================================================================
-- rehearsals
-- ============================================================================

DROP POLICY IF EXISTS "Band members can update rehearsals" ON rehearsals;
DROP POLICY IF EXISTS "Band members can delete rehearsals" ON rehearsals;

CREATE POLICY "Band members can update rehearsals"
  ON rehearsals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = rehearsals.band_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = rehearsals.band_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Band members can delete rehearsals"
  ON rehearsals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = rehearsals.band_id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Content RLS aligned with roles.';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'UPDATE and DELETE policies recreated (owner/admin/member, any row) on:';
  RAISE NOTICE '  - songs (UPDATE now has WITH CHECK)';
  RAISE NOTICE '  - setlists';
  RAISE NOTICE '  - shows';
  RAISE NOTICE '  - rehearsals';
  RAISE NOTICE '';
  RAISE NOTICE 'Verify: SELECT tablename, policyname, cmd FROM pg_policies';
  RAISE NOTICE '  WHERE tablename IN (''songs'', ''setlists'', ''shows'', ''rehearsals'') ORDER BY 1, 3;';
END $$;
