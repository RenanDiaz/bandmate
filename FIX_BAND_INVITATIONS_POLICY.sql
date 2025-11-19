-- Fix "permission denied for table users" error in band_invitations policies
-- The issue is the SELECT policy trying to query auth.users directly

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view their own invitations" ON band_invitations;

-- Recreate it using a security definer function instead
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_current_user_email() TO authenticated;

-- Recreate the policy using the function
CREATE POLICY "Users can view their own invitations"
  ON band_invitations FOR SELECT
  USING (
    email = get_current_user_email()
  );

-- Verify the fix
SELECT 'Policy fixed successfully!' as status;

-- Test query (should work now)
SELECT COUNT(*) as invitation_count FROM band_invitations;
