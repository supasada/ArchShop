-- ==============================================================================
-- MIGRATION 0011: REALTIME FOR REMAINING STOREFRONT TABLES
-- So open storefront tabs update live without a refresh.
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- ==============================================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variant_images;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.promotion_scope_variants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.promotion_bundle_items;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
