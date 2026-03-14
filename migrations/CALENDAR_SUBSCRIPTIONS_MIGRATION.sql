-- Calendar Subscriptions Migration
-- Allows users to generate unique tokens for iCal feed subscriptions
-- Run this in Supabase SQL Editor

-- Create calendar_subscriptions table
CREATE TABLE IF NOT EXISTS calendar_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id BIGINT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT uuid_generate_v4(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One active subscription per user per band
  UNIQUE(band_id, user_id)
);

-- Index for fast token lookups (used by the Edge Function)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_subscriptions_token ON calendar_subscriptions(token);
CREATE INDEX IF NOT EXISTS idx_calendar_subscriptions_band_user ON calendar_subscriptions(band_id, user_id);

-- Enable RLS
ALTER TABLE calendar_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own calendar subscriptions"
  ON calendar_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Users can create subscriptions for bands they belong to
CREATE POLICY "Users can create calendar subscriptions"
  ON calendar_subscriptions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = calendar_subscriptions.band_id
      AND band_members.user_id = auth.uid()
    )
  );

-- Users can update their own subscriptions
CREATE POLICY "Users can update own calendar subscriptions"
  ON calendar_subscriptions FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete own calendar subscriptions"
  ON calendar_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_calendar_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calendar_subscriptions_updated_at ON calendar_subscriptions;
CREATE TRIGGER calendar_subscriptions_updated_at
  BEFORE UPDATE ON calendar_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_subscriptions_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Calendar subscriptions migration completed successfully!';
END $$;
