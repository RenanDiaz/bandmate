-- Fix: Allow users to see bands they've been invited to (for invitation display)
-- The original policy only allowed band members to see band info,
-- but invitees need to see the band name before accepting

-- First, ensure the helper function exists (SECURITY DEFINER can access auth.users)
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_current_user_email() TO authenticated;

-- Now update the policy using the function
DROP POLICY IF EXISTS "Users can view bands they are members of" ON bands;
DROP POLICY IF EXISTS "Users can view bands they are members of or own" ON bands;
DROP POLICY IF EXISTS "Users can view bands they are members of or invited to" ON bands;

CREATE POLICY "Users can view bands they are members of or invited to"
  ON bands FOR SELECT
  USING (
    -- User is the owner
    owner_id = auth.uid() OR
    -- User is a member
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = bands.id
      AND bm.user_id = auth.uid()
    ) OR
    -- User has a pending invitation to this band (uses SECURITY DEFINER function)
    EXISTS (
      SELECT 1 FROM band_invitations bi
      WHERE bi.band_id = bands.id
      AND bi.email = get_current_user_email()
      AND bi.status = 'pending'
    )
  );
