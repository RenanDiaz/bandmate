# Database Migrations

This directory contains SQL migration files for the Bandmate database schema.

> **Two migration flows exist in this repo:**
>
> - **`supabase/migrations/`** — managed by the Supabase CLI (`supabase db push`).
>   Files there follow the required `<timestamp>_name.sql` naming and are tracked
>   in the project's `supabase_migrations.schema_migrations` table. **New
>   migrations should go here.**
> - **`migrations/`** (this folder) — the legacy set, applied manually via the
>   Supabase Dashboard SQL Editor. These are kept for historical reference.
>
> `BAND_AVATAR_AND_OWNERSHIP_MIGRATION.sql` has been moved into the CLI flow as
> [`supabase/migrations/20260627134532_band_avatar_and_ownership.sql`](../supabase/migrations/20260627134532_band_avatar_and_ownership.sql)
> and can be applied with `supabase db push`.

## Files

### Band Members System
- **[BAND_MEMBERS_MIGRATION.sql](BAND_MEMBERS_MIGRATION.sql)** - Initial band members table and permissions
- **[BAND_MEMBERS_MIGRATION_FIXED.sql](BAND_MEMBERS_MIGRATION_FIXED.sql)** - Fixed version addressing initial issues
- **[BAND_MEMBERS_MIGRATION_V3.sql](BAND_MEMBERS_MIGRATION_V3.sql)** - Third iteration with improved RLS policies
- **[BAND_MEMBERS_MIGRATION_V4.sql](BAND_MEMBERS_MIGRATION_V4.sql)** - Latest version (use this one)

### Band Settings
- **[supabase/migrations/20260627134532_band_avatar_and_ownership.sql](../supabase/migrations/20260627134532_band_avatar_and_ownership.sql)** - Adds `bands.avatar_url`, the public `band-avatars` storage bucket, widens the band UPDATE policy to owners + admins, and adds the `transfer_band_ownership()` RPC _(moved to the CLI flow — apply with `supabase db push`)_

### Supporting Functions & Fixes
- **[ADD_GET_BAND_MEMBERS_FUNCTION.sql](ADD_GET_BAND_MEMBERS_FUNCTION.sql)** - Function to retrieve band members
- **[FIX_RLS_RECURSION.sql](FIX_RLS_RECURSION.sql)** - Resolves Row Level Security recursion issues
- **[FIX_BAND_MEMBERS_PERMISSIONS.sql](FIX_BAND_MEMBERS_PERMISSIONS.sql)** - Permission fixes for band members
- **[FIX_BAND_INVITATIONS_POLICY.sql](FIX_BAND_INVITATIONS_POLICY.sql)** - Band invitation policy fixes
- **[DEBUG_BAND_MEMBERS.sql](DEBUG_BAND_MEMBERS.sql)** - Debugging queries for band members

## Usage

To apply a migration to your Supabase database:

1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file you want to apply
4. Paste and execute in the SQL Editor

**Note:** Always review the migration file before applying it to ensure it's appropriate for your current database state.

For how the membership tables and their RLS came to be, see
[docs/guides/band-members.md](../docs/guides/band-members.md).

## Migration History

The band members feature went through several iterations to resolve RLS (Row Level Security) policy issues and permission conflicts. The latest version (V4) is the recommended migration to use for new setups.
