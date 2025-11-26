-- Fix: Allow invitees to update invitation status (accept/decline)
-- The original policy only allowed the inviter to update, not the person accepting

-- Drop the old policy
DROP POLICY IF EXISTS "Users can update their own invitations" ON band_invitations;

-- Create new policy that allows both inviter and invitee to update
CREATE POLICY "Users can update invitations"
  ON band_invitations FOR UPDATE
  USING (
    invited_by = auth.uid() OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Alternatively, if get_current_user_email() function exists (from V4 migration):
-- CREATE POLICY "Users can update invitations"
--   ON band_invitations FOR UPDATE
--   USING (
--     invited_by = auth.uid() OR
--     email = get_current_user_email()
--   );
