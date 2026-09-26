# Database Migrations

> **History only — don't apply these files.** The whole schema now lives in
> `supabase/migrations/`, starting with
> [`20260101000000_baseline.sql`](../supabase/migrations/20260101000000_baseline.sql),
> a dump of production taken on 2026-09-26 that replaces everything below.
> A fresh database is `supabase db push` (remote) or `supabase db reset`
> (local). The files here show how the schema got there; production may
> differ from them (it did: some policies carry names no file here creates),
> so read the baseline, not these, to know what exists.

This directory contains the legacy SQL migration files for the Bandmate database schema.

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
- **[BAND_MEMBERS_MIGRATION_V4.sql](BAND_MEMBERS_MIGRATION_V4.sql)** - Latest version

### Band Settings
- **[supabase/migrations/20260627134532_band_avatar_and_ownership.sql](../supabase/migrations/20260627134532_band_avatar_and_ownership.sql)** - Adds `bands.avatar_url`, the public `band-avatars` storage bucket, widens the band UPDATE policy to owners + admins, and adds the `transfer_band_ownership()` RPC _(moved to the CLI flow — apply with `supabase db push`)_

### Supporting Functions & Fixes
- **[ADD_GET_BAND_MEMBERS_FUNCTION.sql](ADD_GET_BAND_MEMBERS_FUNCTION.sql)** - Function to retrieve band members
- **[FIX_RLS_RECURSION.sql](FIX_RLS_RECURSION.sql)** - Resolves Row Level Security recursion issues
- **[FIX_BAND_MEMBERS_PERMISSIONS.sql](FIX_BAND_MEMBERS_PERMISSIONS.sql)** - Permission fixes for band members
- **[FIX_BAND_INVITATIONS_POLICY.sql](FIX_BAND_INVITATIONS_POLICY.sql)** - Band invitation policy fixes
- **[DEBUG_BAND_MEMBERS.sql](DEBUG_BAND_MEMBERS.sql)** - Debugging queries for band members

> **Superseded policies.** The UPDATE and DELETE policies on `songs`, `setlists`,
> `shows` and `rehearsals` defined in `FIX_BAND_ROLE_PERMISSIONS.sql`,
> `FIX_SETLIST_UPDATE_POLICY.sql`, `SHOWS_MIGRATION.sql` and
> `REHEARSALS_MIGRATION.sql` are replaced by
> `supabase/migrations/20260927120000_align_content_rls_with_roles.sql`
> (owner/admin/member may edit and delete any row of their band). The files are
> kept for history.

## Usage

These files were applied by hand in the Supabase SQL Editor. They are no
longer applied anywhere: new schema changes are CLI migrations in
`supabase/migrations/` (see the note at the top).

For how the membership tables and their RLS came to be, see
[docs/guides/band-members.md](../docs/guides/band-members.md).

## Migration History

The band members feature went through several iterations to resolve RLS (Row Level Security) policy issues and permission conflicts. V4 is the last iteration; its result is in the baseline.
