-- Migration: Remove event_date and venue from setlists table
-- Date: 2025-12-31
-- Description: Removes redundant event_date and venue columns from setlists.
--              Event information should be managed through the shows table,
--              which can reference setlists via setlist_id.
--              This eliminates data duplication and establishes shows as the
--              single source of truth for event metadata.

-- Step 1: Remove the columns from setlists table
ALTER TABLE setlists
DROP COLUMN IF EXISTS event_date,
DROP COLUMN IF EXISTS venue;

-- Note: Any existing data in these columns will be lost.
-- If you need to preserve this data, first run a query to identify
-- setlists with event_date or venue populated and manually create
-- corresponding shows for them before running this migration.
--
-- Example query to find setlists with event data:
-- SELECT id, name, event_date, venue FROM setlists
-- WHERE event_date IS NOT NULL OR venue IS NOT NULL;
