-- Shows Management Migration
-- Run this in Supabase SQL Editor

-- Create show_status enum
DO $$ BEGIN
  CREATE TYPE show_status AS ENUM ('upcoming', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create shows table
CREATE TABLE IF NOT EXISTS shows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id BIGINT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  setlist_id UUID REFERENCES setlists(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  venue TEXT,
  venue_address TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  doors_time TIME,
  status show_status DEFAULT 'upcoming',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_shows_band_id ON shows(band_id);
CREATE INDEX IF NOT EXISTS idx_shows_event_date ON shows(event_date);
CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);
CREATE INDEX IF NOT EXISTS idx_shows_setlist_id ON shows(setlist_id);

-- Enable RLS
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shows (similar to setlists)
-- Users can view shows for bands they are members of
CREATE POLICY "Band members can view shows"
  ON shows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = shows.band_id
      AND band_members.user_id = auth.uid()
    )
  );

-- Members and above can create shows
CREATE POLICY "Band members can create shows"
  ON shows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = shows.band_id
      AND band_members.user_id = auth.uid()
      AND band_members.role IN ('owner', 'admin', 'member')
    )
  );

-- Members can update shows they created, owners/admins can update any
CREATE POLICY "Band members can update shows"
  ON shows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = shows.band_id
      AND band_members.user_id = auth.uid()
      AND (
        band_members.role IN ('owner', 'admin')
        OR shows.user_id = auth.uid()
      )
    )
  );

-- Only owners/admins can delete shows, or the creator
CREATE POLICY "Band members can delete shows"
  ON shows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = shows.band_id
      AND band_members.user_id = auth.uid()
      AND (
        band_members.role IN ('owner', 'admin')
        OR shows.user_id = auth.uid()
      )
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS shows_updated_at ON shows;
CREATE TRIGGER shows_updated_at
  BEFORE UPDATE ON shows
  FOR EACH ROW
  EXECUTE FUNCTION update_shows_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Shows migration completed successfully!';
END $$;
