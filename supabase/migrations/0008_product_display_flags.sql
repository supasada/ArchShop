-- ==============================================================================
-- MIGRATION 0008: PER-PRODUCT DISPLAY FLAGS (promo badge, size chart link)
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- ==============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_promo_badge BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_size_chart BOOLEAN NOT NULL DEFAULT true;
