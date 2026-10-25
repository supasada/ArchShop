-- ==============================================================================
-- MIGRATION 0012: STRUCTURED ORDER ITEMS + JERSEY NAME/NUMBER (PERSONALIZATION)
-- orders.order_items: the cart as JSON, one entry per line:
--   {product_id, variant_id, product_name, variant_name, size, color, quantity,
--    unit_price, personalization: [{name, number}]}   (personalization length == quantity, or [])
--   NULL for orders placed before this migration (their items live only in the notes summary).
-- products.allow_personalization: shows the optional, free "ชื่อบนเสื้อ / เบอร์" inputs.
-- The app keeps working before this is run (it retries the insert without order_items
-- and writes the names/numbers into notes instead).
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- ==============================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_items JSONB;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS allow_personalization BOOLEAN NOT NULL DEFAULT false;

-- Make PostgREST see the new columns right away
NOTIFY pgrst, 'reload schema';
