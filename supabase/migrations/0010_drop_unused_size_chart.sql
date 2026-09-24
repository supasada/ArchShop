-- ==============================================================================
-- MIGRATION 0010: DROP UNUSED DATA
-- The store-wide size chart was removed; only per-variant size charts remain.
-- Run manually in the Supabase SQL editor ONLY after you are sure you don't need
-- the old rows (export them first if unsure). Destructive — cannot be undone.
-- ==============================================================================
DROP TABLE IF EXISTS public.size_chart;
