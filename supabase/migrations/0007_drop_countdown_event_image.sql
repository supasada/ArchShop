-- ==============================================================================
-- MIGRATION 0007: DROP UNUSED COUNTDOWN EVENT IMAGE COLUMN
-- Run manually in the Supabase SQL editor.
-- This is DESTRUCTIVE: any image_url values already saved on
-- countdown_events rows will be permanently deleted. The app code no
-- longer reads or writes this column (reverted), so nothing in the
-- app depends on it — safe to drop.
-- ==============================================================================

ALTER TABLE public.countdown_events
  DROP COLUMN IF EXISTS image_url;
