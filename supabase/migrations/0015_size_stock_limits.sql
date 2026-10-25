-- ==============================================================================
-- MIGRATION 0015: PER-SIZE STOCK LIMITS (ENFORCED) + SOLD COUNTS
-- products.size_stock_limits / product_variants.size_stock_limits:
--   JSONB object {"M": 30, "L": 20}. A missing size (or NULL) = unlimited.
--   The product's value is used for products without variants; for a variant,
--   the variant's own value is used (plus the existing total stock_limit).
-- public.get_sold_counts(): aggregated (product_id, variant_id, size, sold) over all
--   orders that are not rejected. Reads orders.order_items (migration 0012) when it is
--   a non-empty array, otherwise the legacy single-row columns
--   product_id / product_variant_id / size / quantity.
--   Returns ONLY counts — no names, phones or other personal data — so it is safe to
--   expose to anon. SECURITY DEFINER so it can count rows the caller cannot SELECT.
--
-- Known limitations (accepted for pre-orders):
--   * Not transactional: the storefront checks remaining stock when the product opens
--     and again right before submitting, but two customers submitting at the same
--     moment can oversell by a few units. Nothing in the DB blocks the insert.
--   * order_items is written by customers and is not validated by the DB. Ids are only
--     cast when they look like UUIDs, quantities only when they are 1–4 digits, and
--     non-object elements are ignored. A forged order can still inflate the count;
--     rejecting that order (payment_status = 'rejected') removes it from the count.
--   * Legacy cart orders (before 0012, no order_items) store only the FIRST cart item's
--     product/variant, the total quantity and a size summary such as "M(2), L(1)".
--     A single-item summary "M(2)" is counted as size M; a multi-item one is counted
--     against the first item's product/variant total only (no size), so per-size counts
--     for those old orders are under-counted and variant totals may be over-counted.
--
-- Requires migration 0012 (orders.order_items). The app keeps working before this is
-- run (no limits shown, everything treated as unlimited).
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- ==============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size_stock_limits JSONB;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS size_stock_limits JSONB;

CREATE OR REPLACE FUNCTION public.get_sold_counts()
RETURNS TABLE (product_id uuid, variant_id uuid, size text, sold bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH live AS (
    SELECT
      o.order_items,
      o.product_id AS row_product_id,
      o.product_variant_id AS row_variant_id,
      o.size AS row_size,
      o.quantity AS row_quantity,
      CASE WHEN jsonb_typeof(o.order_items) = 'array'
           THEN jsonb_array_length(o.order_items) > 0
           ELSE false END AS has_items
    FROM public.orders o
    WHERE COALESCE(o.payment_status, '') <> 'rejected'
  ),
  units AS (
    -- structured cart lines (customer-written: cast defensively)
    SELECT
      CASE WHEN (e.item ->> 'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           THEN (e.item ->> 'product_id')::uuid END AS pid,
      CASE WHEN (e.item ->> 'variant_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           THEN (e.item ->> 'variant_id')::uuid END AS vid,
      left(btrim(COALESCE(e.item ->> 'size', '')), 30) AS sz,
      CASE WHEN (e.item ->> 'quantity') ~ '^[0-9]{1,4}$'
           THEN (e.item ->> 'quantity')::int END AS qty
    FROM live l
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN l.has_items THEN l.order_items ELSE '[]'::jsonb END
    ) AS e(item)
    WHERE jsonb_typeof(e.item) = 'object'

    UNION ALL

    -- legacy orders: one row = one line ("M" or a single-item cart summary "M(2)")
    SELECT
      l.row_product_id,
      l.row_variant_id,
      left(CASE WHEN position(',' IN COALESCE(l.row_size, '')) = 0
                THEN regexp_replace(btrim(COALESCE(l.row_size, '')), '\s*\([0-9]+\)$', '')
                ELSE btrim(l.row_size) END, 30),
      l.row_quantity
    FROM live l
    WHERE NOT l.has_items
  )
  SELECT u.pid, u.vid, u.sz, SUM(u.qty)::bigint
  FROM units u
  WHERE u.qty > 0 AND (u.pid IS NOT NULL OR u.vid IS NOT NULL)
  GROUP BY u.pid, u.vid, u.sz;
$$;

REVOKE ALL ON FUNCTION public.get_sold_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sold_counts() TO anon, authenticated;

-- Make PostgREST see the new columns and function right away
NOTIFY pgrst, 'reload schema';
