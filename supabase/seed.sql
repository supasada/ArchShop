-- ==============================================================================
-- ARCHITECTURE FACULTY STUDENT CLUB - SHIRT ORDERING SYSTEM
-- Sample Seed Data
-- ==============================================================================

-- Clear existing data if needed (optional)
-- TRUNCATE TABLE public.orders CASCADE;
-- TRUNCATE TABLE public.products CASCADE;

-- 1. Insert Initial Architecture Shirt Products
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
    'assets/images/arch_shirt_front.jpg',
    'assets/images/arch_shirt_back.jpg',
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
    'assets/images/arch_shirt_white_back.jpg',
    'assets/images/arch_shirt_white_front.jpg',
    true,
    (now() + interval '14 days')
)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Sample Orders for testing Admin Dashboard
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
    'ปี 3',
    'สถบ.5 ปี สถาปัตยกรรม',
    '0812345678',
    'line: pawaris_arch',
    'Deep Black',
    'L',
    1,
    350.00,
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
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
    'ปี 2',
    'ภสถ.บ. 5 ปี ภูมิสถาปัตยกรรม',
    '0898765432',
    'pimmada@gmail.com',
    'Deep Black',
    'M',
    2,
    700.00,
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
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
    'ปี 4',
    'วท.บ. 4 ปี ออกแบบอุตสาหกรรม',
    '0865554321',
    'line: thanakrit.id',
    'Chalk White',
    'XL',
    1,
    430.00,
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    'shipping',
    '123/45 ซอยสุขุมวิท 71 แขวงพระโขนงเหนือ เขตวัฒนา กทม. 10110',
    'โทรแจ้งก่อนส่งพัสดุครับ',
    'pending',
    now() - interval '1 hour'
);
