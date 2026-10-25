-- ==============================================================================
-- MIGRATION 0016: SECURITY LOCKDOWN (RLS, ADMIN-ONLY WRITES, PRIVATE SLIPS,
--                 EXACT-MATCH ORDER TRACKING)
--
-- Before this migration the public anon key (which ships inside the JS bundle) could
-- read every customer's name / phone / student ID / slip, mark orders paid, and delete
-- orders and products. After it:
--   * anon / any logged-in user: SELECT catalog tables, INSERT a *pending* order with
--     bounded quantities, a slip object name (not a URL) that was really uploaded and is
--     not used by any other order, and a server-set created_at,
--     upload a payment slip (no read-back), call get_sold_counts()
--     and track_orders() (exact match, masked phone, no slip / contact / address).
--   * admin (a row in public.admin_users): everything else.
--   Being "authenticated" is NOT enough — any user who signs up is authenticated.
--
-- PREREQUISITES — do these IN ORDER, or the shop / admin will stop working:
--   1. Run migrations 0012, 0013, 0014, 0015 first (this file checks and aborts if not).
--   2. Supabase Dashboard > Authentication > Users > "Add user": create the admin
--      (e.g. smoarchcmu@cmu.ac.th) with a NEW strong password. The old hard-coded
--      passwords are in git history and in the published JS bundle: treat them as leaked,
--      and change the password of any existing Auth user that used them.
--   3. Authentication > Sign In / Providers: turn OFF "Allow new users to sign up".
--   4. Run this file, then add the admin (run again for each admin):
--        insert into public.admin_users (user_id)
--        select id from auth.users where email = 'smoarchcmu@cmu.ac.th'
--        on conflict do nothing;
--   5. Deploy the app version from the same commit (it stores slip paths, reads slips
--      through short-lived signed URLs, and tracks orders through track_orders()).
--
-- Safe to re-run (idempotent). Runs in one transaction: on any error nothing changes.
-- Do NOT run FIX_SUPABASE_PERMISSIONS.sql, schema.sql or FULL_DATABASE_SETUP.sql again
-- afterwards — their policies re-open everything (re-run this file if you did).
-- Run manually in the Supabase SQL editor.
-- ==============================================================================
BEGIN;

-- ------------------------------------------------------------------------------
-- 0. PREREQUISITE CHECK (aborts the whole transaction with a readable message)
-- ------------------------------------------------------------------------------
DO $$
DECLARE missing text[] := ARRAY[]::text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'order_items') THEN
    missing := missing || '0012 (orders.order_items)'::text;
  END IF;
  IF to_regclass('public.product_images') IS NULL THEN
    missing := missing || '0013 (product_images)'::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'fulfillment_status') THEN
    missing := missing || '0014 (orders.fulfillment_status)'::text;
  END IF;
  IF to_regprocedure('public.get_sold_counts()') IS NULL THEN
    missing := missing || '0015 (get_sold_counts)'::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tracking_number') THEN
    missing := missing || '0004 (orders.tracking_number)'::text;
  END IF;
  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'Run these migrations before 0016: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. ADMINS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only rows are added from the SQL editor (service role / postgres bypass RLS).
REVOKE ALL ON public.admin_users FROM anon, authenticated;
GRANT SELECT ON public.admin_users TO authenticated;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_users' LOOP
    EXECUTE format('DROP POLICY %I ON public.admin_users', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins can read own admin row" ON public.admin_users
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- SECURITY DEFINER: reads admin_users regardless of the caller's RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. CATALOG TABLES: everyone reads, only admins write
--    Every existing policy on these tables is dropped first (including any added by
--    hand in the dashboard), so no old "FOR ALL TO anon" policy survives.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol record;
  catalog_tables text[] := ARRAY[
    'products', 'product_variants', 'product_variant_images', 'product_images',
    'promotions', 'promotion_scope_variants', 'promotion_bundle_items',
    'variant_size_rows', 'countdown_events', 'size_chart'   -- size_chart: only if 0010 was not run
  ];
BEGIN
  FOREACH t IN ARRAY catalog_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;

    -- Defence in depth: anon never needs to write the catalog.
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', t);
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);

    EXECUTE format('CREATE POLICY "Public can read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Admins can insert" ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()))', t);
    EXECUTE format('CREATE POLICY "Admins can update" ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()))', t);
    EXECUTE format('CREATE POLICY "Admins can delete" ON public.%I FOR DELETE TO authenticated USING ((SELECT public.is_admin()))', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. ORDERS: customers may only submit a pending order; admins do everything else
-- ------------------------------------------------------------------------------
-- order_items as written by customers: NULL, or an array of at most 50 objects, each
-- with an integer quantity 1–20 (the cart's per-line cap, CartContext) and at most 20
-- name/number pairs. Stops forged orders from exhausting stock (get_sold_counts sums
-- these quantities) with huge counts.
CREATE OR REPLACE FUNCTION public.order_items_within_limits(items jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT items IS NULL OR (
    jsonb_typeof(items) = 'array'
    AND jsonb_array_length(items) <= 50
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(items) AS e(item)
      WHERE jsonb_typeof(e.item) <> 'object'
         OR NOT (CASE WHEN (e.item ->> 'quantity') ~ '^[0-9]{1,2}$'
                      THEN (e.item ->> 'quantity')::int BETWEEN 1 AND 20
                      ELSE false END)
         OR (CASE WHEN jsonb_typeof(e.item -> 'personalization') = 'array'
                  THEN jsonb_array_length(e.item -> 'personalization') > 20
                  ELSE false END)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.order_items_within_limits(jsonb) TO anon, authenticated;

-- Name of a customer-uploaded slip object, e.g. slip_650610123_1761390000000_<32 hex>.jpg.
-- Must match slipObjectName() in src/utils/security.js. Used by the orders insert policy
-- and the payment-slips storage insert policy.
CREATE OR REPLACE FUNCTION public.slip_object_name_pattern()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT '^slip_[A-Za-z0-9]{1,20}_[0-9]{1,16}_[0-9a-f]{1,64}\.[a-z0-9]{1,5}$'::text;
$$;

GRANT EXECUTE ON FUNCTION public.slip_object_name_pattern() TO anon, authenticated;

-- One slip object = one order. The customer insert policy only accepts a slip name whose object
-- was really uploaded to the payment-slips bucket (the app uploads before inserting the order),
-- and the unique index below stops a second order from pointing at the same object.
-- SECURITY DEFINER because customers cannot read storage.objects; returns a boolean only, and
-- object names carry a 128-bit random token, so it is no use for listing other slips.
CREATE OR REPLACE FUNCTION public.slip_object_exists(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id = 'payment-slips' AND o.name = p_name
  );
$$;

REVOKE ALL ON FUNCTION public.slip_object_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slip_object_exists(text) TO anon, authenticated;

-- slip_object_exists() runs as whoever runs this file. If that role were subject to the RLS on
-- storage.objects it would never see slips and every customer order would be refused: abort.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Run 0016 as the postgres role (Supabase SQL editor): % cannot bypass RLS on storage.objects, so slip_object_exists() would always be false', current_user;
  END IF;
END $$;

-- Unique per slip object name. Legacy rows that store a full URL (and NULLs) are left out of
-- the index, so old duplicates cannot make this fail; the admin page still warns about those.
-- Names in the app's format can only have been written by this branch, but check first so a
-- duplicate gives a readable message (and nothing in this file is applied) instead of a bare error.
DO $$
DECLARE dups text;
BEGIN
  IF to_regclass('public.orders_payment_slip_object_key') IS NOT NULL THEN
    RETURN;
  END IF;
  SELECT string_agg(format('%s (%s orders)', payment_slip_url, n), ', ') INTO dups
  FROM (
    SELECT payment_slip_url, count(*) AS n FROM public.orders
    WHERE payment_slip_url ~ public.slip_object_name_pattern()
    GROUP BY payment_slip_url HAVING count(*) > 1
    ORDER BY payment_slip_url LIMIT 20
  ) d;
  IF dups IS NOT NULL THEN
    RAISE EXCEPTION 'Several orders share one slip: %. Check them in the admin page (and clear payment_slip_url on the wrong ones) before running 0016', dups;
  END IF;
  CREATE UNIQUE INDEX orders_payment_slip_object_key ON public.orders (payment_slip_url)
    WHERE payment_slip_url ~ public.slip_object_name_pattern();
END $$;

-- created_at is set by the database for customer inserts (a forged timestamp could make a
-- late order look like it came before the deadline). Admin inserts keep their value.
CREATE OR REPLACE FUNCTION public.orders_force_created_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_force_created_at ON public.orders;
CREATE TRIGGER orders_force_created_at
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_force_created_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' LOOP
    EXECUTE format('DROP POLICY %I ON public.orders', pol.policyname);
  END LOOP;
END $$;

-- Defence in depth: anon can only INSERT (the app inserts without reading the row back).
REVOKE SELECT, UPDATE, DELETE, TRUNCATE ON public.orders FROM anon;
REVOKE TRUNCATE ON public.orders FROM authenticated;
GRANT INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;

-- quantity (the order's total units): 1–20 when there are no order_items (legacy single
-- line, counted directly by get_sold_counts), otherwise 1–1000 (50 lines x 20).
CREATE POLICY "Customers can submit pending orders" ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    payment_status = 'pending'
    AND fulfillment_status = 'pending'
    AND tracking_number IS NULL
    -- the bare object name uploadSlip() writes (slipObjectName in src/utils/security.js):
    -- no URL scheme, no slashes, so a forged row cannot point the admin at another site;
    -- and the object must already be in the payment-slips bucket (one order per object:
    -- orders_payment_slip_object_key)
    AND (payment_slip_url IS NULL OR (
          payment_slip_url ~ public.slip_object_name_pattern()
          AND public.slip_object_exists(payment_slip_url)))
    AND public.order_items_within_limits(order_items)
    AND quantity BETWEEN 1 AND
        (CASE WHEN jsonb_typeof(order_items) = 'array' AND jsonb_array_length(order_items) > 0
              THEN 1000 ELSE 20 END)
  );

CREATE POLICY "Admins can insert orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can read orders" ON public.orders
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete orders" ON public.orders
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- ------------------------------------------------------------------------------
-- 4. ORDER TRACKING (replaces the old partial-match search on name/phone/email)
--    Matches EITHER the exact full order id, OR exact student ID AND phone together
--    (phone compared as digits only; +66 / 66 prefix treated as 0).
--    Returns only what the tracking card / receipt shows. Phone is masked except the
--    last 4 digits. Never returns the slip, email/LINE id, shipping address or notes.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
           WHEN d ~ '^66[0-9]{8,9}$' THEN '0' || substr(d, 3)
           ELSE d
         END
  FROM (SELECT regexp_replace(COALESCE(p, ''), '[^0-9]', '', 'g') AS d) s;
$$;

DROP FUNCTION IF EXISTS public.track_orders(text, text, text);
CREATE FUNCTION public.track_orders(p_order_id text DEFAULT NULL, p_student_id text DEFAULT NULL, p_phone text DEFAULT NULL)
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
      upper(btrim(COALESCE(p_student_id, ''))) AS sid,
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
      WHEN length(q.sid) >= 3 AND length(q.phone) >= 9 THEN
        upper(btrim(o.student_id)) = q.sid AND public.normalize_phone(o.phone_number) = q.phone
      ELSE false
    END
  )
  LEFT JOIN public.products p ON p.id = o.product_id
  ORDER BY o.created_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.track_orders(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_orders(text, text, text) TO anon, authenticated;

-- get_sold_counts (0015) returns counts only and stays public.
REVOKE ALL ON FUNCTION public.get_sold_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sold_counts() TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. STORAGE
--    product-images: public bucket, anyone reads, only admins write.
--    payment-slips: PRIVATE bucket. Customers can upload (INSERT only — no read-back,
--    no overwrite, no delete); only admins can read (the admin page asks for a
--    5-minute signed URL when a slip is opened).
--    Every existing storage.objects policy that mentions either bucket, or that has
--    no bucket condition at all (it would apply to slips too), is dropped first.
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-slips', 'payment-slips', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Slips: images only, at most 10 MB (the app compresses them client-side first).
DO $$
BEGIN
  UPDATE storage.buckets
     SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/*']
   WHERE id = 'payment-slips';
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'storage.buckets has no file_size_limit/allowed_mime_types column; skipped slip limits';
END $$;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, qual, with_check FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (
        (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~ '(payment-slips|product-images)'
        OR (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) !~ 'bucket_id'
      )
  LOOP
    RAISE NOTICE 'dropping storage.objects policy "%"', pol.policyname;
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Product images: public read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'product-images');
CREATE POLICY "Product images: admin insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND (SELECT public.is_admin()));
CREATE POLICY "Product images: admin update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id = 'product-images' AND (SELECT public.is_admin()));
CREATE POLICY "Product images: admin delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND (SELECT public.is_admin()));

CREATE POLICY "Payment slips: customers upload" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'payment-slips' AND name ~ public.slip_object_name_pattern());
CREATE POLICY "Payment slips: admin read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'payment-slips' AND (SELECT public.is_admin()));
CREATE POLICY "Payment slips: admin update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'payment-slips' AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id = 'payment-slips' AND (SELECT public.is_admin()));
CREATE POLICY "Payment slips: admin delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'payment-slips' AND (SELECT public.is_admin()));

COMMIT;

-- Make PostgREST see the new functions right away
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------------------------
-- After running: check the result (expect only the policies created above), e.g.
--   select tablename, policyname, roles, cmd from pg_policies
--   where schemaname in ('public', 'storage') order by 1, 2;
--   select id, public from storage.buckets;      -- payment-slips must be false
--   select * from public.admin_users;            -- must contain your admin
-- ------------------------------------------------------------------------------
