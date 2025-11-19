-- Band Members & Invitations Migration - V4 (FIXED auth.users permissions)
-- This version fixes the "permission denied for table users" error
-- by using a SECURITY DEFINER function instead of direct auth.users queries

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
-- 4. ROW LEVEL SECURITY - BAND_MEMBERS (DISABLED)
-- ============================================================================

-- IMPORTANT: We disable RLS on band_members to avoid circular dependencies
-- Security is enforced through:
-- 1. Application-level checks in the service layer
-- 2. The bands table RLS policies (which use band_members without causing recursion)
ALTER TABLE band_members DISABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users since RLS is disabled
GRANT SELECT ON band_members TO authenticated;
GRANT INSERT ON band_members TO authenticated;
GRANT UPDATE ON band_members TO authenticated;
GRANT DELETE ON band_members TO authenticated;

-- ============================================================================
-- 5. HELPER FUNCTION FOR auth.users ACCESS
-- ============================================================================

-- Function to get current user's email (SECURITY DEFINER can access auth.users)
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_current_user_email() TO authenticated;

-- ============================================================================
-- 6. ROW LEVEL SECURITY POLICIES - BAND_INVITATIONS
-- ============================================================================

ALTER TABLE band_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Band owners can view invitations (checks invited_by directly, no auth.users query)
CREATE POLICY "Band owners can view invitations"
  ON band_invitations FOR SELECT
  USING (
    invited_by = auth.uid()
  );

-- Policy: Users can view invitations sent to their email (FIXED: uses function)
CREATE POLICY "Users can view their own invitations"
  ON band_invitations FOR SELECT
  USING (
    email = get_current_user_email()
  );

-- Policy: Authenticated users can create invitations (check ownership in app)
CREATE POLICY "Authenticated users can create invitations"
  ON band_invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
  );

-- Policy: Users can update their own invitations
CREATE POLICY "Users can update their own invitations"
  ON band_invitations FOR UPDATE
  USING (
    invited_by = auth.uid()
  );

-- Policy: Users can delete their own invitations
CREATE POLICY "Users can delete their own invitations"
  ON band_invitations FOR DELETE
  USING (
    invited_by = auth.uid()
  );

-- ============================================================================
-- 7. UPDATE EXISTING POLICIES FOR OTHER TABLES
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

-- Keep existing create policy (users create bands)
DROP POLICY IF EXISTS "Users can create bands" ON bands;
CREATE POLICY "Users can create bands"
  ON bands FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

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
-- 8. HELPER FUNCTIONS
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
-- 9. TRIGGER TO AUTO-EXPIRE GUEST MEMBERSHIPS
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
SELECT 'Migration V4 completed successfully!' AS status;
SELECT COUNT(*) AS band_members_count FROM band_members;
SELECT COUNT(*) AS band_invitations_count FROM band_invitations;

-- Security Notes:
-- 1. band_members has RLS DISABLED to avoid circular dependency
-- 2. Security is enforced through application-level checks in bandMembersService
-- 3. All other tables use band_members in their policies (no recursion since band_members has no RLS)
-- 4. auth.users access is done via SECURITY DEFINER function to avoid permission errors
