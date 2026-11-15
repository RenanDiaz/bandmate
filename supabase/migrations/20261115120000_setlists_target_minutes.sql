-- Setlist builder, Phase 2 (docs/specs/setlist-builder.md §4.1, decision 6):
-- a shared target duration per setlist, in minutes. Nullable: no target.
--
-- Policies: unchanged. The setlists INSERT / UPDATE policies are row-level
-- (band membership and role), so they already cover the new column.

ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS target_minutes integer;

DO $$
BEGIN
  ALTER TABLE public.setlists
    ADD CONSTRAINT setlists_target_minutes_positive
    CHECK (target_minutes IS NULL OR target_minutes > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.setlists.target_minutes IS
  'Target length of the setlist in minutes (songs + breaks); null = no target.';
