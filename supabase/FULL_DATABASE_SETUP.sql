-- ==============================================================================
-- 🏛️ ARCHITECTURE FACULTY STUDENT CLUB - SHIRT PRE-ORDER SYSTEM 2026
-- 💥 FULL DATABASE SETUP SCRIPT (SCHEMA + POLICIES + STORAGE + SEED DATA)
-- 
-- 📌 วิธีใช้งาน:
-- 1. ไปที่ Supabase Dashboard (https://supabase.com) -> เลือกโปรเจกต์ของคุณ
-- 2. เปิดเมนู "SQL Editor" (ไอคอน >_) ทางซ้ายมือ -> กด "New query"
-- 3. Copy โค้ดทั้งหมดในไฟล์นี้ไปแปะ แล้วกดปุ่ม "RUN" (หรือ Ctrl+Enter) ครั้งเดียวจบ!
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENABLE EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. CREATE TABLE: products (ตารางข้อมูลสินค้าเสื้อ)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    available_sizes TEXT[] NOT NULL DEFAULT ARRAY['S', 'M', 'L', 'XL', '2XL', '3XL'],
    available_colors TEXT[] NOT NULL DEFAULT ARRAY['Deep Black', 'Chalk White'],
    image_front_url TEXT,
    image_back_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    order_deadline TIMESTAMP WITH TIME ZONE
);

-- ------------------------------------------------------------------------------
-- 3. CREATE TABLE: orders (ตารางข้อมูลคำสั่งซื้อและสลิป)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    student_id TEXT NOT NULL,
    year_of_study TEXT NOT NULL,
    major TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    email_or_line_id TEXT NOT NULL,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
    payment_slip_url TEXT,
    delivery_method TEXT NOT NULL DEFAULT 'pickup' CHECK (delivery_method IN ('pickup', 'shipping')),
    shipping_address TEXT,
    notes TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'rejected'))
);

-- ------------------------------------------------------------------------------
-- 4. CREATE INDEXES (เพิ่มความเร็วในการค้นหาและโหลดข้อมูล)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_student_id ON public.orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- เปิดใช้งาน RLS บนทุกตาราง
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- นโยบายตาราง products: จัดการได้ทั้ง anon และ authenticated
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products"
ON public.products FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products"
ON public.products FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products"
ON public.products FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
TO anon, authenticated USING (true);

-- นโยบายตาราง orders: จัดการได้ทั้ง anon และ authenticated
DROP POLICY IF EXISTS "Public can submit orders" ON public.orders;
CREATE POLICY "Public can submit orders"
ON public.orders FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can track orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view orders" ON public.orders;
DROP POLICY IF EXISTS "Admins and Public can view orders" ON public.orders;
CREATE POLICY "Admins and Public can view orders"
ON public.orders FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
ON public.orders FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
TO anon, authenticated USING (true);

-- ------------------------------------------------------------------------------
-- 6. STORAGE BUCKETS & STORAGE POLICIES
-- ------------------------------------------------------------------------------
-- สร้าง Bucket สำหรับรูปสินค้าและสลิปการโอน
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-slips', 'payment-slips', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies: product-images (ดูได้ทุกคน, อัปโหลดเฉพาะแอดมิน)
DROP POLICY IF EXISTS "Public Access Product Images" ON storage.objects;
CREATE POLICY "Public Access Product Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admin Upload Product Images" ON storage.objects;
CREATE POLICY "Admin Upload Product Images"
ON storage.objects FOR INSERT
TO authenticated WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admin Update Product Images" ON storage.objects;
CREATE POLICY "Admin Update Product Images"
ON storage.objects FOR UPDATE
TO authenticated USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admin Delete Product Images" ON storage.objects;
CREATE POLICY "Admin Delete Product Images"
ON storage.objects FOR DELETE
TO authenticated USING (bucket_id = 'product-images');

-- Storage Policies: payment-slips (อัปโหลดได้ทุกคน, ดูได้ทุกคน/แอดมิน)
DROP POLICY IF EXISTS "Public Upload Payment Slips" ON storage.objects;
CREATE POLICY "Public Upload Payment Slips"
ON storage.objects FOR INSERT
TO anon, authenticated WITH CHECK (bucket_id = 'payment-slips');

DROP POLICY IF EXISTS "View Payment Slips" ON storage.objects;
CREATE POLICY "View Payment Slips"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-slips');

-- ------------------------------------------------------------------------------
-- 7. REALTIME CONFIGURATION (เปิดระบบแจ้งเตือนออเดอร์เข้าแบบทันที)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 8. INITIAL SEED DATA (ข้อมูลสินค้าและออเดอร์ตัวอย่าง)
-- ------------------------------------------------------------------------------
INSERT INTO public.products (
    id,
    name,
    description,
    price,
    available_sizes,
    available_colors,
    image_front_url,
    image_back_url,
    is_active,
    order_deadline
) VALUES
(
    'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    'ARCH 2026 : STRUCTURE & VOID (Black Edition)',
    'เสื้อยืดรุ่นซิกเนเจอร์ประจำปี 2026 สกรีนลายโครงสร้าง Isometric Wireframe ด้านหน้า และผัง Elevations คณะสถาปัตยกรรมศาสตร์ด้านหลัง เนื้อผ้า Cotton Comb 100% เบอร์ 20 นุ่มสบาย ทรงสตรีทโอเวอร์ไซส์ ทนทาน ซักไม่หด',
    350.00,
    ARRAY['S', 'M', 'L', 'XL', '2XL', '3XL'],
    ARRAY['Deep Black', 'Slate Charcoal'],
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
    true,
    (now() + interval '14 days')
),
(
    'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e',
    'GOLDEN RATIO φ 1.618 (Minimalist Cream Edition)',
    'เสื้อยืดโอเวอร์ไซส์สีขาวครีม สกรีนไดอะแกรมสัดส่วนทองคำ Golden Ratio และสัญลักษณ์เข็มทิศสถาปัตย์ Architectural Compass ผ้าระบายอากาศดีเยี่ยม ใส่สตูดิโอก็เท่ ใส่ไปตรวจไซต์ก็คูล',
    380.00,
    ARRAY['S', 'M', 'L', 'XL', '2XL'],
    ARRAY['Chalk White', 'Warm Off-White'],
    'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=800&auto=format&fit=crop&q=80',
    true,
    (now() + interval '14 days')
)
ON CONFLICT (id) DO NOTHING;

-- เพิ่มตัวอย่างคำสั่งซื้อทดสอบระบบแอดมิน
INSERT INTO public.orders (
    product_id,
    full_name,
    student_id,
    year_of_study,
    major,
    phone_number,
    email_or_line_id,
    color,
    size,
    quantity,
    total_price,
    payment_slip_url,
    delivery_method,
    shipping_address,
    notes,
    payment_status,
    created_at
) VALUES
(
    'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    'นายปวริศร สถาปัตย์พัฒนา',
    '65010234567',
    'ปี 3 (Junior)',
    'สถบ.5 ปี สถาปัตยกรรม',
    '0812345678',
    'line: pawaris_arch',
    'Deep Black',
    'L',
    1,
    350.00,
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60',
    'pickup',
    NULL,
    'ขอฝากไว้ที่โต๊ะสโมสรบ่ายวันพุธครับ',
    'confirmed',
    now() - interval '2 days'
),
(
    'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    'นางสาวพิมพ์มาดา ดีไซน์กุล',
    '66010567890',
    'ปี 2 (Sophomore)',
    'ภสถ.บ. 5 ปี ภูมิสถาปัตยกรรม',
    '0898765432',
    'pimmada@gmail.com',
    'Deep Black',
    'M',
    2,
    700.00,
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60',
    'pickup',
    NULL,
    'สั่งคู่กับเพื่อนค่ะ',
    'pending',
    now() - interval '3 hours'
),
(
    'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e',
    'นายธนกฤต แปลนวิถี',
    '64010998877',
    'ปี 4 (Senior)',
    'วท.บ. 4 ปี ออกแบบอุตสาหกรรม',
    '0865554321',
    'line: thanakrit.id',
    'Chalk White',
    'XL',
    1,
    430.00,
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60',
    'shipping',
    '123/45 ซอยสุขุมวิท 71 แขวงพระโขนงเหนือ เขตวัฒนา กทม. 10110',
    'โทรแจ้งก่อนส่งพัสดุครับ',
    'pending',
    now() - interval '1 hour'
);

-- ------------------------------------------------------------------------------
-- 9. VERIFICATION QUERY
-- ------------------------------------------------------------------------------
SELECT 'Database Setup Completed Successfully!' as status, count(*) as total_products FROM public.products;
