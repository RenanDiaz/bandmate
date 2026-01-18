-- Requests System Migration
-- Run this in Supabase SQL Editor
-- This creates the requests, comments, and votes tables for band collaboration

-- Create request_type enum
DO $$ BEGIN
  CREATE TYPE request_type AS ENUM ('new_song', 'backing_track', 'setlist_proposal', 'song_change', 'general');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create request_status enum
DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'in_progress', 'completed', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id BIGINT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Type and status
  request_type request_type NOT NULL,
  status request_status DEFAULT 'pending',

  -- Content
  title TEXT NOT NULL,
  description TEXT,

  -- Flexible data storage for type-specific fields
  -- For new_song: { artist: string, song_name: string, reference_url?: string }
  -- For backing_track: { song_id: uuid }
  -- For setlist_proposal: { setlist_id?: uuid, show_id?: uuid }
  -- For song_change: { song_id: uuid, proposed_changes: string }
  request_data JSONB DEFAULT '{}',

  -- Direct references (optional, for easier querying)
  related_song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  related_setlist_id UUID REFERENCES setlists(id) ON DELETE SET NULL,
  related_show_id UUID REFERENCES shows(id) ON DELETE SET NULL,

  -- Resolution
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create request_comments table
CREATE TABLE IF NOT EXISTS request_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create request_votes table
CREATE TABLE IF NOT EXISTS request_votes (
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (request_id, user_id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_requests_band_id ON requests(band_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_by ON requests(created_by);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_request_type ON requests(request_type);
CREATE INDEX IF NOT EXISTS idx_requests_related_song_id ON requests(related_song_id);
CREATE INDEX IF NOT EXISTS idx_requests_related_setlist_id ON requests(related_setlist_id);
CREATE INDEX IF NOT EXISTS idx_requests_related_show_id ON requests(related_show_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_comments_request_id ON request_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_request_comments_user_id ON request_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_request_votes_request_id ON request_votes(request_id);
CREATE INDEX IF NOT EXISTS idx_request_votes_user_id ON request_votes(user_id);

-- Enable RLS
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_votes ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS Policies for requests
-- =====================

-- All band members can view requests
CREATE POLICY "Band members can view requests"
  ON requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = requests.band_id
      AND band_members.user_id = auth.uid()
    )
  );

-- Members and above can create requests (not guests)
CREATE POLICY "Band members can create requests"
  ON requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = requests.band_id
      AND band_members.user_id = auth.uid()
      AND band_members.role IN ('owner', 'admin', 'member')
    )
  );

-- Creator can update their own requests, owners/admins can update any
CREATE POLICY "Band members can update requests"
  ON requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = requests.band_id
      AND band_members.user_id = auth.uid()
      AND (
        band_members.role IN ('owner', 'admin')
        OR requests.created_by = auth.uid()
      )
    )
  );

-- Creator can delete their own requests, owners/admins can delete any
CREATE POLICY "Band members can delete requests"
  ON requests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members
      WHERE band_members.band_id = requests.band_id
      AND band_members.user_id = auth.uid()
      AND (
        band_members.role IN ('owner', 'admin')
        OR requests.created_by = auth.uid()
      )
    )
  );

-- =====================
-- RLS Policies for request_comments
-- =====================

-- All band members can view comments on requests they can see
CREATE POLICY "Band members can view request comments"
  ON request_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN band_members bm ON bm.band_id = r.band_id
      WHERE r.id = request_comments.request_id
      AND bm.user_id = auth.uid()
    )
  );

-- Members and above can create comments
CREATE POLICY "Band members can create request comments"
  ON request_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN band_members bm ON bm.band_id = r.band_id
      WHERE r.id = request_comments.request_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON request_comments FOR UPDATE
  USING (request_comments.user_id = auth.uid());

-- Users can delete their own comments, owners/admins can delete any
CREATE POLICY "Users can delete request comments"
  ON request_comments FOR DELETE
  USING (
    request_comments.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM requests r
      JOIN band_members bm ON bm.band_id = r.band_id
      WHERE r.id = request_comments.request_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin')
    )
  );

-- =====================
-- RLS Policies for request_votes
-- =====================

-- All band members can view votes
CREATE POLICY "Band members can view request votes"
  ON request_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN band_members bm ON bm.band_id = r.band_id
      WHERE r.id = request_votes.request_id
      AND bm.user_id = auth.uid()
    )
  );

-- Members and above can vote
CREATE POLICY "Band members can vote on requests"
  ON request_votes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests r
      JOIN band_members bm ON bm.band_id = r.band_id
      WHERE r.id = request_votes.request_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- Users can change their own vote
CREATE POLICY "Users can update own vote"
  ON request_votes FOR UPDATE
  USING (request_votes.user_id = auth.uid());

-- Users can remove their own vote
CREATE POLICY "Users can delete own vote"
  ON request_votes FOR DELETE
  USING (request_votes.user_id = auth.uid());

-- =====================
-- Triggers for updated_at
-- =====================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for requests updated_at
DROP TRIGGER IF EXISTS requests_updated_at ON requests;
CREATE TRIGGER requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION update_requests_updated_at();

-- Function for comments
CREATE OR REPLACE FUNCTION update_request_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for request_comments updated_at
DROP TRIGGER IF EXISTS request_comments_updated_at ON request_comments;
CREATE TRIGGER request_comments_updated_at
  BEFORE UPDATE ON request_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_request_comments_updated_at();

-- =====================
-- Helper function to get vote count
-- =====================
CREATE OR REPLACE FUNCTION get_request_vote_count(request_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  vote_count INTEGER;
BEGIN
  SELECT COALESCE(
    SUM(CASE WHEN vote_type = 'up' THEN 1 WHEN vote_type = 'down' THEN -1 ELSE 0 END),
    0
  ) INTO vote_count
  FROM request_votes
  WHERE request_id = request_uuid;

  RETURN vote_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Requests system migration completed successfully!';
END $$;
