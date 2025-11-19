-- Debug queries to check band_members data

-- 1. Check if band_members table exists and has data
SELECT 'band_members table data:' as debug;
SELECT id, band_id, user_id, role, joined_at
FROM band_members
ORDER BY joined_at DESC;

-- 2. Check RLS status
SELECT 'RLS status:' as debug;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'band_members';

-- 3. Check if you can query it as the current user
SELECT 'Your memberships:' as debug;
SELECT bm.*, b.name as band_name
FROM band_members bm
JOIN bands b ON b.id = bm.band_id
WHERE bm.user_id = auth.uid();

-- 4. Check if the user join works
SELECT 'Members with user emails:' as debug;
SELECT
  bm.id,
  bm.band_id,
  bm.user_id,
  bm.role,
  u.email
FROM band_members bm
LEFT JOIN auth.users u ON u.id = bm.user_id
ORDER BY bm.joined_at DESC;

-- 5. Check if bands exist
SELECT 'Your bands:' as debug;
SELECT id, name, owner_id, created_at
FROM bands
WHERE owner_id = auth.uid();
