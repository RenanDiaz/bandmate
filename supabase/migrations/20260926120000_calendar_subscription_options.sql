-- Calendar feed: rehearsals, per-subscription filters and time zone.
--
-- calendar_subscriptions was created by the legacy
-- migrations/CALENDAR_SUBSCRIPTIONS_MIGRATION.sql. The calendar-feed Edge
-- Function now serves shows and rehearsals; each subscriber chooses which,
-- and the feed carries the subscriber's time zone (X-WR-TIMEZONE) so Google
-- Calendar doesn't read the band's wall-clock times as UTC.

ALTER TABLE calendar_subscriptions
  ADD COLUMN IF NOT EXISTS include_shows BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_rehearsals BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS timezone TEXT;

COMMENT ON COLUMN calendar_subscriptions.timezone IS
  'IANA time zone of the subscriber (set from the browser), sent as X-WR-TIMEZONE.';

-- The old UPDATE policy had no WITH CHECK, so a user could move their own
-- subscription to a band they don't belong to. Require membership for the
-- updated row too (the feed also re-checks membership on every request).
DROP POLICY IF EXISTS "Users can update own calendar subscriptions" ON calendar_subscriptions;
CREATE POLICY "Users can update own calendar subscriptions"
  ON calendar_subscriptions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = calendar_subscriptions.band_id
      AND band_members.user_id = auth.uid()
    )
  );
