-- ==============================================================================
-- MIGRATION 0014: ORDER FULFILLMENT STATUS + PRODUCT PRODUCTION LEAD TIME
-- orders.fulfillment_status: production/delivery progress, separate from payment_status.
--   pending → in_production (ส่งผลิต) → ready (พร้อมรับ, pickup) / shipped (จัดส่งแล้ว, shipping)
--   → completed (เสร็จสิ้น). Existing orders become 'pending'.
-- products.production_note: free text such as "ผลิต 3–4 สัปดาห์หลังปิดรับ",
--   shown on the product page and the receipt.
-- The app keeps working before this is run (orders are treated as 'pending',
-- and the new fields are only sent once the columns exist).
-- No RLS changes.
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- ==============================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending';

DO $$ BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_fulfillment_status_check
    CHECK (fulfillment_status IN ('pending', 'in_production', 'ready', 'shipped', 'completed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON public.orders(fulfillment_status);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS production_note TEXT;

-- Make PostgREST see the new columns right away
NOTIFY pgrst, 'reload schema';
