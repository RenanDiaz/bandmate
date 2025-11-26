-- Function to get a user's display name (SECURITY DEFINER can access auth.users)
-- This function safely exposes user display names without exposing the full auth.users table

CREATE OR REPLACE FUNCTION get_user_display_name(user_id_param UUID)
RETURNS TEXT AS $$
DECLARE
  display_name TEXT;
BEGIN
  SELECT
    COALESCE(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      email
    ) INTO display_name
  FROM auth.users
  WHERE id = user_id_param;

  RETURN display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_display_name(UUID) TO authenticated;
