# Database Migrations

This directory contains SQL migration files for the Bandmate database schema.

## Files

### Band Members System
- **[BAND_MEMBERS_MIGRATION.sql](BAND_MEMBERS_MIGRATION.sql)** - Initial band members table and permissions
- **[BAND_MEMBERS_MIGRATION_FIXED.sql](BAND_MEMBERS_MIGRATION_FIXED.sql)** - Fixed version addressing initial issues
- **[BAND_MEMBERS_MIGRATION_V3.sql](BAND_MEMBERS_MIGRATION_V3.sql)** - Third iteration with improved RLS policies
- **[BAND_MEMBERS_MIGRATION_V4.sql](BAND_MEMBERS_MIGRATION_V4.sql)** - Latest version (use this one)

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

For detailed migration instructions, see [docs/APPLY_MIGRATION.md](../docs/APPLY_MIGRATION.md).

## Migration History

The band members feature went through several iterations to resolve RLS (Row Level Security) policy issues and permission conflicts. The latest version (V4) is the recommended migration to use for new setups.
