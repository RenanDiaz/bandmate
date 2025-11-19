-- Fix permissions for band_members table when RLS is disabled
-- When RLS is disabled, we need to explicitly GRANT permissions to authenticated users

-- Grant SELECT permission to authenticated users
GRANT SELECT ON band_members TO authenticated;

-- Grant INSERT permission to authenticated users (for adding members)
GRANT INSERT ON band_members TO authenticated;

-- Grant UPDATE permission to authenticated users (for changing roles)
GRANT UPDATE ON band_members TO authenticated;

-- Grant DELETE permission to authenticated users (for removing members)
GRANT DELETE ON band_members TO authenticated;

-- Also grant usage on the sequence if it exists
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verify permissions
SELECT 'Permissions granted successfully!' as status;

-- Check current grants
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name='band_members';
