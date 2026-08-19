-- ==============================================================================
-- FIX NOT NULL CONSTRAINT & FOREIGN KEYS (แก้ปัญหาลบสินค้าไม่ได้)
-- ก๊อปปี้โค้ดทั้งหมดนี้ไปวางใน Supabase Dashboard > SQL Editor แล้วกด RUN
-- ==============================================================================

-- 1. ปลดล็อก NOT NULL ของคอลัมน์ product_id ในตาราง orders
ALTER TABLE public.orders ALTER COLUMN product_id DROP NOT NULL;

-- 2. แก้ไข Foreign Key Constraint ให้เป็น ON DELETE SET NULL
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- 3. ปลดล็อกสิทธิ์ตาราง ORDERS ให้ลบ/แก้ไขได้ 100%
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access on orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Public can submit orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view orders" ON public.orders;
DROP POLICY IF EXISTS "Public can track orders" ON public.orders;
DROP POLICY IF EXISTS "Admins and Public can view orders" ON public.orders;

CREATE POLICY "Allow full access on orders"
ON public.orders FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 4. ปลดล็อกสิทธิ์ตาราง PRODUCTS ให้ลบ/แก้ไขได้ 100%
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access on products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Public can view active products" ON public.products;

CREATE POLICY "Allow full access on products"
ON public.products FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
