-- ==============================================================================
-- MIGRATION 0013: PRODUCT IMAGE GALLERY (MORE THAN 2 IMAGES PER PRODUCT)
-- product_images: extra images per product, shown after the front/back cover
-- images (products.image_front_url / image_back_url stay as the covers).
-- Mirrors product_variant_images. Ordered by sort_order (ascending).
-- Security: anyone can read; ONLY the `authenticated` role can insert/update/delete
-- (not anon, unlike older tables). The admin must therefore be logged in through
-- Supabase Auth (a real auth session, not the local mock login) to manage the
-- gallery — workstream G will require the same for the other admin tables.
-- The app keeps working before this is run (the gallery just comes back empty).
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view product images" ON public.product_images;
CREATE POLICY "Public can view product images" ON public.product_images
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert product images" ON public.product_images;
CREATE POLICY "Admins can insert product images" ON public.product_images
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update product images" ON public.product_images;
CREATE POLICY "Admins can update product images" ON public.product_images
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete product images" ON public.product_images;
CREATE POLICY "Admins can delete product images" ON public.product_images
  FOR DELETE TO authenticated USING (true);

-- Realtime (so admin gallery edits reflect live in open storefront tabs)
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.product_images;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Make PostgREST see the new table right away
NOTIFY pgrst, 'reload schema';
