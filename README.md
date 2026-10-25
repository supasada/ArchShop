# 📐 Architecture Faculty Student Club - Shirt Pre-Order System (2026)
> ระบบสั่งจองเสื้อกิจกรรมสโมสรนักศึกษา คณะสถาปัตยกรรมศาสตร์ (Node.js + React + Vite + Tailwind CSS + Supabase Real-time)

ระบบสั่งจองเสื้อกิจกรรมที่ออกแบบตามสไตล์ **Minimalist & Architectural Aesthetic** เพื่อให้นักศึกษาสามารถสั่งจองเสื้อได้สะดวกรวดเร็วที่สุด **โดยไม่ต้องสมัครสมาชิกหรือล็อกอิน** พร้อมระบบอัปโหลดสลิปแบบเรียลไทม์ และระบบหลังบ้านสำหรับแอดมินสโมสรในการตรวจสลิป สรุปไซส์ส่งโรงงาน และส่งออกข้อมูล Excel / CSV

---

## 📁 โครงสร้างโปรเจกต์ (Node.js `src/` Structure)

```
ArchShop/
├── .env                              # ⚙️ วาง VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ที่นี่
├── .env.example                      # ตัวอย่างการตั้งค่าสภาพแวดล้อม
├── package.json                      # การจัดการ Dependencies & Scripts สำหรับ Node.js
├── vite.config.js                    # การตั้งค่า Vite Dev Server & Build Tool
├── tailwind.config.js                # ปรับแต่งธีม Tailwind CSS (Architectural Colors & Fonts)
├── postcss.config.js                 # การตั้งค่า PostCSS
├── index.html                        # Entry HTML สำหรับ React Application
├── public/                           # Static Assets ที่เสิร์ฟโดยตรง (โลโก้ และ รูปภาพ)
│   └── assets/
│       ├── logo.svg
│       └── images/
│           ├── arch_shirt_front.jpg
│           ├── arch_shirt_back.jpg
│           ├── arch_shirt_white_front.jpg
│           └── arch_shirt_white_back.jpg
│
├── src/
│   ├── main.jsx                      # React DOM Entrypoint
│   ├── App.jsx                       # Master Application Controller & Router
│   ├── index.css                     # Global Tailwind Directives & Custom Typography
│   │
│   ├── assets/                       # รูปภาพและโลโก้เวกเตอร์สโมสร
│   │   ├── logo.svg
│   │   └── images/
│   │       ├── arch_shirt_front.jpg
│   │       ├── arch_shirt_back.jpg
│   │       ├── arch_shirt_white_front.jpg
│   │       └── arch_shirt_white_back.jpg
│   │
│   ├── config/                       # การตั้งค่าระบบ
│   │   ├── supabase.js               # Supabase API, Auth, Storage, Realtime client
│   │   └── storeConfig.js            # 📝 ข้อมูลสโมสร, พร้อมเพย์, บัญชีธนาคาร, ภาควิชา, ตารางไซส์
│   │
│   ├── components/                   # React UI Components
│   │   ├── Navbar.jsx                # Header เมนูด้านบน และป้ายสถานะ Supabase
│   │   ├── HeroBanner.jsx            # แบนเนอร์หัวเว็บพร้อมนาฬิกานับถอยหลัง (Countdown)
│   │   ├── ProductCard.jsx           # การ์ดสินค้า พร้อมปุ่มสลับรูปหน้า-หลัง
│   │   ├── OrderModal.jsx            # ฟอร์มสั่งจอง คำนวณราคา และอัปโหลดสลิป
│   │   ├── ReceiptModal.jsx          # ใบเสร็จยืนยันคำสั่งซื้อ (รองรับการกดพิมพ์)
│   │   ├── TrackingModal.jsx         # ค้นหาสถานะออเดอร์ด้วยรหัสนักศึกษา
│   │   └── SizeChartModal.jsx        # ตารางขนาดไซส์เสื้อ (อก/ยาว/ไหล่)
│   │
│   ├── views/                        # หน้าการทำงานหลัก
│   │   ├── StoreView.jsx             # หน้าร้านค้าสำหรับนักศึกษา
│   │   └── AdminView.jsx             # หน้าแดชบอร์ดแอดมิน (ตรวจสลิป, สรุปยอดไซส์, กราฟ, CRUD)
│   │
│   ├── utils/                        # ฟังก์ชันช่วยเหลือ
│   │   ├── formatters.js             # แปลงค่าเงินบาท, วันที่ไทย, Dynamic PromptPay QR
│   │   └── csvExport.js              # ส่งออกข้อมูลคำสั่งซื้อเป็นไฟล์ CSV สำหรับ Excel
│   │
│   └── data/
│       └── mockData.js               # ข้อมูลจำลองสำหรับทดสอบทันที (Demo Mode)
│
├── supabase/
│   ├── FULL_DATABASE_SETUP.sql       # 💥 รวมคำสั่ง SQL ทั้งหมด (ตาราง + RLS + Storage + Seed Data)
│   ├── schema.sql                    # เฉพาะโครงสร้างตารางและ RLS
│   └── seed.sql                      # เฉพาะข้อมูลตัวอย่างเริ่มต้น
│
├── SETUP_GUIDE.md                    # คู่มือการติดตั้ง Supabase แบบละเอียด
└── README.md                         # เอกสารแนะนำโปรเจกต์
```

---

## ⚡ คำสั่งเริ่มต้นใช้งานด้วย Node.js

```bash
# 1. ติดตั้ง Dependencies ทั้งหมด
npm install

# 2. เริ่มต้นรัน Local Development Server (Vite)
npm run dev

# 3. สร้าง Production Build สำหรับขึ้นโฮสติ้ง
npm run build
```

---

## ⚙️ การตั้งค่า Supabase ใน `.env`

เปิดไฟล์ [`.env`](file:///C:/Users/ASUS/OneDrive/%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/ArchShop/.env) แล้วกรอกข้อมูลโปรเจกต์ Supabase ของคุณ:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 💥 การติดตั้งฐานข้อมูล Supabase ด้วย SQL Script

1. ไปที่ [Supabase Dashboard](https://supabase.com) -> เลือกโปรเจกต์ของคุณ
2. เข้าเมนู **SQL Editor** (ไอคอน `>_`) ทางซ้ายมือ -> กด **New query**
3. คัดลอกโค้ดทั้งหมดจากไฟล์ [`supabase/FULL_DATABASE_SETUP.sql`](file:///C:/Users/ASUS/OneDrive/%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/ArchShop/supabase/FULL_DATABASE_SETUP.sql) ไปวางแล้วกด **RUN** ครั้งเดียวเสร็จสมบูรณ์ทันที!

> ⚠️ หลังติดตั้งครั้งแรก ให้รัน `supabase/migrations/` ตามลำดับเลขไฟล์ (0002 → 0016) — ไฟล์ setup เดิมเปิดสิทธิ์ให้ทุกคนอ่าน/แก้ไขข้อมูล

---

## 🔐 ความปลอดภัย: ล็อกสิทธิ์ฐานข้อมูล (ต้องทำก่อน Deploy เวอร์ชันนี้)

Anon key อยู่ในไฟล์ JS ที่ทุกคนดาวน์โหลดได้ นโยบายเดิม (`FIX_SUPABASE_PERMISSIONS.sql`, `schema.sql`,
`FULL_DATABASE_SETUP.sql`, migration 0002–0013) เปิดให้ใครก็ได้อ่านข้อมูลลูกค้า แก้สถานะ หรือลบออเดอร์
Migration `0016_security_lockdown.sql` ปิดช่องโหว่นี้ — **ทำตามลำดับนี้:**

1. Supabase > **Authentication > Users > Add user**: สร้างบัญชีแอดมิน (เช่น `smoarchcmu@cmu.ac.th`) ด้วย **รหัสผ่านใหม่ที่แข็งแรง**
   - รหัสผ่านเก่าที่เคยเขียนไว้ในโค้ด (`AdminView.jsx`) และในคู่มือนี้ **ถือว่ารั่วแล้ว** (อยู่ใน git history และไฟล์ JS ที่ deploy ไปแล้ว)
     ถ้ามีผู้ใช้ใน Supabase Auth ที่ใช้รหัสนั้นอยู่ ให้เปลี่ยนรหัสทันที
2. **Authentication > Sign In / Providers**: ปิด **"Allow new users to sign up"** (ไม่ให้ใครสมัครบัญชีเองได้)
3. รัน migration ใน SQL Editor ตามลำดับ: `0012` → `0013` → `0014` → `0015` → `0016` (ถ้ายังไม่ได้รัน 0012–0015, ไฟล์ 0016 จะหยุดและแจ้งว่าขาดไฟล์ไหน)
4. เพิ่มแอดมินลงตาราง `admin_users` (รันซ้ำสำหรับแอดมินแต่ละคน):
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'smoarchcmu@cmu.ac.th'
   on conflict do nothing;
   ```
5. Deploy เว็บเวอร์ชันนี้ แล้วทดสอบ: เข้าหน้าแอดมินได้ / เปิดดูสลิปได้ / สั่งซื้อทดสอบได้ / เช็คสถานะด้วยรหัสนักศึกษา + เบอร์โทรได้

หลังจากนี้ **ห้ามรัน** `FIX_SUPABASE_PERMISSIONS.sql`, `schema.sql` หรือ `FULL_DATABASE_SETUP.sql` ซ้ำ (จะเปิดสิทธิ์กลับ) — ถ้าเผลอรัน ให้รัน `0016` ซ้ำ
บัญชีที่ล็อกอินได้แต่ไม่อยู่ใน `admin_users` จะเห็นข้อความ "บัญชีนี้ไม่มีสิทธิ์แอดมิน"
สลิปโอนเงินอยู่ใน bucket `payment-slips` แบบ **private**: ลูกค้าอัปโหลดได้อย่างเดียว แอดมินเปิดดูผ่านลิงก์ชั่วคราว 5 นาที

---

## 📝 การปรับแต่งข้อมูลสโมสรและ PromptPay
แก้ไขข้อมูลได้ง่ายๆ ที่ไฟล์ [`src/config/storeConfig.js`](file:///C:/Users/ASUS/OneDrive/%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/ArchShop/src/config/storeConfig.js)
