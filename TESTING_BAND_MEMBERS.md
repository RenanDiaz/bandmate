# Testing Band Member Management

This guide will help you test the band member management system after applying the V3 migration.

## Prerequisites

1. Apply the V3 migration in Supabase:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Run the contents of `BAND_MEMBERS_MIGRATION_V3.sql`
   - Verify you see "Migration completed successfully!"

## What V3 Migration Does

The V3 migration:
- ✅ Creates `band_members` table with RLS **DISABLED** (prevents infinite recursion)
- ✅ Creates `band_invitations` table with RLS **ENABLED**
- ✅ Migrates existing band owners to `band_members` as 'owner' role
- ✅ Updates all existing RLS policies on `songs`, `setlists`, and `bands` tables
- ✅ Creates helper functions for permission checks

### Why RLS is Disabled on band_members

The infinite recursion error occurred because:
1. `band_members` policies tried to query `band_members` (circular)
2. OR `band_members` policies queried `bands`, which has policies that query `band_members` (circular)

**Solution**: Disable RLS on `band_members` and enforce security at the application level through the `bandMembersService` functions.

## Testing Checklist

### 1. View Band Members
- [ ] Navigate to any band
- [ ] Click the "people" icon button next to the band name
- [ ] Verify you see the Band Settings page
- [ ] Verify the Members tab is active
- [ ] Verify you see yourself listed as "Owner"

### 2. Invite a Member
- [ ] Click "Invite Member" button (only visible to owners)
- [ ] Enter an email address
- [ ] Select role: "Member" or "Guest"
- [ ] Click "Send Invitation"
- [ ] Verify success message appears
- [ ] Check Supabase dashboard → `band_invitations` table to see the new record

### 3. View Invitations
- [ ] In the Band Members view, scroll to "Pending Invitations" section
- [ ] Verify you see the invitation you just created
- [ ] Verify it shows:
   - Email address
   - Role badge (Member/Guest)
   - "Pending" status badge
   - Revoke button

### 4. Test Role Badges
- [ ] Verify you see role badges next to member names
- [ ] Owner badge should have purple gradient
- [ ] Member badge should be dark gray
- [ ] Guest badge should be amber/warning color

### 5. Test Member Actions (Owner Only)
- [ ] Click the dropdown next to a member's role
- [ ] Verify you can see "Change to Member", "Change to Guest" options
- [ ] Try changing a role (note: don't change your own role to test further)
- [ ] Verify the role updates immediately
- [ ] Try clicking "Remove" on a member
- [ ] Verify confirmation prompt appears
- [ ] Verify member is removed after confirmation

### 6. Test Leave Band (Non-Owner)
To test this, you'll need a second account or to demote yourself temporarily:
- [ ] Click "Leave Band" button
- [ ] Verify confirmation prompt appears
- [ ] Verify you're removed from the band after confirmation

### 7. Test Permission Checks

**As Owner:**
- [ ] Verify you can create songs
- [ ] Verify you can edit any song
- [ ] Verify you can delete any song
- [ ] Verify you can create setlists
- [ ] Verify you can edit/delete setlists
- [ ] Verify you can access Band Settings

**As Member** (need second account or invitation acceptance):
- [ ] Verify you can create songs
- [ ] Verify you can edit songs
- [ ] Verify you can delete songs you created
- [ ] Verify you cannot delete songs created by owner
- [ ] Verify you can create/edit setlists
- [ ] Verify you cannot access Band Settings

**As Guest:**
- [ ] Verify you can view songs
- [ ] Verify you can view setlists
- [ ] Verify you cannot create/edit/delete anything
- [ ] Verify you cannot access Band Settings

### 8. Test Multi-User Band Access

Create a second band and verify:
- [ ] You see both bands in the band list
- [ ] Each band shows your role badge (Owner for one, possibly Member for another)
- [ ] You can switch between bands
- [ ] Members list is different for each band

### 9. Test Database Policies

Open Supabase SQL Editor and run these queries to verify policies work:

```sql
-- Test 1: Check your band_members record
SELECT * FROM band_members WHERE user_id = auth.uid();

-- Test 2: Check you can see your bands
SELECT * FROM bands WHERE id IN (
  SELECT band_id FROM band_members WHERE user_id = auth.uid()
);

-- Test 3: Check you can see songs from your bands
SELECT * FROM songs WHERE band_id IN (
  SELECT band_id FROM band_members WHERE user_id = auth.uid()
);

-- Test 4: Check you can see invitations
SELECT * FROM band_invitations WHERE invited_by = auth.uid();
```

### 10. Test Error Handling

- [ ] Try to invite an email that's already a member → verify error message
- [ ] Try to invite yourself → verify error message
- [ ] Try to remove the last owner → verify error message (if implemented)
- [ ] Try accessing `/bands/999/settings` (non-existent band) → verify redirect to home
- [ ] Try accessing `/bands/{band_id}/settings` for a band you're not a member of → verify access denied

## Common Issues & Fixes

### Issue: "infinite recursion detected in policy for relation 'band_members'"

**Cause**: You're running the wrong migration file (V1 or FIXED version)

**Fix**: Run `BAND_MEMBERS_MIGRATION_V3.sql` instead, which disables RLS on band_members

### Issue: Can't see band members

**Possible Causes**:
1. Migration not applied correctly
2. User is not authenticated
3. JavaScript console errors

**Debug Steps**:
1. Open browser console (F12)
2. Check for errors
3. Verify Supabase connection
4. Check Network tab for failed API calls

### Issue: Can't invite members

**Possible Causes**:
1. User is not the band owner
2. band_invitations table doesn't exist
3. RLS policies blocking insert

**Debug Steps**:
1. Verify you're the owner: Check band list for "Owner" badge
2. Check Supabase dashboard → Tables → verify `band_invitations` exists
3. Check browser console for errors

### Issue: Role changes don't persist

**Possible Causes**:
1. Update policy not working
2. RLS blocking update
3. Application-level permission check failing

**Debug Steps**:
1. Check browser console for errors
2. Check Supabase logs in dashboard
3. Verify you're the owner (only owners can change roles)

## Success Criteria

✅ **Complete** when:
- Migration runs without errors
- You can view band members
- You can invite new members
- You can change member roles (as owner)
- You can remove members (as owner)
- You see correct role badges
- Songs/setlists respect member permissions
- No infinite recursion errors

## Next Steps After Testing

Once all tests pass:

1. **Push commits to remote**:
   ```bash
   git push origin main
   ```

2. **Consider creating a PR** for review:
   - 48be4b8: Band member management system
   - fbb1d6c: UI integration
   - (Include fix commit after V3 works)

3. **Update documentation**:
   - Add band member management to README
   - Document security model (RLS disabled on band_members)

4. **Plan next feature**:
   - Accept invitations flow (invitation link UI)
   - Email notification system (future)
   - Guest auto-expiration cron job
   - Advanced permission system
