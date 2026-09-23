-- ==============================================================================
-- MIGRATION 0004: ORDER TRACKING NUMBER
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- ==============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT;
