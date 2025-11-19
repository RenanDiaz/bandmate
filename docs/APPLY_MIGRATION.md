# How to Apply the V3 Migration

Follow these steps to apply the band members migration to your Supabase database.

## Steps

### 1. Open Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your Bandmate project
3. Navigate to **SQL Editor** in the left sidebar

### 2. Run the Migration

1. Click **"+ New query"** button
2. Copy the **entire contents** of `BAND_MEMBERS_MIGRATION_V3.sql`
3. Paste into the SQL editor
4. Click **"Run"** button (or press Cmd/Ctrl + Enter)

### 3. Verify Success

You should see output similar to:

```
Migration completed successfully!
band_members_count: 1 (or more)
band_invitations_count: 0
```

### 4. Check Tables Created

Navigate to **Table Editor** in the left sidebar and verify you see:
- ✅ `band_members` table
- ✅ `band_invitations` table

### 5. Verify Data Migration

Click on the `band_members` table and you should see:
- One row for each band you've created
- Each row has:
  - `band_id` matching your band
  - `user_id` matching your user
  - `role` = 'owner'

## What This Migration Does

1. **Creates `band_members` table** with fields:
   - id, band_id, user_id, role, invited_by, joined_at, expires_at, created_at
   - RLS is **DISABLED** to prevent infinite recursion

2. **Creates `band_invitations` table** with fields:
   - id, band_id, email, role, invited_by, status, token, expires_at, created_at, updated_at
   - RLS is **ENABLED** with proper policies

3. **Migrates existing data**:
   - All band owners are added to `band_members` with 'owner' role

4. **Updates RLS policies** on existing tables:
   - `bands` - Uses band_members for access control
   - `songs` - Members can view/edit, owners can delete
   - `setlists` - Members can view/edit, owners can delete

5. **Creates helper functions**:
   - `is_band_owner(band_id, user_id)` - Check if user is owner
   - `is_band_member(band_id, user_id)` - Check if user is member
   - `get_band_role(band_id, user_id)` - Get user's role
   - `expire_guest_memberships()` - Auto-expire guest access

## Troubleshooting

### Error: "relation already exists"

**Cause**: Tables were partially created from previous migration attempts.

**Fix**: Drop the tables first and re-run:

```sql
-- Drop tables if they exist
DROP TABLE IF EXISTS band_invitations CASCADE;
DROP TABLE IF EXISTS band_members CASCADE;

-- Then run the full V3 migration
```

### Error: "infinite recursion detected"

**Cause**: You ran the wrong migration file (V1 or FIXED).

**Fix**: Verify you're running `BAND_MEMBERS_MIGRATION_V3.sql` which has this line:
```sql
ALTER TABLE band_members DISABLE ROW LEVEL SECURITY;
```

### Error: "foreign key violation"

**Cause**: Your `bands` table doesn't exist or has no data.

**Fix**: Ensure you have at least one band created in your app before running the migration.

## After Migration

Once the migration succeeds:

1. **Start the dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Test the features** using the checklist in `TESTING_BAND_MEMBERS.md`

3. **Verify no errors** in browser console (F12)

4. **Navigate to a band** and click the "people" icon to access Band Settings

## Need Help?

If you encounter errors:
1. Take a screenshot of the error message
2. Check the Supabase logs: Dashboard → Logs → Postgres Logs
3. Verify your table structure matches the migration
4. Check that RLS is properly disabled on band_members

## Next Steps

After successful migration:
- ✅ Test member management features
- ✅ Test invitation system
- ✅ Verify permissions work correctly
- ✅ Push commits to remote repository
