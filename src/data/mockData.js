/**
 * Mock Data Store (src/data/mockData.js)
 */

export const MOCK_PRODUCTS = [
  {
    id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    name: 'ARCH 2026 : STRUCTURE & VOID (Black Edition)',
    description: 'เสื้อยืดรุ่นซิกเนเจอร์ประจำปี 2026 สกรีนลายโครงสร้าง Isometric Wireframe ด้านหน้า และผัง Elevations คณะสถาปัตยกรรมศาสตร์ด้านหลัง เนื้อผ้า Cotton Comb 100% เบอร์ 20 นุ่มสบาย ทรงสตรีทโอเวอร์ไซส์ ทนทาน ซักไม่หด',
    price: 350,
    available_sizes: ['S', 'M', 'L', 'XL', '2XL'],
    available_colors: ['Deep Black', 'Slate Charcoal'],
    image_front_url: '/assets/images/arch_shirt_front.jpg',
    image_back_url: '/assets/images/arch_shirt_back.jpg',
    is_active: true,
    order_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e',
    name: 'GOLDEN RATIO φ 1.618 (Minimalist Cream Edition)',
    description: 'เสื้อยืดโอเวอร์ไซส์สีขาวครีม สกรีนไดอะแกรมสัดส่วนทองคำ Golden Ratio และสัญลักษณ์เข็มทิศสถาปัตย์ Architectural Compass ผ้าระบายอากาศดีเยี่ยม ใส่สตูดิโอก็เท่ ใส่ไปตรวจไซต์ก็คูล',
    price: 380,
    available_sizes: ['S', 'M', 'L', 'XL', '2XL'],
    available_colors: ['Chalk White', 'Warm Off-White'],
    image_front_url: '/assets/images/arch_shirt_white_back.jpg',
    image_back_url: '/assets/images/arch_shirt_white_front.jpg',
    is_active: true,
    order_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export const MOCK_ORDERS = [
  {
    id: 'ord-88319-arch',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    product_id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    product_name: 'ARCH 2026 : STRUCTURE & VOID (Black Edition)',
    full_name: 'นายปวริศร สถาปัตย์พัฒนา',
    student_id: '65010234567',
    year_of_study: 'ปี 3 (Junior)',
    major: 'สถบ.5 ปี สถาปัตยกรรม',
    phone_number: '081-234-5678',
    email_or_line_id: 'line: pawaris_arch',
    color: 'Deep Black',
    size: 'L',
    quantity: 1,
    total_price: 350,
    payment_slip_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60',
    delivery_method: 'pickup',
    shipping_address: '',
    notes: 'ขอฝากไว้ที่โต๊ะสโมสรบ่ายวันพุธครับ',
    payment_status: 'confirmed'
  },
  {
    id: 'ord-88320-arch',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    product_id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    product_name: 'ARCH 2026 : STRUCTURE & VOID (Black Edition)',
    full_name: 'นางสาวพิมพ์มาดา ดีไซน์กุล',
    student_id: '66010567890',
    year_of_study: 'ปี 2 (Sophomore)',
    major: 'ภสถ.บ. 5 ปี ภูมิสถาปัตยกรรม',
    phone_number: '089-876-5432',
    email_or_line_id: 'pimmada.d@gmail.com',
    color: 'Deep Black',
    size: 'M',
    quantity: 2,
    total_price: 700,
    payment_slip_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60',
    delivery_method: 'pickup',
    shipping_address: '',
    notes: 'สั่งคู่กับเพื่อนร่วมสตูดิโอ',
    payment_status: 'pending'
  }
];
