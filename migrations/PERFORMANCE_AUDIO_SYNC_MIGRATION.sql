-- Performance Audio Sync Migration
-- Adds audio playback state fields to performance_sessions for syncing audio position
-- Run this in Supabase SQL Editor

-- Add audio sync fields to performance_sessions table
-- current_time_ms: Current playback position in milliseconds
-- is_playing: Whether audio is currently playing
-- playback_updated_at: Timestamp of last playback state update (for latency compensation)

ALTER TABLE performance_sessions
ADD COLUMN IF NOT EXISTS current_time_ms INTEGER DEFAULT 0;

ALTER TABLE performance_sessions
ADD COLUMN IF NOT EXISTS is_playing BOOLEAN DEFAULT FALSE;

ALTER TABLE performance_sessions
ADD COLUMN IF NOT EXISTS playback_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN performance_sessions.current_time_ms IS 'Current audio playback position in milliseconds';
COMMENT ON COLUMN performance_sessions.is_playing IS 'Whether audio is currently playing on host device';
COMMENT ON COLUMN performance_sessions.playback_updated_at IS 'Timestamp of last playback state update for latency compensation';

-- Create index for faster queries on active sessions with playback state
CREATE INDEX IF NOT EXISTS idx_performance_sessions_active_playback
ON performance_sessions (band_id, is_active, is_playing)
WHERE is_active = TRUE;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Performance audio sync migration completed successfully!';
END $$;
