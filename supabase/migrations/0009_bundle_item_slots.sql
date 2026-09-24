-- ==============================================================================
-- MIGRATION 0009: BUNDLE SLOTS (a bundle slot can accept several alternative variants)
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- Rows sharing the same slot number are alternatives for one required slot.
-- ==============================================================================
ALTER TABLE public.promotion_bundle_items
  ADD COLUMN IF NOT EXISTS slot INTEGER;
