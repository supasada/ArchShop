# Jersey personalization, product gallery, per-size stock, fulfillment status, egress & security

Date: 2026-10-25 · Branch: `feature/jersey-gallery-stock-status` (not deployed; owner reviews before merging to `master`)

## Why

The shop (smoarchcmu pre-order, Vite + React + Supabase) is adding a jersey. Customers currently
message the club with the name/number to print, and the club forwards it to the print shop. The owner
wants that info to arrive with the order. Along the way: newly added products cannot be picked in
promotions, products can only show 2 images, stock limits are not enforced, customers cannot see
production progress, and the Supabase free-tier egress/limits must not be blown.

Owner decisions (verbatim intent):
- Name/number on the jersey is **free** (no price change). Originally optional; changed 2026-10-26: both name and number are **required** on every unit of a personalizable product.
- **No restriction on language or letter case** for the name.
- Wants: more than 2 detail images per product; per-size stock limits; step-by-step order status
  (paid → in production → ready for pickup / shipped) with a clear production lead time.
- Avoid loading lots of data (Supabase limits).
- "Decide yourself what to add/remove and report back." Nothing goes to the main server until reviewed.

## Conventions (all workstreams)

- Migrations are hand-run SQL files in `supabase/migrations/NNNN_name.sql`, idempotent (`IF NOT EXISTS`,
  `DROP POLICY IF EXISTS`, `DO $$ … duplicate_object` for realtime), with the header comment style used
  by existing files. Next free number is 0012.
- The app must keep working against a database where the new migration has **not** been run yet
  (existing code already does this: e.g. `submitOrder` retries without unknown columns). New reads
  should degrade to the old behaviour on error, not crash.
- UI copy is Thai, Tailwind classes in the existing zinc/rounded style. Match surrounding code idiom.
- Unit tests with vitest for pure logic (`src/utils/*.test.js`). `npm test` and `npm run build` must pass.
- One commit per workstream on this branch. Do not push. Do not run anything against the live Supabase.

## Workstreams

### A. Promotions can target whole products
Cause: `PromotionManager` only offers `product_variants` rows; a product with no variants offers nothing,
and scoped promos are fixed lists. The pricing engine (`unitMatchesRef`) and DB (`product_id` column on
`promotion_scope_variants` / `promotion_bundle_items`) already support product-level refs.
- Picker lists, per product, a "ทั้งสินค้า (ทุกตัวเลือก)" chip (product ref) followed by that product's variant chips.
  A product ref matches every variant, including variants added later, and base (no-variant) cart items.
- API create/update persist scope refs as `{variant_id}` or `{product_id}`; editing loads both kinds back.
- Load all variants for the picker in **one** query (new `api.getAllVariants()`), not one per product.

### B. Structured order items + jersey personalization
- Migration: `orders.order_items JSONB` (nullable), `products.allow_personalization BOOLEAN DEFAULT false`.
- Admin product form: checkbox "ให้ลูกค้าใส่ชื่อ/เบอร์บนเสื้อ (ฟรี)".
- Storefront: when the product allows it, each unit gets optional "ชื่อบนเสื้อ" and "เบอร์" inputs
  (qty 3 → 3 pairs). Name: any language/case, trimmed, max 20 chars. Number: digits only, max 3 chars, kept
  as a string ("07" ≠ "7"). Both optional, independently. Show a simple live text preview of NAME/NUMBER.
- If any unit has a name or number, checkout requires a checkbox: "ตรวจสอบตัวสะกดชื่อ/เบอร์แล้ว (สินค้าสั่งทำ ไม่รับเปลี่ยนคืน)".
- Cart item carries `personalization: [{name, number}]` with length == quantity; quantity changes grow/shrink it.
  Items with personalization are not merged into an existing line with different personalization.
- Checkout writes `order_items` = array of `{product_id, variant_id, product_name, size, color, quantity,
  unit_price, personalization}` alongside the existing notes summary (keep the summary format byte-for-byte
  compatible with `src/utils/orderProducts.js`; do not put personalization in the summary).
  If insert fails because the column does not exist, retry without it (append a readable personalization
  line to the free-text part of notes as a fallback so the info is not lost).
- Admin: order list/detail shows per-item name/number; CSV export gets one row per personalized unit
  (or columns) usable as a print-shop sheet; add a "ส่งออกรายการสกรีน" export: product, variant, size, name, number,
  order id, customer, payment status — confirmed orders only by default.
- Receipt/Tracking show personalization.

### C. Product image gallery (more than 2 images)
- Migration: `product_images (id, product_id FK cascade, image_url, sort_order, created_at)` + RLS + realtime,
  mirroring `product_variant_images`.
- Admin product modal (existing products): upload multiple images (reuse `uploadProductImage`, which
  compresses), delete, reorder (move up/down). Front/back fields stay as the cover images.
- Storefront: `ProductSelectModal` shows front, back, then gallery images as thumbnails; variant images still
  take precedence when a variant is selected. Lazy-load, fetch gallery only when the modal opens.

### D. Per-size stock limits (enforced)
- Today `product_variants.stock_limit` is stored but never enforced.
- Migration: `size_stock_limits JSONB` on `products` and `product_variants` (`{"M": 30, "L": 20}`; missing
  size = unlimited). Plus a `SECURITY DEFINER` SQL function `get_sold_counts()` returning aggregated
  `(product_id, variant_id, size, sold)` from non-rejected orders, reading `order_items` when present and
  falling back to the single-row `product_id/product_variant_id/size/quantity` for legacy orders. Grant
  execute to anon. Returns only counts (no personal data) — small payload.
- Variant-level `stock_limit` (total) is also enforced using the same counts.
- Storefront: show "เหลือ N" when ≤ 10 left, disable sold-out sizes ("หมด"), clamp quantity; re-check right
  before submitting the order and block with a clear message if over.
- Admin: edit per-size limits in the product form (no-variant products) and in `VariantManager`; show sold/limit.
- Known limitation (document it): the check is client-side + pre-submit, not transactional; two last-second
  orders can oversell by a few. Acceptable for pre-orders.

### E. Fulfillment status timeline + production lead time
- Migration: `orders.fulfillment_status TEXT NOT NULL DEFAULT 'pending'` with CHECK in
  (`pending`, `in_production`, `ready`, `shipped`, `completed`); `products.production_note TEXT`
  (free text such as "ผลิต 3–4 สัปดาห์หลังปิดรับ").
- Admin: set fulfillment status in the order modal and with a bulk action on selected/filtered orders
  (e.g. move all confirmed orders of a product to "ส่งผลิต").
- Tracking modal: step timeline ชำระแล้ว → ส่งผลิต → พร้อมรับ / จัดส่งแล้ว (shipping orders show tracking number)
  → เสร็จสิ้น; rejected payment shows its own state. Product page and receipt show `production_note`.

### F. Egress / load reduction
- `getAllOrders`: select explicit columns and only the product fields needed (`products(id,name,image_front_url)`),
  not `products(*)`.
- Admin realtime: apply INSERT/UPDATE/DELETE payloads to local state instead of refetching every order on
  every event; if a full refetch is needed, debounce it (≥ 1s).
- Storefront: no per-product N+1 queries on load; gallery/variants/size rows fetched on demand.
- Storage: images already compressed client-side; ensure new uploads use it and `loading="lazy"`.
- Tracking search: exact match only (see G), which also stops returning many rows.

### G. Security lockdown (separate commit, owner must act before deploying)
Findings: `FIX_SUPABASE_PERMISSIONS.sql` grants `anon` full read/write/delete on `orders` and `products`
(and other tables use `FOR ALL TO anon`). Anyone with the public anon key can read every customer's name,
phone, student ID, mark orders paid, or delete them. Admin passwords are hard-coded in `AdminView.jsx` and
a mock session works without Supabase auth.
- Migration: RLS so `anon` can only: SELECT catalog tables, INSERT orders (with `payment_status='pending'`),
  call `get_sold_counts()`, call a new `track_orders(term)` SECURITY DEFINER function (exact match on order id,
  student id, or phone; returns only fields the tracking UI needs). Everything else requires `authenticated`.
- Storage: anon may upload slips; only authenticated may write `product-images`.
- Remove the hard-coded password check and mock-session fallback when Supabase is live.
- Owner actions (in report): create the admin user in Supabase Auth, disable public sign-ups, change the old
  password (it is in git history / the built bundle), then run the migration, then deploy.

## Out of scope (later)
Automatic slip verification via bank API; duplicate-number warnings for team jerseys; profanity filter;
graphical jersey mock-up preview.
