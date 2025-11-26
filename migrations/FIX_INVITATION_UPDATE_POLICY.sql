-- Fix: Allow invitees to update invitation status (accept/decline)
-- The original policy only allowed the inviter to update, not the person accepting

-- First, ensure the helper function exists (SECURITY DEFINER can access auth.users)
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_current_user_email() TO authenticated;

-- Drop the old policies
DROP POLICY IF EXISTS "Users can update their own invitations" ON band_invitations;
DROP POLICY IF EXISTS "Users can update invitations" ON band_invitations;

-- Create new policy that allows both inviter and invitee to update
CREATE POLICY "Users can update invitations"
  ON band_invitations FOR UPDATE
  USING (
    invited_by = auth.uid() OR
    email = get_current_user_email()
  );
