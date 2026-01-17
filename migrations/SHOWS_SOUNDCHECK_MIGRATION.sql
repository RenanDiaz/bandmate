-- Soundcheck Time Migration
-- Run this in Supabase SQL Editor

-- Add soundcheck_time column to shows table
ALTER TABLE shows ADD COLUMN IF NOT EXISTS soundcheck_time TIME;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Soundcheck time column added successfully!';
END $$;
