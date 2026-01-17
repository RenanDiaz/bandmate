-- Rehearsals Migration
-- Run this in Supabase SQL Editor

-- Create rehearsal_status enum
DO $$ BEGIN
  CREATE TYPE rehearsal_status AS ENUM ('scheduled', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create rehearsals table
CREATE TABLE IF NOT EXISTS rehearsals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id BIGINT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  show_id UUID REFERENCES shows(id) ON DELETE SET NULL,
  setlist_id UUID REFERENCES setlists(id) ON DELETE SET NULL,
  name TEXT,
  location TEXT,
  rehearsal_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  notes TEXT,
  status rehearsal_status DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rehearsals_band_id ON rehearsals(band_id);
CREATE INDEX IF NOT EXISTS idx_rehearsals_show_id ON rehearsals(show_id);
CREATE INDEX IF NOT EXISTS idx_rehearsals_setlist_id ON rehearsals(setlist_id);
CREATE INDEX IF NOT EXISTS idx_rehearsals_rehearsal_date ON rehearsals(rehearsal_date);
CREATE INDEX IF NOT EXISTS idx_rehearsals_status ON rehearsals(status);

-- Enable RLS
ALTER TABLE rehearsals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rehearsals (similar to shows)
-- Users can view rehearsals for bands they are members of
CREATE POLICY "Band members can view rehearsals"
  ON rehearsals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = rehearsals.band_id
      AND band_members.user_id = auth.uid()
    )
  );

-- Members and above can create rehearsals
CREATE POLICY "Band members can create rehearsals"
  ON rehearsals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = rehearsals.band_id
      AND band_members.user_id = auth.uid()
      AND band_members.role IN ('owner', 'admin', 'member')
    )
  );

-- Members can update rehearsals they created, owners/admins can update any
CREATE POLICY "Band members can update rehearsals"
  ON rehearsals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = rehearsals.band_id
      AND band_members.user_id = auth.uid()
      AND (
        band_members.role IN ('owner', 'admin')
        OR rehearsals.user_id = auth.uid()
      )
    )
  );

-- Only owners/admins can delete rehearsals, or the creator
CREATE POLICY "Band members can delete rehearsals"
  ON rehearsals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = rehearsals.band_id
      AND band_members.user_id = auth.uid()
      AND (
        band_members.role IN ('owner', 'admin')
        OR rehearsals.user_id = auth.uid()
      )
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rehearsals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS rehearsals_updated_at ON rehearsals;
CREATE TRIGGER rehearsals_updated_at
  BEFORE UPDATE ON rehearsals
  FOR EACH ROW
  EXECUTE FUNCTION update_rehearsals_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Rehearsals migration completed successfully!';
END $$;
