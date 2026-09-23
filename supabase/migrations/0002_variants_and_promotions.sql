-- ==============================================================================
-- MIGRATION 0002: PRODUCT VARIANTS & ADMIN-CONFIGURABLE PROMOTIONS
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PRODUCT VARIANTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    available_sizes TEXT[] NOT NULL DEFAULT ARRAY['S', 'M', 'L', 'XL', '2XL'],
    available_colors TEXT[] NOT NULL DEFAULT ARRAY['Black', 'White'],
    stock_limit INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_variant_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variant_images_variant_id ON public.product_variant_images(variant_id);

-- ------------------------------------------------------------------------------
-- 2. PROMOTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('quantity_break', 'bundle')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    applies_to_all BOOLEAN NOT NULL DEFAULT true,
    quantity INTEGER,
    bundle_price NUMERIC(10, 2),
    discount_type TEXT CHECK (discount_type IN ('fixed_amount', 'fixed_price')),
    discount_value NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.promotion_scope_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    CHECK (
        (variant_id IS NOT NULL AND product_id IS NULL) OR
        (variant_id IS NULL AND product_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.promotion_bundle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    required_qty INTEGER NOT NULL DEFAULT 1 CHECK (required_qty > 0),
    CHECK (
        (variant_id IS NOT NULL AND product_id IS NULL) OR
        (variant_id IS NULL AND product_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_promo_scope_promotion_id ON public.promotion_scope_variants(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promo_bundle_promotion_id ON public.promotion_bundle_items(promotion_id);

-- ------------------------------------------------------------------------------
-- 3. ORDERS: RECORD WHICH VARIANT WAS PURCHASED
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_product_variant_id ON public.orders(product_variant_id);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_scope_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_bundle_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view variants" ON public.product_variants;
CREATE POLICY "Public can view variants" ON public.product_variants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage variants" ON public.product_variants;
CREATE POLICY "Admins can manage variants" ON public.product_variants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view variant images" ON public.product_variant_images;
CREATE POLICY "Public can view variant images" ON public.product_variant_images FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage variant images" ON public.product_variant_images;
CREATE POLICY "Admins can manage variant images" ON public.product_variant_images FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view promotions" ON public.promotions;
CREATE POLICY "Public can view promotions" ON public.promotions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage promotions" ON public.promotions;
CREATE POLICY "Admins can manage promotions" ON public.promotions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view promo scope" ON public.promotion_scope_variants;
CREATE POLICY "Public can view promo scope" ON public.promotion_scope_variants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage promo scope" ON public.promotion_scope_variants;
CREATE POLICY "Admins can manage promo scope" ON public.promotion_scope_variants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view promo bundle items" ON public.promotion_bundle_items;
CREATE POLICY "Public can view promo bundle items" ON public.promotion_bundle_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage promo bundle items" ON public.promotion_bundle_items;
CREATE POLICY "Admins can manage promo bundle items" ON public.promotion_bundle_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. REALTIME (so admin promo edits reflect live in open storefront tabs)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 6. SEED DEFAULT PROMOTION (preserve existing live "2 for 399" behavior)
-- ------------------------------------------------------------------------------
INSERT INTO public.promotions (name, type, quantity, bundle_price, applies_to_all)
SELECT 'ซื้อ 2 ตัว 399.-', 'quantity_break', 2, 399, true
WHERE NOT EXISTS (SELECT 1 FROM public.promotions);
