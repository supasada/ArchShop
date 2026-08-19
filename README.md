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

---

## 📝 การปรับแต่งข้อมูลสโมสรและ PromptPay
แก้ไขข้อมูลได้ง่ายๆ ที่ไฟล์ [`src/config/storeConfig.js`](file:///C:/Users/ASUS/OneDrive/%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/ArchShop/src/config/storeConfig.js)
