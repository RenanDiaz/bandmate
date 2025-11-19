-- Create a Postgres function to get band members with user emails
-- This solves the issue of querying auth.users from the client

CREATE OR REPLACE FUNCTION get_band_members_with_emails(band_id_param BIGINT)
RETURNS TABLE (
  id UUID,
  band_id BIGINT,
  user_id UUID,
  role TEXT,
  invited_by UUID,
  joined_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  email TEXT,
  user_metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bm.id,
    bm.band_id,
    bm.user_id,
    bm.role,
    bm.invited_by,
    bm.joined_at,
    bm.expires_at,
    bm.created_at,
    u.email,
    u.raw_user_meta_data as user_metadata
  FROM band_members bm
  LEFT JOIN auth.users u ON u.id = bm.user_id
  WHERE bm.band_id = band_id_param
  ORDER BY bm.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_band_members_with_emails(BIGINT) TO authenticated;

-- Test the function
SELECT 'Function created successfully!' as status;
