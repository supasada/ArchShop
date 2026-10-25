-- ==============================================================================
-- MIGRATION 0017: ORDER TRACKING BY 8-CHARACTER REF OR PHONE ALONE
-- Run manually in the Supabase SQL editor, after 0016. Idempotent — safe to re-run.
--
-- track_orders() now matches:
--   * p_order_id = the full order id, OR its 8-character ref (the "#1a2b3c4d" shown on
--     order cards / in admin). Exactly 8 hex characters — nothing shorter is accepted.
--   * p_phone alone (at least 9 digits, compared as digits, +66 treated as 0).
-- p_student_id is ignored: student ids are sequential, so searching by them alone would let
-- anyone walk through classmates' orders. The parameter stays so the signature is unchanged.
-- Returned fields are the same as 0016 (phone masked; no slip, contact, address or notes).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.track_orders(p_order_id text DEFAULT NULL, p_student_id text DEFAULT NULL, p_phone text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  full_name text,
  student_id text,
  year_of_study text,
  major text,
  phone_masked text,
  color text,
  size text,
  quantity integer,
  total_price numeric,
  delivery_method text,
  payment_status text,
  fulfillment_status text,
  tracking_number text,
  order_items jsonb,
  product_name text,
  product_price numeric,
  product_production_note text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      CASE WHEN btrim(COALESCE(p_order_id, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           THEN btrim(p_order_id)::uuid END AS oid,
      CASE WHEN btrim(COALESCE(p_order_id, '')) ~* '^[0-9a-f]{8}$'
           THEN lower(btrim(p_order_id)) END AS oref,
      public.normalize_phone(p_phone) AS phone
  )
  SELECT
    o.id,
    o.created_at,
    o.full_name,
    o.student_id,
    o.year_of_study,
    o.major,
    CASE
      WHEN length(public.normalize_phone(o.phone_number)) > 4
        THEN repeat('*', length(public.normalize_phone(o.phone_number)) - 4) || right(public.normalize_phone(o.phone_number), 4)
      ELSE '****'
    END,
    o.color,
    o.size,
    o.quantity,
    o.total_price,
    o.delivery_method,
    o.payment_status,
    o.fulfillment_status,
    o.tracking_number,
    o.order_items,
    p.name,
    p.price,
    p.production_note
  FROM q
  JOIN public.orders o ON (
    CASE
      WHEN q.oid IS NOT NULL THEN o.id = q.oid
      WHEN q.oref IS NOT NULL THEN left(o.id::text, 8) = q.oref
      WHEN length(q.phone) >= 9 THEN public.normalize_phone(o.phone_number) = q.phone
      ELSE false
    END
  )
  LEFT JOIN public.products p ON p.id = o.product_id
  ORDER BY o.created_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.track_orders(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_orders(text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
