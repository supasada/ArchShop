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
2. **`payment-slips`**: เก็บรูปสลิปโอนเงินจากนักศึกษา (Public Upload, Admin Read)

> 💡 *หมายเหตุ:* คำสั่ง SQL ใน `schema.sql` ได้สร้าง Buckets และ Policies ให้อัตโนมัติแล้ว แต่คุณสามารถเข้าไปตรวจสอบได้ที่เมนู **Storage** ในแดชบอร์ด Supabase ว่ามีถัง `product-images` และ `payment-slips` ปรากฏอยู่และตั้งสถานะเป็น **Public bucket** เรียบร้อยแล้ว

---

## 4. สร้างบัญชี Admin สำหรับเข้าสู่ระบบจัดการ

เนื่องจากนักศึกษาทั่วไปสามารถสั่งซื้อได้ทันทีโดยไม่ต้องเข้าสู่ระบบ แต่ผู้ดูแลระบบ (Admin) ต้องยืนยันตัวตนผ่าน Supabase Auth:

1. ในแดชบอร์ด Supabase เมนูด้านซ้าย ให้คลิกที่ **Authentication** (ไอคอนรูปคน)
2. ไปที่แท็บ **Users**
3. คลิกปุ่ม **"Add user"** -> เลือก **"Create user"**
4. กรอกข้อมูล:
   - **Email:** `smoarchcmu@cmu.ac.th` (หรือ `smoarchcmu@arch.cmu.ac.th`)
   - **Password:** `archcmu-2026`
   - ติ๊กเลือก **"Auto Confirm User?"** เป็น **Yes** (เพื่อให้ใช้งานได้ทันทีโดยไม่ต้องยืนยันอีเมล)
5. คลิก **"Create user"**

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
