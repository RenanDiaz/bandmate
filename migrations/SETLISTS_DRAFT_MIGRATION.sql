-- Setlists Draft Migration
-- Run this in Supabase SQL Editor
-- Adds is_draft column to setlists table for proposal drafts

-- Add is_draft column
ALTER TABLE setlists
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE;

-- Create index for filtering drafts
CREATE INDEX IF NOT EXISTS idx_setlists_is_draft ON setlists(is_draft);

-- Update existing setlists to ensure they are not drafts
UPDATE setlists SET is_draft = FALSE WHERE is_draft IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Setlists draft migration completed successfully!';
END $$;
