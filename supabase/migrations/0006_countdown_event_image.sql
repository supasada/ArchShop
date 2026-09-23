-- ==============================================================================
-- MIGRATION 0006: COUNTDOWN EVENT IMAGE
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- ==============================================================================

ALTER TABLE public.countdown_events
  ADD COLUMN IF NOT EXISTS image_url TEXT;
