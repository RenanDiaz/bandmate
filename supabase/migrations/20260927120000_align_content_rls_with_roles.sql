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
-- may have) and recreated; a final guard aborts the migration unless exactly
-- one UPDATE and one DELETE policy remain per table.

-- ============================================================================
-- songs
-- ============================================================================

DROP POLICY IF EXISTS "Band members can update songs" ON songs;
DROP POLICY IF EXISTS "Band members can delete songs" ON songs;
DROP POLICY IF EXISTS "Band owners and song creators can delete songs" ON songs;
-- Legacy owner-only policies found in production (no file in the repo creates
-- them; see the baseline).
DROP POLICY IF EXISTS "Users can update their band songs" ON songs;
DROP POLICY IF EXISTS "Users can delete their band songs" ON songs;

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
-- Legacy creator-only policies found in production (`auth.uid() = user_id`:
-- the creator could still edit or delete after being demoted to guest or
-- removed from the band).
DROP POLICY IF EXISTS "Users can update their setlists" ON setlists;
DROP POLICY IF EXISTS "Users can delete their setlists" ON setlists;

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
-- Guard: exactly one UPDATE and one DELETE policy per table (AC6)
-- ============================================================================

DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(t.tablename || ' ' || c.cmd || ': ' || coalesce(n.cnt, 0), ', ')
  INTO bad
  FROM unnest(ARRAY['songs', 'setlists', 'shows', 'rehearsals']) AS t(tablename)
  CROSS JOIN unnest(ARRAY['UPDATE', 'DELETE']) AS c(cmd)
  LEFT JOIN (
    SELECT tablename, cmd, count(*) AS cnt
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename, cmd
  ) n ON n.tablename = t.tablename AND n.cmd = c.cmd
  WHERE coalesce(n.cnt, 0) <> 1;

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Expected exactly one policy per table and command, got %', bad;
  END IF;
END $$;

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
