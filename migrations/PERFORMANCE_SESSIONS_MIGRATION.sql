-- Performance Sessions Migration
-- Run this in Supabase SQL Editor
-- Enables real-time sync for setlist performance mode

-- Create performance_sessions table
CREATE TABLE IF NOT EXISTS performance_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setlist_id UUID NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  band_id BIGINT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES auth.users(id),
  current_song_index INTEGER NOT NULL DEFAULT 0,
  session_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_performance_sessions_setlist_id ON performance_sessions(setlist_id);
CREATE INDEX IF NOT EXISTS idx_performance_sessions_band_id ON performance_sessions(band_id);
CREATE INDEX IF NOT EXISTS idx_performance_sessions_session_code ON performance_sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_performance_sessions_is_active ON performance_sessions(is_active);

-- Enable RLS
ALTER TABLE performance_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Band members can view sessions for their bands
CREATE POLICY "Band members can view performance sessions"
  ON performance_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = performance_sessions.band_id
      AND band_members.user_id = auth.uid()
    )
  );

-- Any band member can create a session (they become host)
CREATE POLICY "Band members can create performance sessions"
  ON performance_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = performance_sessions.band_id
      AND band_members.user_id = auth.uid()
    )
    AND host_user_id = auth.uid()
  );

-- Only the host can update their session
CREATE POLICY "Host can update performance session"
  ON performance_sessions FOR UPDATE
  USING (host_user_id = auth.uid());

-- Only the host can delete their session
CREATE POLICY "Host can delete performance session"
  ON performance_sessions FOR DELETE
  USING (host_user_id = auth.uid());

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_performance_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS performance_sessions_updated_at ON performance_sessions;
CREATE TRIGGER performance_sessions_updated_at
  BEFORE UPDATE ON performance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_sessions_updated_at();

-- Function to generate a short session code
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old inactive sessions (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_performance_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM performance_sessions
  WHERE is_active = false
    AND updated_at < NOW() - INTERVAL '24 hours';

  -- Also deactivate sessions that haven't been updated in 4 hours
  UPDATE performance_sessions
  SET is_active = false
  WHERE is_active = true
    AND updated_at < NOW() - INTERVAL '4 hours';
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime for this table
-- Note: You also need to enable this in the Supabase Dashboard under Database > Replication
ALTER PUBLICATION supabase_realtime ADD TABLE performance_sessions;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Performance Sessions migration completed successfully!';
  RAISE NOTICE 'IMPORTANT: Enable Realtime for performance_sessions table in Supabase Dashboard';
  RAISE NOTICE 'Go to: Database > Replication > Enable for performance_sessions';
END $$;
