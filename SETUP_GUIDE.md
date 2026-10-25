# 🏛️ คู่มือการตั้งค่า Supabase สำหรับระบบสั่งจองเสื้อสโมสรคณะสถาปัตย์
# (Supabase Setup & Deployment Guide)

คู่มือนี้จะแนะนำขั้นตอนการติดตั้งฐานข้อมูล Supabase ตั้งแต่เริ่มต้นจนถึงการเปิดใช้งานระบบสั่งจองเสื้อแบบ Real-time อย่างสมบูรณ์

---

## 📋 สารบัญขั้นตอนการติดตั้ง
1. [สร้างโปรเจกต์บน Supabase](#1-สร้างโปรเจกต์บน-supabase)
2. [รันคำสั่ง SQL Schema และ RLS Policies](#2-รันคำสั่ง-sql-schema-และ-rls-policies)
3. [ตั้งค่า Storage Buckets สำหรับเก็บรูปภาพและสลิป](#3-ตั้งค่า-storage-buckets)
4. [สร้างบัญชี Admin สำหรับเข้าสู่ระบบจัดการ](#4-สร้างบัญชี-admin)
5. [เปิดใช้งาน Realtime Replication](#5-เปิดใช้งาน-realtime-replication)
6. [เชื่อมต่อ URL และ Anon Key เข้ากับเว็บ](#6-เชื่อมต่อ-url-และ-anon-key-เข้ากับเว็บ)
7. [ความปลอดภัย: ล็อกสิทธิ์ฐานข้อมูล (บังคับ)](#-ความปลอดภัย-ล็อกสิทธิ์ฐานข้อมูล-ต้องทำก่อน-deploy-เวอร์ชันนี้)

---

## 1. สร้างโปรเจกต์บน Supabase

1. เข้าเว็บไซต์ [https://supabase.com](https://supabase.com) และลงชื่อเข้าใช้ (Log in / Sign up)
2. คลิกปุ่ม **"New Project"**
3. ตั้งชื่อโปรเจกต์ เช่น `arch-shirt-club-2026`
4. กำหนด **Database Password** (บันทึกรหัสผ่านนี้ไว้ให้ปลอดภัย)
5. เลือก Region ใกล้ประเทศไทยมากที่สุด เช่น `Singapore (ap-southeast-1)`
6. คลิก **"Create new project"** และรอระบบเตรียมฐานข้อมูลประมาณ 1-2 นาที

---

## 2. รันคำสั่ง SQL Schema และ RLS Policies

1. ในแดชบอร์ด Supabase เมนูด้านซ้าย ให้คลิกที่ **SQL Editor** (ไอคอน `>_`)
2. คลิกปุ่ม **"New query"**
3. คัดลอกโค้ดทั้งหมดจากไฟล์ [`supabase/schema.sql`](file:///C:/Users/ASUS/OneDrive/%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/ArchShop/supabase/schema.sql) ไปวางในช่อง SQL Query
4. คลิกปุ่ม **"Run"** (หรือกด `Ctrl + Enter` / `Cmd + Enter`)
5. ตรวจสอบว่าระบบขึ้นข้อความ `Success. No rows returned`
6. *(ทางเลือก)* หากต้องการเพิ่มสินค้าตัวอย่างและข้อมูลออเดอร์ทดสอบ ให้สร้าง Query ใหม่แล้วคัดลอกโค้ดจาก [`supabase/seed.sql`](file:///C:/Users/ASUS/OneDrive/%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/ArchShop/supabase/seed.sql) แล้วกด **Run**

---

## 3. ตั้งค่า Storage Buckets

ระบบต้องการ Storage Buckets ทั้งหมด 2 ถัง:
1. **`product-images`**: เก็บรูปภาพเสื้อด้านหน้าและด้านหลัง (Public Read, Admin Write)
2. **`payment-slips`**: เก็บรูปสลิปโอนเงินจากนักศึกษา (ลูกค้าอัปโหลดได้อย่างเดียว, แอดมินเท่านั้นที่เปิดดูได้)

> 💡 *หมายเหตุ:* `schema.sql` สร้าง Buckets ให้ แต่ตั้ง `payment-slips` เป็น public — migration `0016_security_lockdown.sql` (ดูหัวข้อความปลอดภัยด้านล่าง) จะเปลี่ยน `payment-slips` เป็น **private** และตั้ง Policies ใหม่ทั้งหมด

---

## 4. สร้างบัญชี Admin สำหรับเข้าสู่ระบบจัดการ

เนื่องจากนักศึกษาทั่วไปสามารถสั่งซื้อได้ทันทีโดยไม่ต้องเข้าสู่ระบบ แต่ผู้ดูแลระบบ (Admin) ต้องยืนยันตัวตนผ่าน Supabase Auth:

1. ในแดชบอร์ด Supabase เมนูด้านซ้าย ให้คลิกที่ **Authentication** (ไอคอนรูปคน)
2. ไปที่แท็บ **Users**
3. คลิกปุ่ม **"Add user"** -> เลือก **"Create user"**
4. กรอกข้อมูล:
   - **Email:** `smoarchcmu@cmu.ac.th` (หรือ `smoarchcmu@arch.cmu.ac.th`)
   - **Password:** ตั้งรหัสผ่านใหม่ที่แข็งแรง (อย่าใช้รหัสที่เคยอยู่ในคู่มือ/โค้ดเดิม — ถือว่ารั่วแล้ว)
   - ติ๊กเลือก **"Auto Confirm User?"** เป็น **Yes** (เพื่อให้ใช้งานได้ทันทีโดยไม่ต้องยืนยันอีเมล)
5. คลิก **"Create user"**
6. ปิด **Authentication > Sign In / Providers > "Allow new users to sign up"**
7. หลังรัน migration `0016` ให้เพิ่มบัญชีนี้ลงตาราง `admin_users` (ดูหัวข้อความปลอดภัยด้านล่าง) — ล็อกอินได้อย่างเดียวยังไม่พอ

---

## 5. เปิดใช้งาน Realtime Replication

1. ไปที่เมนู **Database** -> **Replication** (หรือพิมพ์คำสั่ง SQL ตามด้านล่าง)
2. ตรวจสอบว่าตาราง `orders` และ `products` อยู่ใน `supabase_realtime` publication:
```sql
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
```
3. เมื่อเปิดใช้งาน Realtime แล้ว ทุกครั้งที่มีนักศึกษาส่งสลิปสั่งซื้อใหม่ หน้าจอแอดมินจะมีเสียงกระดิ่งแจ้งเตือนและรายการคำสั่งซื้อจะเด้งขึ้นมาแบบทันทีโดยไม่ต้องกดรีเฟรชหน้าเว็บ!

---

## 6. เชื่อมต่อ URL และ Anon Key เข้ากับเว็บ

1. ในแดชบอร์ด Supabase ไปที่ **Project Settings** (ไอคอนรูปฟันเฟืองล่างซ้าย) -> **API**
2. คัดลอกค่า 2 อย่าง:
   - **Project URL** (เช่น `https://abcdefghijkl.supabase.co`)
   - **Project API Keys** -> ส่วน **`anon` `public`** (key ยาวๆ ขึ้นต้นด้วย `eyJ...`)
3. **นำไปกรอกได้ 2 วิธี:**
   - **วิธีที่ 1 (ผ่านหน้าเว็บโดยตรง):** เปิดเว็บ `index.html` แล้วคลิกที่ป้าย **"Demo / Local Mode"** หรือไอคอนฐานข้อมูลมุมบนขวา -> นำ URL และ Anon Key ไปวางแล้วกด **"บันทึกและเชื่อมต่อ"**
   - **วิธีที่ 2 (แก้ไขไฟล์ Config):** เปิดไฟล์ [`js/config.js`](file:///C:/Users/ASUS/OneDrive/%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/ArchShop/js/config.js) แล้วเปลี่ยนค่าในตัวแปร `APP_CONFIG.supabaseUrl` และ `APP_CONFIG.supabaseAnonKey`

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

## 🚀 การ Deploy ขึ้น Production / Hosting

เนื่องจากโปรเจกต์นี้ถูกออกแบบเป็น Single Page Web Application แบบไร้ Build Tool ที่ทันสมัย คุณสามารถนำโฟลเดอร์นี้ไปอัปโหลดขึ้นบริการโฮสติ้งฟรีได้ทันที:

### ตัวเลือกที่ 1: Vercel / Netlify
- ลากโฟลเดอร์ `ArchShop` ไปวางบนหน้าแดชบอร์ดของ Netlify Drop หรือเชื่อม GitHub เข้ากับ Vercel ได้ทันทีโดยไม่ต้องตั้งค่า Build Command (Publish directory: `.`)

### ตัวเลือกที่ 2: GitHub Pages
- อัปโหลดไฟล์ขึ้น GitHub Repository
- ไปที่ **Settings** -> **Pages** -> เลือก Branch `main` และ Root `/` แล้วกด Save

---

## 🛠️ การเปลี่ยนข้อมูล PromptPay และเบอร์ติดต่อสโมสร

เปิดไฟล์ [`js/config.js`](file:///C:/Users/ASUS/OneDrive/%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3/ArchShop/js/config.js) และแก้ไขข้อมูลในส่วน:
```javascript
store: {
  facultyNameTh: 'สโมสรนักศึกษาคณะสถาปัตยกรรมศาสตร์',
  pickupLocation: 'ห้องสโมสรนักศึกษา ชั้น 1 ตึกสถาปัตยกรรมศาสตร์ (ข้างลานไทร)',
  contactPhone: '089-123-4567',
  contactLine: '@arch_studentclub',
  shippingFee: 50
},
payment: {
  promptpayNumber: '0891234567', // เบอร์พร้อมเพย์ หรือเลขประจำตัวผู้เสียภาษี
  bankName: 'ธนาคารกสิกรไทย (Kasikornbank - KBANK)',
  bankAccountNo: '123-4-56789-0'
}
```
ระบบจะสร้าง QR Code พร้อมเพย์แบบระบุยอดเงินที่ต้องโอนให้อัตโนมัติทันที!
