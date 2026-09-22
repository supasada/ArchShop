# Product Variants & Admin-Configurable Promotions — Design Spec

Date: 2026-09-22
Branch: `feature/promotions-and-variants`

## 1. Problem

Today the store has:
- A single hardcoded promotion ("buy 2 shirts, pay 399 THB total") baked into `src/config/storeConfig.js` and `src/context/CartContext.jsx`.
- No way to sell a product with sub-options (e.g. men's cut / women's cut) that each need their own price, stock, and photo gallery — admin can only create fully separate `products` rows, with one front/back image each.
- No way to define "buy this + that together, get a discount" bundle deals.

Requirement (from `req.txt`): admin must be able to (1) configure promotions themselves, (2) add product options like Shopee/TikTok (multiple images per option), (3) configure bundle promotions across products/options. Full coverage requested.

## 2. Data Model

### 2.1 `product_variants`

A variant is a sub-SKU of a product (e.g. "เสื้อผู้ชาย" / "เสื้อผู้หญิง"), with its own price, sizing, and stock. A product with zero variants behaves exactly as it does today (storefront falls back to the product's own price/images/sizes/colors).

```sql
CREATE TABLE public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                         -- e.g. "เสื้อผู้ชาย"
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    available_sizes TEXT[] NOT NULL DEFAULT ARRAY['S','M','L','XL','2XL'],
    available_colors TEXT[] NOT NULL DEFAULT ARRAY['Black','White'],
    stock_limit INTEGER,                        -- NULL = unlimited
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
```

### 2.2 `product_variant_images`

Multiple images per variant (gallery), each with position and a primary flag.

```sql
CREATE TABLE public.product_variant_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
```

### 2.3 `promotions`

One row per admin-defined promotion. `type` decides which fields are meaningful.

```sql
CREATE TABLE public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('quantity_break', 'bundle')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,         -- lower = evaluated first

    -- quantity_break fields
    applies_to_all BOOLEAN NOT NULL DEFAULT true, -- true = any variant/product counts
    quantity INTEGER,                             -- e.g. 2
    bundle_price NUMERIC(10,2),                    -- total price for `quantity` units

    -- bundle fields
    discount_type TEXT CHECK (discount_type IN ('fixed_amount', 'fixed_price')),
    discount_value NUMERIC(10,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
```

### 2.4 `promotion_scope_variants`

Only used when `type='quantity_break'` and `applies_to_all=false`: restricts which variants count toward the quantity break. A "plain" `products` row with no variant rows is referenced by its `products.id` cast into this table via a nullable `product_id` column (kept simple: this table can reference either a variant or a bare product).

```sql
CREATE TABLE public.promotion_scope_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    CHECK (
        (variant_id IS NOT NULL AND product_id IS NULL) OR
        (variant_id IS NULL AND product_id IS NOT NULL)
    )
);
```

### 2.5 `promotion_bundle_items`

Only used when `type='bundle'`: the exact set of variants/products (and quantities) that must all be present in the cart to trigger this promotion. Same variant-or-product referencing rule as above.

```sql
CREATE TABLE public.promotion_bundle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    required_qty INTEGER NOT NULL DEFAULT 1 CHECK (required_qty > 0),
    CHECK (
        (variant_id IS NOT NULL AND product_id IS NULL) OR
        (variant_id IS NULL AND product_id IS NOT NULL)
    )
);
```

Example matching the user's answer: promotion "A+B ชาย" has two `promotion_bundle_items` rows (variant A-men ×1, variant B-men ×1); a separate promotion "A+B หญิง" has its own two rows (variant A-women ×1, variant B-women ×1).

### 2.6 `orders` change

Add a nullable FK so an order can record which variant (if any) was purchased:

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;
```

### 2.7 RLS

Same pattern as existing tables: public `SELECT` on `product_variants`/`product_variant_images`/`promotions`/`promotion_scope_variants`/`promotion_bundle_items` (storefront needs to read them), admin (`anon, authenticated` — matches this project's existing convention of trusting the admin-only UI route rather than Supabase auth roles) full CRUD.

## 3. Pricing Engine

New pure module: `src/utils/pricingEngine.js`.

**Input:** `cartItems` (existing shape, extended with optional `variantId`), `promotions` (array fetched from Supabase with their scope/bundle rows joined in).
**Output:** `{ subtotal, rawSubtotal, discount, appliedPromotions: [{ id, name, ... }] }`.

**Algorithm:**
1. Expand cart into a flat list of "units" (one entry per shirt), each tagged with `variantId` (or `productId` if no variant) and `unitPrice`.
2. **Bundle pass** (promotions with `type='bundle'`, ordered by `priority` asc): for each, check how many complete sets of its `promotion_bundle_items` are present in the remaining unit pool (`floor` of the limiting item's available count / `required_qty`). For each complete set found, remove those units from the pool and record the discount (`fixed_amount` subtracted from the set's sum, or `fixed_price` replacing the set's sum).
3. **Quantity-break pass** (promotions with `type='quantity_break'`, ordered by `priority` asc): from the remaining pool (or the subset in `promotion_scope_variants` if `applies_to_all=false`), sort by price descending, chunk into groups of `quantity`, price each full group at `bundle_price`; leftovers stay in the pool.
4. Whatever remains in the pool prices at its own `unitPrice`.
5. `rawSubtotal` = sum of all original unit prices. `subtotal` = sum of all priced groups/leftovers. `discount` = `rawSubtotal - subtotal`.

This generalizes today's behavior exactly when seeded with one `quantity_break` promotion (`quantity=2`, `bundle_price=399`, `applies_to_all=true`).

`CartContext.jsx` will fetch active promotions (with nested rows) once on mount via Supabase and call `computePricing(cartItems, promotions)` instead of its current inline math.

## 4. Admin UI

`AdminView.jsx` gains:
- A **"ตัวเลือกสินค้า" (Variants)** panel inside each product's edit form: list existing variants, add/edit (name, price, sizes, colors, stock limit, active), reorder, and per-variant multi-image upload/reorder/delete (reuses the existing Supabase Storage `product-images` bucket upload pattern already used for front/back images).
- A new **"โปรโมชั่น" (Promotions)** tab alongside `orders`/`products`/`sizing`:
  - List of promotions with type badge, active toggle, priority, edit/delete.
  - Create/edit form: pick type first (`quantity_break` / `bundle`), then:
    - `quantity_break`: quantity, bundle price, "applies to all" toggle, and if off, a multi-select of products/variants.
    - `bundle`: discount type + value, and a repeatable "add item" control to pick product/variant + required qty (at least 2 items required to save).

## 5. Storefront

`ProductSelectModal` / `ProductCard`: if a product has active variants, render a variant picker (swatch buttons, same visual language as size/color pickers already in `ProductSelectModal`) before size/color. Selecting a variant swaps the displayed price and image gallery (new small gallery component supporting >2 images, replacing the current fixed front/back toggle) to that variant's images; size/color options come from the variant's own `available_sizes`/`available_colors`. Products with no variants keep exactly today's UI.

`HeroBanner`/`CartModal` promo badges switch from the hardcoded `storeConfig.promotion` text to a dynamic label built from the currently-applicable `promotions` (fall back to no badge if none active — no hardcoded default string).

## 6. Error handling / edge cases

- Deleting a variant that has existing `orders` referencing it: `ON DELETE SET NULL` on `orders.product_variant_id` — order history keeps the recorded price/size/color snapshot regardless.
- Deleting a variant/product referenced by a live promotion: `ON DELETE CASCADE` on the scope/bundle-item join rows removes just that promotion's reference to it; if a bundle promotion ends up with fewer than 2 items after such a deletion, admin UI flags it as incomplete/inactive rather than silently mis-pricing.
- Cart items referencing a variant that becomes inactive/deleted after being added: pricing engine treats missing variant lookups as "not eligible for any promo, priced at the cart-stored unit price" (never crashes checkout).
- Overlapping bundle promotions competing for the same units: resolved by `priority` order, first-match-consumes-units — no unit is discounted twice.

## 7. Testing

- Unit tests for `pricingEngine.js` (no existing test setup in the repo — this introduces the first test file; use plain Node `assert` via a `scripts/` runner or add `vitest` as a dev dependency, whichever is cheaper — decided during planning) covering: no promos, quantity-break only (matches current 399 behavior), bundle only, bundle + quantity-break combined, promotion referencing a deleted/inactive variant.
- Manual verification in the running dev app: create a variant with 2 images, create both promo types in admin, confirm cart totals and admin order records match.

## 8. Migration delivery

New file `supabase/migrations/0002_variants_and_promotions.sql`, written in the same idempotent style as `supabase/schema.sql` (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`). Not executed by Claude — the user runs it manually in the Supabase SQL editor.

## 9. Out of scope (YAGNI)

- Percentage-based or scheduled (start/end date) promotions — not requested; can be added later by extending the `promotions` table.
- Real inventory decrementing on order (stock_limit is advisory/display-only for now, consistent with the rest of the store not tracking stock today).
- Supabase Auth–based RLS tightening — left matching the existing `anon, authenticated` convention used by every other table in this project.
