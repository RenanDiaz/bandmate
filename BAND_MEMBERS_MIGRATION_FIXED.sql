-- Band Members & Invitations Migration - FIXED VERSION
-- This migration adds multi-user collaboration support with roles and permissions
-- FIXES: Infinite recursion in RLS policies by using bands table for checks

-- ============================================================================
-- 1. CREATE BAND_MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS band_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id BIGINT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member', 'guest')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(band_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_band_members_band_id ON band_members(band_id);
CREATE INDEX IF NOT EXISTS idx_band_members_user_id ON band_members(user_id);
CREATE INDEX IF NOT EXISTS idx_band_members_role ON band_members(role);

-- ============================================================================
-- 2. CREATE BAND_INVITATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS band_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id BIGINT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member', 'guest')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_band_invitations_band_id ON band_invitations(band_id);
CREATE INDEX IF NOT EXISTS idx_band_invitations_email ON band_invitations(email);
CREATE INDEX IF NOT EXISTS idx_band_invitations_token ON band_invitations(token);
CREATE INDEX IF NOT EXISTS idx_band_invitations_status ON band_invitations(status);

-- ============================================================================
-- 3. MIGRATE EXISTING BANDS TO BAND_MEMBERS
-- ============================================================================

-- Add all existing band owners as members with 'owner' role
INSERT INTO band_members (band_id, user_id, role, joined_at)
SELECT id, owner_id, 'owner', created_at
FROM bands
ON CONFLICT (band_id, user_id) DO NOTHING;

-- ============================================================================
-- 4. ROW LEVEL SECURITY POLICIES - BAND_MEMBERS
-- ============================================================================

ALTER TABLE band_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view members of bands they own (using bands table)
CREATE POLICY "Users can view members of their bands"
  ON band_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bands
      WHERE bands.id = band_members.band_id
      AND bands.owner_id = auth.uid()
    )
    OR
    user_id = auth.uid()
  );

-- Policy: Band owners can add members (using bands table)
CREATE POLICY "Band owners can add members"
  ON band_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bands
      WHERE bands.id = band_members.band_id
      AND bands.owner_id = auth.uid()
    )
  );

-- Policy: Band owners can update member roles (using bands table)
CREATE POLICY "Band owners can update member roles"
  ON band_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bands
      WHERE bands.id = band_members.band_id
      AND bands.owner_id = auth.uid()
    )
  );

-- Policy: Band owners can remove members (using bands table)
CREATE POLICY "Band owners can remove members"
  ON band_members FOR DELETE
  USING (
    band_members.user_id != auth.uid() AND
    EXISTS (
      SELECT 1 FROM bands
      WHERE bands.id = band_members.band_id
      AND bands.owner_id = auth.uid()
    )
  );

-- Policy: Users can remove themselves from a band
CREATE POLICY "Users can leave bands"
  ON band_members FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES - BAND_INVITATIONS
-- ============================================================================

ALTER TABLE band_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invitations for bands they own
CREATE POLICY "Band owners can view invitations"
  ON band_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bands
      WHERE bands.id = band_invitations.band_id
      AND bands.owner_id = auth.uid()
    )
  );

-- Policy: Users can view invitations sent to their email
CREATE POLICY "Users can view their own invitations"
  ON band_invitations FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Policy: Band owners can create invitations
CREATE POLICY "Band owners can create invitations"
  ON band_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bands
      WHERE bands.id = band_invitations.band_id
      AND bands.owner_id = auth.uid()
    )
  );

-- Policy: Band owners can update invitations
CREATE POLICY "Band owners can update invitations"
  ON band_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bands
      WHERE bands.id = band_invitations.band_id
      AND bands.owner_id = auth.uid()
    )
  );

-- Policy: Band owners can delete invitations
CREATE POLICY "Band owners can delete invitations"
  ON band_invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bands
      WHERE bands.id = band_invitations.band_id
      AND bands.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. UPDATE EXISTING POLICIES FOR OTHER TABLES
-- ============================================================================

-- Update songs policies to allow band members to manage songs
DROP POLICY IF EXISTS "Users can view their own songs" ON songs;
DROP POLICY IF EXISTS "Band members can view band songs" ON songs;
CREATE POLICY "Band members can view band songs"
  ON songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = songs.band_id
      AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create songs" ON songs;
DROP POLICY IF EXISTS "Band members can create songs" ON songs;
CREATE POLICY "Band members can create songs"
  ON songs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = songs.band_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'member')
    )
  );

-- Add update policy for songs
DROP POLICY IF EXISTS "Band members can update songs" ON songs;
CREATE POLICY "Band members can update songs"
  ON songs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = songs.band_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'member')
    )
  );

-- Add delete policy for songs
DROP POLICY IF EXISTS "Band owners and song creators can delete songs" ON songs;
CREATE POLICY "Band owners and song creators can delete songs"
  ON songs FOR DELETE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = songs.band_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'owner'
    )
  );

-- Update setlists policies to allow band members to manage setlists
DROP POLICY IF EXISTS "Users can view their band setlists" ON setlists;
DROP POLICY IF EXISTS "Band members can view band setlists" ON setlists;
CREATE POLICY "Band members can view band setlists"
  ON setlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = setlists.band_id
      AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create setlists for their bands" ON setlists;
DROP POLICY IF EXISTS "Band members can create setlists" ON setlists;
CREATE POLICY "Band members can create setlists"
  ON setlists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = setlists.band_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can update their own setlists" ON setlists;
DROP POLICY IF EXISTS "Band members can update setlists" ON setlists;
CREATE POLICY "Band members can update setlists"
  ON setlists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = setlists.band_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'member')
    )
  );

DROP POLICY IF EXISTS "Users can delete their own setlists" ON setlists;
DROP POLICY IF EXISTS "Band owners and setlist creators can delete setlists" ON setlists;
CREATE POLICY "Band owners and setlist creators can delete setlists"
  ON setlists FOR DELETE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = setlists.band_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'owner'
    )
  );

-- Update bands policies to reflect member access
DROP POLICY IF EXISTS "Users can view their own bands" ON bands;
DROP POLICY IF EXISTS "Users can view bands they are members of" ON bands;
CREATE POLICY "Users can view bands they are members of"
  ON bands FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = bands.id
      AND bm.user_id = auth.uid()
    )
  );

-- Update policy (only owners can update band details)
DROP POLICY IF EXISTS "Users can update their own bands" ON bands;
DROP POLICY IF EXISTS "Band owners can update band details" ON bands;
CREATE POLICY "Band owners can update band details"
  ON bands FOR UPDATE
  USING (owner_id = auth.uid());

-- Delete policy (only owners can delete)
DROP POLICY IF EXISTS "Users can delete their own bands" ON bands;
DROP POLICY IF EXISTS "Band owners can delete bands" ON bands;
CREATE POLICY "Band owners can delete bands"
  ON bands FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a user is a band owner
CREATE OR REPLACE FUNCTION is_band_owner(band_id_param BIGINT, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bands
    WHERE id = band_id_param
    AND owner_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user is a band member (any role)
CREATE OR REPLACE FUNCTION is_band_member(band_id_param BIGINT, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM band_members
    WHERE band_id = band_id_param
    AND user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's role in a band
CREATE OR REPLACE FUNCTION get_band_role(band_id_param BIGINT, user_id_param UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM band_members
  WHERE band_id = band_id_param
  AND user_id = user_id_param;

  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. TRIGGER TO AUTO-EXPIRE GUEST MEMBERSHIPS
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_guest_memberships()
RETURNS void AS $$
BEGIN
  DELETE FROM band_members
  WHERE role = 'guest'
  AND expires_at IS NOT NULL
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify the migration
SELECT 'Migration completed successfully!' AS status;
SELECT COUNT(*) AS band_members_count FROM band_members;
SELECT COUNT(*) AS band_invitations_count FROM band_invitations;
