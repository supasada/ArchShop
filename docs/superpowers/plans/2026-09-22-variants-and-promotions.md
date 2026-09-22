# Product Variants & Admin-Configurable Promotions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin define product variants (sub-SKUs with own price/stock/images) and admin-configurable promotions (quantity-break and bundle), replacing the hardcoded "2 for 399" logic.

**Architecture:** New Supabase tables (`product_variants`, `product_variant_images`, `promotions`, `promotion_scope_variants`, `promotion_bundle_items`) + a pure pricing engine module that both the storefront cart and admin previews call, fed by promotions fetched from Supabase instead of `storeConfig.promotion`.

**Tech Stack:** React + Vite, Supabase (Postgres + Storage), Tailwind. Adds `vitest` as the project's first test runner.

**Spec:** `docs/superpowers/specs/2026-09-22-variants-and-promotions-design.md`

## Global Constraints

- SQL migration lives in `supabase/migrations/0002_variants_and_promotions.sql`, written idempotently (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`) — never executed by the agent, the user runs it manually.
- Every new Supabase table gets public `SELECT` RLS + `anon, authenticated` write RLS, matching the existing convention in `supabase/schema.sql` (this project does not use Supabase Auth roles for admin gating — the admin route itself is the gate).
- A product with zero `product_variants` rows must keep working exactly as it does today, on both storefront and admin — no behavior change for existing single-SKU products.
- No percentage/scheduled promotions, no real inventory decrementing — out of scope per spec section 9.

---

### Task 1: Pricing engine (TDD)

**Files:**
- Create: `src/utils/pricingEngine.js`
- Create: `src/utils/pricingEngine.test.js`
- Create: `vitest.config.js`
- Modify: `package.json` (add `vitest` devDependency + `"test": "vitest run"` script)

**Interfaces:**
- Produces: `computePricing(cartItems, promotions)` → `{ rawSubtotal, subtotal, discount, appliedPromotions }`.
  - `cartItems`: array of `{ productId, variantId (optional), price, quantity }`.
  - `promotions`: array of `{ id, name, type, is_active, priority, applies_to_all, quantity, bundle_price, discount_type, discount_value, scope_variants: [{variant_id, product_id}], bundle_items: [{variant_id, product_id, required_qty}] }`.
  - This is consumed by Task 4 (`CartContext.jsx`).

- [ ] **Step 1: Add vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create `vitest.config.js` at the project root**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.js']
  }
});
```

- [ ] **Step 3: Add the test script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run"
```

- [ ] **Step 4: Write `src/utils/pricingEngine.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { computePricing } from './pricingEngine';

describe('computePricing', () => {
  it('returns raw price when there are no promotions', () => {
    const cartItems = [{ productId: 'p1', price: 219, quantity: 3 }];
    const result = computePricing(cartItems, []);
    expect(result.rawSubtotal).toBe(657);
    expect(result.subtotal).toBe(657);
    expect(result.discount).toBe(0);
    expect(result.appliedPromotions).toEqual([]);
  });

  it('applies a store-wide quantity-break promotion (2 for 399)', () => {
    const cartItems = [{ productId: 'p1', price: 219, quantity: 3 }];
    const promotions = [{
      id: 'promo1', name: '2 ตัว 399', type: 'quantity_break', is_active: true, priority: 0,
      applies_to_all: true, quantity: 2, bundle_price: 399
    }];
    const result = computePricing(cartItems, promotions);
    expect(result.rawSubtotal).toBe(657);
    expect(result.subtotal).toBe(618); // 399 (pair) + 219 (single leftover)
    expect(result.discount).toBe(39);
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].type).toBe('quantity_break');
  });

  it('applies a bundle promotion requiring specific variants', () => {
    const cartItems = [
      { productId: 'pA', variantId: 'vA', price: 300, quantity: 1 },
      { productId: 'pB', variantId: 'vB', price: 300, quantity: 1 }
    ];
    const promotions = [{
      id: 'promo2', name: 'A+B ชาย', type: 'bundle', is_active: true, priority: 0,
      discount_type: 'fixed_amount', discount_value: 100,
      bundle_items: [
        { variant_id: 'vA', required_qty: 1 },
        { variant_id: 'vB', required_qty: 1 }
      ]
    }];
    const result = computePricing(cartItems, promotions);
    expect(result.rawSubtotal).toBe(600);
    expect(result.subtotal).toBe(500);
    expect(result.discount).toBe(100);
    expect(result.appliedPromotions[0].type).toBe('bundle');
  });

  it('applies bundle first, then quantity-break to leftover units', () => {
    const cartItems = [
      { productId: 'pA', variantId: 'vA', price: 300, quantity: 2 },
      { productId: 'pB', variantId: 'vB', price: 300, quantity: 1 }
    ];
    const promotions = [
      {
        id: 'bundle1', name: 'A+B', type: 'bundle', is_active: true, priority: 0,
        discount_type: 'fixed_amount', discount_value: 100,
        bundle_items: [
          { variant_id: 'vA', required_qty: 1 },
          { variant_id: 'vB', required_qty: 1 }
        ]
      },
      {
        id: 'qty1', name: '2 for 399', type: 'quantity_break', is_active: true, priority: 1,
        applies_to_all: true, quantity: 2, bundle_price: 399
      }
    ];
    // Bundle consumes 1x vA + 1x vB (600 -> 500). Leftover: 1x vA @300.
    // Only 1 unit left, not enough for a quantity-break pair, so it stays at 300.
    const result = computePricing(cartItems, promotions);
    expect(result.rawSubtotal).toBe(900);
    expect(result.subtotal).toBe(800); // 500 (bundle) + 300 (leftover single)
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].type).toBe('bundle');
  });

  it('ignores a quantity-break promotion scoped to a variant not in the cart', () => {
    const cartItems = [{ productId: 'p1', price: 219, quantity: 2 }];
    const promotions = [{
      id: 'promo3', name: 'scoped promo', type: 'quantity_break', is_active: true, priority: 0,
      applies_to_all: false, quantity: 2, bundle_price: 100,
      scope_variants: [{ variant_id: 'does-not-exist-in-cart' }]
    }];
    const result = computePricing(cartItems, promotions);
    expect(result.subtotal).toBe(438); // no promo applied, full price
    expect(result.discount).toBe(0);
  });

  it('ignores inactive promotions', () => {
    const cartItems = [{ productId: 'p1', price: 219, quantity: 2 }];
    const promotions = [{
      id: 'promo4', name: 'inactive', type: 'quantity_break', is_active: false, priority: 0,
      applies_to_all: true, quantity: 2, bundle_price: 100
    }];
    const result = computePricing(cartItems, promotions);
    expect(result.subtotal).toBe(438);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `pricingEngine.js` does not exist yet / `computePricing` is not exported.

- [ ] **Step 6: Implement `src/utils/pricingEngine.js`**

```js
function unitKey(item) {
  return item.variantId ? `v:${item.variantId}` : `p:${item.productId}`;
}

function scopeKey(ref) {
  return ref.variant_id ? `v:${ref.variant_id}` : `p:${ref.product_id}`;
}

export function computePricing(cartItems, promotions = []) {
  const pool = [];
  (cartItems || []).forEach((item) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const price = Number(item.price) || 0;
    for (let i = 0; i < qty; i++) {
      pool.push({ key: unitKey(item), price });
    }
  });

  const rawSubtotal = pool.reduce((sum, u) => sum + u.price, 0);
  const appliedPromotions = [];
  let subtotal = 0;

  const activePromos = (promotions || [])
    .filter((p) => p.is_active)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

  // --- Bundle pass: consume exact matching sets first ---
  activePromos
    .filter((p) => p.type === 'bundle')
    .forEach((promo) => {
      const items = promo.bundle_items || [];
      if (items.length === 0) return;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const consumedIdx = [];
        let complete = true;

        for (const bi of items) {
          const key = scopeKey(bi);
          const need = bi.required_qty || 1;
          const available = pool
            .map((u, idx) => ({ ...u, idx }))
            .filter((u) => u.key === key && !consumedIdx.includes(u.idx))
            .sort((a, b) => b.price - a.price);

          if (available.length < need) {
            complete = false;
            break;
          }
          for (let n = 0; n < need; n++) consumedIdx.push(available[n].idx);
        }

        if (!complete) break;

        const setSum = consumedIdx.reduce((s, idx) => s + pool[idx].price, 0);
        const setPrice = promo.discount_type === 'fixed_price'
          ? Math.max(0, Number(promo.discount_value) || 0)
          : Math.max(0, setSum - (Number(promo.discount_value) || 0));

        subtotal += setPrice;
        appliedPromotions.push({ id: promo.id, name: promo.name, type: 'bundle', discount: setSum - setPrice });

        consumedIdx.sort((a, b) => b - a).forEach((idx) => pool.splice(idx, 1));
      }
    });

  // --- Quantity-break pass: chunk remaining eligible units ---
  activePromos
    .filter((p) => p.type === 'quantity_break')
    .forEach((promo) => {
      const n = Number(promo.quantity) || 0;
      if (n <= 0) return;

      let eligibleIdx;
      if (promo.applies_to_all) {
        eligibleIdx = pool.map((_, idx) => idx);
      } else {
        const scopeKeys = (promo.scope_variants || []).map(scopeKey);
        eligibleIdx = pool
          .map((u, idx) => ({ u, idx }))
          .filter(({ u }) => scopeKeys.includes(u.key))
          .map(({ idx }) => idx);
      }
      eligibleIdx.sort((a, b) => pool[b].price - pool[a].price);

      const groups = Math.floor(eligibleIdx.length / n);
      if (groups <= 0) return;

      const consumed = eligibleIdx.slice(0, groups * n);
      const groupSum = consumed.reduce((s, idx) => s + pool[idx].price, 0);
      const newSum = groups * (Number(promo.bundle_price) || 0);

      subtotal += newSum;
      appliedPromotions.push({ id: promo.id, name: promo.name, type: 'quantity_break', discount: groupSum - newSum });

      consumed.sort((a, b) => b - a).forEach((idx) => pool.splice(idx, 1));
    });

  // --- Remainder at full price ---
  subtotal += pool.reduce((s, u) => s + u.price, 0);

  return {
    rawSubtotal,
    subtotal,
    discount: Math.max(0, rawSubtotal - subtotal),
    appliedPromotions
  };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 6 tests green.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.js src/utils/pricingEngine.js src/utils/pricingEngine.test.js
git commit -m "feat: add promotion pricing engine with bundle and quantity-break support"
```

---

### Task 2: SQL migration file

**Files:**
- Create: `supabase/migrations/0002_variants_and_promotions.sql`

**Interfaces:**
- Produces: the five tables and `orders.product_variant_id` column described in spec section 2. Task 3 (`api.js`) reads/writes these tables and column names verbatim — they must match exactly.

- [ ] **Step 1: Write the migration file**

```sql
-- ==============================================================================
-- MIGRATION 0002: PRODUCT VARIANTS & ADMIN-CONFIGURABLE PROMOTIONS
-- Run manually in the Supabase SQL editor. Idempotent — safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PRODUCT VARIANTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    available_sizes TEXT[] NOT NULL DEFAULT ARRAY['S', 'M', 'L', 'XL', '2XL'],
    available_colors TEXT[] NOT NULL DEFAULT ARRAY['Black', 'White'],
    stock_limit INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_variant_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variant_images_variant_id ON public.product_variant_images(variant_id);

-- ------------------------------------------------------------------------------
-- 2. PROMOTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('quantity_break', 'bundle')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    applies_to_all BOOLEAN NOT NULL DEFAULT true,
    quantity INTEGER,
    bundle_price NUMERIC(10, 2),
    discount_type TEXT CHECK (discount_type IN ('fixed_amount', 'fixed_price')),
    discount_value NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.promotion_scope_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    CHECK (
        (variant_id IS NOT NULL AND product_id IS NULL) OR
        (variant_id IS NULL AND product_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.promotion_bundle_items (
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

CREATE INDEX IF NOT EXISTS idx_promo_scope_promotion_id ON public.promotion_scope_variants(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promo_bundle_promotion_id ON public.promotion_bundle_items(promotion_id);

-- ------------------------------------------------------------------------------
-- 3. ORDERS: RECORD WHICH VARIANT WAS PURCHASED
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_product_variant_id ON public.orders(product_variant_id);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_scope_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_bundle_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view variants" ON public.product_variants;
CREATE POLICY "Public can view variants" ON public.product_variants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage variants" ON public.product_variants;
CREATE POLICY "Admins can manage variants" ON public.product_variants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view variant images" ON public.product_variant_images;
CREATE POLICY "Public can view variant images" ON public.product_variant_images FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage variant images" ON public.product_variant_images;
CREATE POLICY "Admins can manage variant images" ON public.product_variant_images FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view promotions" ON public.promotions;
CREATE POLICY "Public can view promotions" ON public.promotions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage promotions" ON public.promotions;
CREATE POLICY "Admins can manage promotions" ON public.promotions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view promo scope" ON public.promotion_scope_variants;
CREATE POLICY "Public can view promo scope" ON public.promotion_scope_variants FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage promo scope" ON public.promotion_scope_variants;
CREATE POLICY "Admins can manage promo scope" ON public.promotion_scope_variants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view promo bundle items" ON public.promotion_bundle_items;
CREATE POLICY "Public can view promo bundle items" ON public.promotion_bundle_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage promo bundle items" ON public.promotion_bundle_items;
CREATE POLICY "Admins can manage promo bundle items" ON public.promotion_bundle_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. REALTIME (so admin promo edits reflect live in open storefront tabs)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Step 2: Commit (file only — do NOT run this SQL)**

```bash
git add supabase/migrations/0002_variants_and_promotions.sql
git commit -m "feat: add SQL migration for product variants and promotions tables"
```

Tell the user the migration file is ready at `supabase/migrations/0002_variants_and_promotions.sql` for them to run manually.

---

### Task 3: Data access layer — variants, variant images, promotions

**Files:**
- Modify: `src/config/supabase.js`

**Interfaces:**
- Consumes: `supabase` client and `isLiveSupabase` flag already defined at the top of this file (lines 1-21).
- Produces (added to the exported `api` object, same object used throughout the app as `import { api } from '../config/supabase'`):
  - `api.getVariants(productId)` → `Promise<Array>` (each variant includes its `images` array, sorted by `sort_order`)
  - `api.createVariant(variantData)` → `Promise<variant>`
  - `api.updateVariant(id, updates)` → `Promise<variant>`
  - `api.deleteVariant(id)` → `Promise<true>`
  - `api.addVariantImage(variantId, imageUrl)` → `Promise<image>`
  - `api.deleteVariantImage(imageId)` → `Promise<true>`
  - `api.getPromotions()` → `Promise<Array>` (each promotion includes `scope_variants` and `bundle_items` arrays, matching the shape `pricingEngine.computePricing` expects from Task 1)
  - `api.createPromotion(promotionData)` → `Promise<promotion>` (`promotionData` may include `scope_variant_ids: string[]` and/or `bundle_items: [{variant_id?, product_id?, required_qty}]` — these nested arrays are written to the join tables after the parent row insert)
  - `api.updatePromotion(id, updates)` → `Promise<promotion>` (same nested-array handling: replaces the join rows)
  - `api.deletePromotion(id)` → `Promise<true>`

- [ ] **Step 1: Add variant + promotion methods to `src/config/supabase.js`**

Insert this block right before the closing `};` of the `api` object (after the `subscribeProducts` method, which currently ends the file at line 442-443):

```js
  // Product Variants
  async getVariants(productId) {
    if (!productId) return [];
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*, product_variant_images(*)')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });
      if (error) {
        console.warn('Supabase getVariants notice:', error);
        return [];
      }
      return (data || []).map((v) => ({
        ...v,
        images: (v.product_variant_images || []).sort((a, b) => a.sort_order - b.sort_order)
      }));
    }
    return [];
  },

  async createVariant(variantData) {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('product_variants').insert([variantData]).select();
      if (error) {
        console.error('Supabase createVariant error:', error);
        throw error;
      }
      return data?.[0];
    }
    throw new Error('Variants require a live Supabase connection.');
  },

  async updateVariant(id, updates) {
    const allowedCols = ['name', 'price', 'available_sizes', 'available_colors', 'stock_limit', 'is_active', 'sort_order'];
    const cleanUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedCols.includes(key)) cleanUpdates[key] = updates[key];
    });
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('product_variants').update(cleanUpdates).eq('id', id).select();
      if (error) {
        console.error('Supabase updateVariant error:', error);
        throw error;
      }
      return data?.[0];
    }
    throw new Error('Variants require a live Supabase connection.');
  },

  async deleteVariant(id) {
    if (isLiveSupabase && supabase) {
      const { error } = await supabase.from('product_variants').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    throw new Error('Variants require a live Supabase connection.');
  },

  async addVariantImage(variantId, imageUrl, sortOrder = 0) {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase
        .from('product_variant_images')
        .insert([{ variant_id: variantId, image_url: imageUrl, sort_order: sortOrder }])
        .select();
      if (error) throw error;
      return data?.[0];
    }
    throw new Error('Variant images require a live Supabase connection.');
  },

  async deleteVariantImage(imageId) {
    if (isLiveSupabase && supabase) {
      const { error } = await supabase.from('product_variant_images').delete().eq('id', imageId);
      if (error) throw error;
      return true;
    }
    throw new Error('Variant images require a live Supabase connection.');
  },

  // Promotions
  async getPromotions() {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase
        .from('promotions')
        .select('*, promotion_scope_variants(*), promotion_bundle_items(*)')
        .order('priority', { ascending: true });
      if (error) {
        console.warn('Supabase getPromotions notice:', error);
        return [];
      }
      return (data || []).map((p) => ({
        ...p,
        scope_variants: p.promotion_scope_variants || [],
        bundle_items: p.promotion_bundle_items || []
      }));
    }
    return [];
  },

  async createPromotion(promotionData) {
    if (!isLiveSupabase || !supabase) throw new Error('Promotions require a live Supabase connection.');
    const { scope_variant_ids, bundle_items, ...promoFields } = promotionData;
    const { data, error } = await supabase.from('promotions').insert([promoFields]).select();
    if (error) {
      console.error('Supabase createPromotion error:', error);
      throw error;
    }
    const promo = data?.[0];
    if (Array.isArray(scope_variant_ids) && scope_variant_ids.length > 0) {
      await supabase.from('promotion_scope_variants').insert(
        scope_variant_ids.map((variantId) => ({ promotion_id: promo.id, variant_id: variantId }))
      );
    }
    if (Array.isArray(bundle_items) && bundle_items.length > 0) {
      await supabase.from('promotion_bundle_items').insert(
        bundle_items.map((bi) => ({
          promotion_id: promo.id,
          variant_id: bi.variant_id || null,
          product_id: bi.product_id || null,
          required_qty: bi.required_qty || 1
        }))
      );
    }
    return promo;
  },

  async updatePromotion(id, updates) {
    if (!isLiveSupabase || !supabase) throw new Error('Promotions require a live Supabase connection.');
    const allowedCols = [
      'name', 'type', 'is_active', 'priority', 'applies_to_all',
      'quantity', 'bundle_price', 'discount_type', 'discount_value'
    ];
    const { scope_variant_ids, bundle_items, ...rest } = updates;
    const cleanUpdates = {};
    Object.keys(rest).forEach((key) => {
      if (allowedCols.includes(key)) cleanUpdates[key] = rest[key];
    });
    const { data, error } = await supabase.from('promotions').update(cleanUpdates).eq('id', id).select();
    if (error) {
      console.error('Supabase updatePromotion error:', error);
      throw error;
    }
    if (Array.isArray(scope_variant_ids)) {
      await supabase.from('promotion_scope_variants').delete().eq('promotion_id', id);
      if (scope_variant_ids.length > 0) {
        await supabase.from('promotion_scope_variants').insert(
          scope_variant_ids.map((variantId) => ({ promotion_id: id, variant_id: variantId }))
        );
      }
    }
    if (Array.isArray(bundle_items)) {
      await supabase.from('promotion_bundle_items').delete().eq('promotion_id', id);
      if (bundle_items.length > 0) {
        await supabase.from('promotion_bundle_items').insert(
          bundle_items.map((bi) => ({
            promotion_id: id,
            variant_id: bi.variant_id || null,
            product_id: bi.product_id || null,
            required_qty: bi.required_qty || 1
          }))
        );
      }
    }
    return data?.[0];
  },

  async deletePromotion(id) {
    if (isLiveSupabase && supabase) {
      const { error } = await supabase.from('promotions').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    throw new Error('Promotions require a live Supabase connection.');
  },
```

Note: unlike the existing product/order methods, these do not need a localStorage mock fallback — variants and promotions are new, opt-in admin features that require a live Supabase project (matching `SETUP_GUIDE.md`'s existing requirement that the admin panel needs live Supabase).

- [ ] **Step 2: Manually verify in the dev server**

Run: `npm run dev`
In the browser console (with a live Supabase project configured and the migration from Task 2 already run), confirm `window` has access via React DevTools is not needed — instead, verify by proceeding to Task 5/6 UI which will exercise these calls directly. No automated test for this file (consistent with the rest of `supabase.js`, which has no test coverage today).

- [ ] **Step 3: Commit**

```bash
git add src/config/supabase.js
git commit -m "feat: add variants and promotions data access methods"
```

---

### Task 4: Wire pricing engine into the cart

**Files:**
- Modify: `src/context/CartContext.jsx`

**Interfaces:**
- Consumes: `computePricing` from `src/utils/pricingEngine.js` (Task 1), `api.getPromotions` from `src/config/supabase.js` (Task 3).
- Produces: `useCart()` keeps the same public shape (`cartItems, addToCart, updateQuantity, removeFromCart, clearCart, totalItems, rawSubtotal, discount, subtotal, isPromoApplied, appliedPromotions, toastMessage, setToastMessage`) so no consumer (`CartModal.jsx`, `ProductSelectModal.jsx`, `App.jsx`) needs to change its prop usage except where noted in Task 7/8. `promoPairs` is removed (it was 399-promo-specific) — Task 8 must not reference it.
- `addToCart(product, size, color, quantity, variant)` gains an optional 5th `variant` argument; when provided, the cart item stores `variantId: variant.id`, `variantName: variant.name`, and uses `variant.price` instead of `product.price`.

- [ ] **Step 1: Replace the promotion calculation block and `addToCart`**

In `src/context/CartContext.jsx`, add the import at the top (after line 1):

```js
import { computePricing } from '../utils/pricingEngine';
import { api } from '../config/supabase';
```

Replace the `addToCart` function (lines 25-60) with:

```js
  const addToCart = (product, size, color, quantity = 1, variant = null) => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const chosenSize = size || 'L';
    const chosenColor = color || (product.available_colors?.[0] || 'Deep Black');
    const variantId = variant?.id || null;
    const itemKey = `${product.id}_${variantId || 'base'}_${chosenSize}_${chosenColor}`;

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => item.key === itemKey);
      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.min(20, updated[existingIndex].quantity + qty)
        };
        return updated;
      } else {
        const newItem = {
          cartId: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          key: itemKey,
          productId: product.id,
          variantId,
          variantName: variant?.name || null,
          productName: variant?.name ? `${product.name} - ${variant.name}` : product.name,
          price: Number(variant?.price ?? product.price) || 219,
          size: chosenSize,
          color: chosenColor,
          quantity: qty,
          imageFrontUrl: variant?.images?.[0]?.image_url || product.image_front_url || '/assets/images/arch_shirt_front.jpg',
          imageBackUrl: product.image_back_url,
          deadline: product.order_deadline
        };
        return [...prevItems, newItem];
      }
    });

    showToast(`🛒 เพิ่ม ${variant?.name ? `${product.name} (${variant.name})` : product.name} (ไซส์ ${chosenSize}) ลงตะกร้าแล้ว`);
  };
```

Add promotion fetching state right after the `toastMessage` state (currently line 15):

```js
  const [promotions, setPromotions] = useState([]);

  useEffect(() => {
    api.getPromotions().then(setPromotions).catch(() => setPromotions([]));
  }, []);
```

Replace the whole "Calculate promotion" block (lines 87-115, from `// Calculate promotion: Buy 2 shirts for 399 THB` down to `const subtotal = isPromoApplied ? promoSubtotal : rawSubtotal;`) with:

```js
  const pricing = computePricing(cartItems, promotions);
  const { rawSubtotal, subtotal, discount, appliedPromotions } = pricing;
  const isPromoApplied = appliedPromotions.length > 0;
```

Update the context value (lines 117-136) to drop `promoPairs` and add `appliedPromotions`:

```js
  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalItems,
        rawSubtotal,
        discount,
        subtotal,
        isPromoApplied,
        appliedPromotions,
        toastMessage,
        setToastMessage
      }}
    >
      {children}
    </CartContext.Provider>
  );
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`, add an item to cart, confirm the cart total still shows a sane number (with no promotions seeded yet in the DB, it should just be full price — this is expected until Task 2's migration is run and at least one promotion row exists).

- [ ] **Step 3: Commit**

```bash
git add src/context/CartContext.jsx
git commit -m "feat: drive cart pricing from admin-configured promotions via pricingEngine"
```

---

### Task 5: Admin — variant manager

**Files:**
- Create: `src/components/admin/VariantManager.jsx`
- Modify: `src/views/AdminView.jsx`

**Interfaces:**
- Consumes: `api.getVariants`, `api.createVariant`, `api.updateVariant`, `api.deleteVariant`, `api.addVariantImage`, `api.deleteVariantImage`, `api.uploadProductImage` (existing, reused for variant photos) from `src/config/supabase.js`.
- Produces: `<VariantManager productId={product.id} />` — self-contained, manages its own state, no props flow back to `AdminView.jsx`.

- [ ] **Step 1: Create `src/components/admin/VariantManager.jsx`**

```jsx
import React, { useEffect, useState } from 'react';
import { api } from '../../config/supabase';
import { formatCurrency } from '../../utils/formatters';

export default function VariantManager({ productId }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', price: '', stock_limit: '' });
  const [uploadingId, setUploadingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await api.getVariants(productId);
    setVariants(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [productId]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.price) return;
    await api.createVariant({
      product_id: productId,
      name: form.name.trim(),
      price: Number(form.price),
      stock_limit: form.stock_limit ? Number(form.stock_limit) : null,
      sort_order: variants.length
    });
    setForm({ name: '', price: '', stock_limit: '' });
    load();
  };

  const handleToggleActive = async (variant) => {
    await api.updateVariant(variant.id, { is_active: !variant.is_active });
    load();
  };

  const handleDelete = async (variant) => {
    if (!window.confirm(`ลบตัวเลือก "${variant.name}"?`)) return;
    await api.deleteVariant(variant.id);
    load();
  };

  const handleImageUpload = async (variant, file) => {
    if (!file) return;
    setUploadingId(variant.id);
    try {
      const url = await api.uploadProductImage(file, 'variant');
      await api.addVariantImage(variant.id, url, variant.images?.length || 0);
      await load();
    } finally {
      setUploadingId(null);
    }
  };

  const handleImageDelete = async (imageId) => {
    await api.deleteVariantImage(imageId);
    load();
  };

  if (loading) return <div className="text-xs text-zinc-400 font-mono">กำลังโหลดตัวเลือกสินค้า...</div>;

  return (
    <div className="space-y-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
      <h5 className="font-bold text-xs text-zinc-800">ตัวเลือกสินค้า (Variants)</h5>

      {variants.map((v) => (
        <div key={v.id} className="p-3 bg-white rounded-lg border border-zinc-200 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-sm">{v.name}</span>
              <span className="ml-2 text-xs font-mono text-zinc-500">{formatCurrency(v.price)}</span>
              {v.stock_limit != null && (
                <span className="ml-2 text-[10px] font-mono text-zinc-400">สต๊อก: {v.stock_limit}</span>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleToggleActive(v)}
                className={`px-2 py-1 rounded text-[10px] font-bold ${v.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-600'}`}
              >
                {v.is_active ? 'เปิดขาย' : 'ปิดขาย'}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(v)}
                className="px-2 py-1 rounded text-[10px] font-bold bg-rose-50 text-rose-600"
              >
                ลบ
              </button>
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {(v.images || []).map((img) => (
              <div key={img.id} className="relative w-14 h-14">
                <img src={img.image_url} alt="" className="w-full h-full object-cover rounded border" />
                <button
                  type="button"
                  onClick={() => handleImageDelete(img.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] leading-4"
                >
                  ✕
                </button>
              </div>
            ))}
            <label className="w-14 h-14 border-2 border-dashed border-zinc-300 rounded flex items-center justify-center text-xs text-zinc-400 cursor-pointer">
              {uploadingId === v.id ? '...' : '+'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(v, e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
      ))}

      <div className="flex gap-2 pt-2 border-t border-zinc-200">
        <input
          type="text"
          placeholder="ชื่อตัวเลือก เช่น เสื้อผู้ชาย"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="flex-1 px-2 py-1.5 text-xs border border-zinc-300 rounded"
        />
        <input
          type="number"
          placeholder="ราคา"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="w-20 px-2 py-1.5 text-xs border border-zinc-300 rounded"
        />
        <input
          type="number"
          placeholder="สต๊อก"
          value={form.stock_limit}
          onChange={(e) => setForm({ ...form, stock_limit: e.target.value })}
          className="w-20 px-2 py-1.5 text-xs border border-zinc-300 rounded"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded"
        >
          + เพิ่ม
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `AdminView.jsx`'s product edit modal**

Read `src/views/AdminView.jsx` around the product edit modal (search for `isProductModalOpen` to find the modal's JSX body). Import the component at the top of the file:

```js
import VariantManager from '../components/admin/VariantManager';
```

Inside the product edit modal's form, immediately after the image upload fields and before the modal's save/cancel buttons, add:

```jsx
{editingProduct?.id && (
  <VariantManager productId={editingProduct.id} />
)}
```

(Guarded by `editingProduct?.id` because variants need an existing `product_id` to attach to — a brand-new, unsaved product has no id yet. If the admin wants variants on a new product, they save the product first, then reopen it to edit, exactly like the existing image-upload flow already requires an existing product for its Supabase Storage path.)

- [ ] **Step 3: Manually verify in the dev server**

Run: `npm run dev`, open admin, edit an existing product, add a variant with a name/price, upload an image to it, confirm it appears and can be toggled/deleted.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/VariantManager.jsx src/views/AdminView.jsx
git commit -m "feat: add admin variant manager UI"
```

---

### Task 6: Admin — promotions tab

**Files:**
- Create: `src/components/admin/PromotionManager.jsx`
- Modify: `src/views/AdminView.jsx`

**Interfaces:**
- Consumes: `api.getPromotions`, `api.createPromotion`, `api.updatePromotion`, `api.deletePromotion` (Task 3); needs the full variant list across all products to populate pickers — fetch via `Promise.all(products.map(p => api.getVariants(p.id)))` inside the component using the `products` array already loaded by `AdminView.jsx`.
- Produces: `<PromotionManager products={products} />`, rendered when `activeTab === 'promotions'`.

- [ ] **Step 1: Create `src/components/admin/PromotionManager.jsx`**

```jsx
import React, { useEffect, useState } from 'react';
import { api } from '../../config/supabase';

const emptyForm = {
  name: '', type: 'quantity_break', is_active: true, priority: 0,
  applies_to_all: true, quantity: 2, bundle_price: '',
  discount_type: 'fixed_amount', discount_value: '',
  scope_variant_ids: [], bundle_items: []
};

export default function PromotionManager({ products }) {
  const [promotions, setPromotions] = useState([]);
  const [allVariants, setAllVariants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const [promos, variantLists] = await Promise.all([
      api.getPromotions(),
      Promise.all(products.map((p) => api.getVariants(p.id)))
    ]);
    setPromotions(promos);
    setAllVariants(variantLists.flat().map((v, i) => ({ ...v, productName: products.find((p) => p.id === v.product_id)?.name })));
  };

  useEffect(() => { load(); }, [products]);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      type: form.type,
      is_active: form.is_active,
      priority: Number(form.priority) || 0,
      applies_to_all: form.type === 'quantity_break' ? form.applies_to_all : true,
      quantity: form.type === 'quantity_break' ? Number(form.quantity) : null,
      bundle_price: form.type === 'quantity_break' ? Number(form.bundle_price) : null,
      discount_type: form.type === 'bundle' ? form.discount_type : null,
      discount_value: form.type === 'bundle' ? Number(form.discount_value) : null,
      scope_variant_ids: form.type === 'quantity_break' && !form.applies_to_all ? form.scope_variant_ids : [],
      bundle_items: form.type === 'bundle' ? form.bundle_items : []
    };
    if (editingId) {
      await api.updatePromotion(editingId, payload);
    } else {
      await api.createPromotion(payload);
    }
    resetForm();
    load();
  };

  const handleEdit = (promo) => {
    setEditingId(promo.id);
    setForm({
      name: promo.name,
      type: promo.type,
      is_active: promo.is_active,
      priority: promo.priority,
      applies_to_all: promo.applies_to_all,
      quantity: promo.quantity || 2,
      bundle_price: promo.bundle_price || '',
      discount_type: promo.discount_type || 'fixed_amount',
      discount_value: promo.discount_value || '',
      scope_variant_ids: (promo.scope_variants || []).map((s) => s.variant_id).filter(Boolean),
      bundle_items: (promo.bundle_items || []).map((b) => ({ variant_id: b.variant_id, required_qty: b.required_qty }))
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('ลบโปรโมชั่นนี้?')) return;
    await api.deletePromotion(id);
    load();
  };

  const addBundleItem = () => {
    if (allVariants.length === 0) return;
    setForm({ ...form, bundle_items: [...form.bundle_items, { variant_id: allVariants[0].id, required_qty: 1 }] });
  };

  const updateBundleItem = (idx, field, value) => {
    const items = [...form.bundle_items];
    items[idx] = { ...items[idx], [field]: field === 'required_qty' ? Number(value) : value };
    setForm({ ...form, bundle_items: items });
  };

  const removeBundleItem = (idx) => {
    setForm({ ...form, bundle_items: form.bundle_items.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
        <h3 className="font-bold text-zinc-900">จัดการโปรโมชั่น (Promotions)</h3>
        <p className="text-xs text-zinc-500">กำหนดโปรซื้อครบราคาพิเศษ หรือโปรซื้อคู่สินค้าลดราคา</p>
      </div>

      <div className="space-y-2">
        {promotions.map((promo) => (
          <div key={promo.id} className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-sm">{promo.name}</span>
              <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 bg-zinc-100 rounded">
                {promo.type === 'quantity_break' ? 'ซื้อครบราคาพิเศษ' : 'ซื้อคู่ลดราคา'}
              </span>
              <span className={`ml-2 text-[10px] font-bold ${promo.is_active ? 'text-emerald-600' : 'text-zinc-400'}`}>
                {promo.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleEdit(promo)} className="px-2.5 py-1 bg-zinc-100 rounded text-xs font-bold">แก้ไข</button>
              <button type="button" onClick={() => handleDelete(promo.id)} className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded text-xs font-bold">ลบ</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-zinc-200 space-y-3">
        <h4 className="font-bold text-xs">{editingId ? 'แก้ไขโปรโมชั่น' : 'สร้างโปรโมชั่นใหม่'}</h4>

        <input
          type="text"
          placeholder="ชื่อโปรโมชั่น"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
        />

        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
        >
          <option value="quantity_break">ซื้อครบจำนวนราคาพิเศษ</option>
          <option value="bundle">ซื้อคู่สินค้าลดราคา</option>
        </select>

        {form.type === 'quantity_break' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="จำนวนชิ้น"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
              />
              <input
                type="number"
                placeholder="ราคารวม"
                value={form.bundle_price}
                onChange={(e) => setForm({ ...form, bundle_price: e.target.value })}
                className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.applies_to_all}
                onChange={(e) => setForm({ ...form, applies_to_all: e.target.checked })}
              />
              ใช้ได้กับสินค้าทุกชิ้นในร้าน
            </label>
            {!form.applies_to_all && (
              <select
                multiple
                value={form.scope_variant_ids}
                onChange={(e) => setForm({ ...form, scope_variant_ids: Array.from(e.target.selectedOptions, (o) => o.value) })}
                className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded h-24"
              >
                {allVariants.map((v) => (
                  <option key={v.id} value={v.id}>{v.productName} - {v.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {form.type === 'bundle' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
              >
                <option value="fixed_amount">ลดเป็นจำนวนบาท</option>
                <option value="fixed_price">ตั้งราคารวมคงที่</option>
              </select>
              <input
                type="number"
                placeholder="มูลค่า"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
              />
            </div>

            <div className="space-y-1.5">
              {form.bundle_items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={item.variant_id}
                    onChange={(e) => updateBundleItem(idx, 'variant_id', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-zinc-300 rounded"
                  >
                    {allVariants.map((v) => (
                      <option key={v.id} value={v.id}>{v.productName} - {v.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.required_qty}
                    onChange={(e) => updateBundleItem(idx, 'required_qty', e.target.value)}
                    className="w-14 px-2 py-1 text-xs border border-zinc-300 rounded"
                  />
                  <button type="button" onClick={() => removeBundleItem(idx)} className="text-rose-600 text-xs">✕</button>
                </div>
              ))}
              <button type="button" onClick={addBundleItem} className="text-xs font-bold text-zinc-700 underline">
                + เพิ่มสินค้าในชุดโปร
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={form.type === 'bundle' && form.bundle_items.length < 2}
            className="flex-1 py-2 bg-zinc-900 text-white text-xs font-bold rounded disabled:opacity-40"
          >
            {editingId ? 'บันทึกการแก้ไข' : 'สร้างโปรโมชั่น'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-zinc-100 text-xs font-bold rounded">ยกเลิก</button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the "promotions" tab to `AdminView.jsx`**

Import at the top:

```js
import PromotionManager from '../components/admin/PromotionManager';
```

Update the `activeTab` state comment (line 18) to include the new value:

```js
const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'products' | 'promotions' | 'sizing'
```

Add a tab button next to the existing `products` tab button (after the block ending around line 548, mirroring its structure):

```jsx
<button
  onClick={() => setActiveTab('promotions')}
  className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
    activeTab === 'promotions' ? 'border-zinc-900 text-zinc-900 bg-zinc-50 rounded-t-xl' : 'border-transparent text-zinc-500 hover:text-zinc-900'
  }`}
>
  โปรโมชั่น
</button>
```

Add the tab body right after the `activeTab === 'products'` block closes (after line 871, before the `{/* TAB 3: SIZING BREAKDOWN */}` comment):

```jsx
{activeTab === 'promotions' && (
  <PromotionManager products={products} />
)}
```

- [ ] **Step 3: Manually verify in the dev server**

Run: `npm run dev`, open admin → โปรโมชั่น tab, create a `quantity_break` promo (2, 399, applies to all), confirm it lists; create a `bundle` promo picking two variants, confirm the save button is disabled until 2+ items are added.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/PromotionManager.jsx src/views/AdminView.jsx
git commit -m "feat: add admin promotions tab for quantity-break and bundle rules"
```

---

### Task 7: Storefront — variant picker + gallery

**Files:**
- Create: `src/components/VariantPicker.jsx`
- Modify: `src/components/ProductSelectModal.jsx`

**Interfaces:**
- Produces: `<VariantPicker variants={variants} selected={selectedVariant} onSelect={setSelectedVariant} />` — pure presentational component, no data fetching (variants come from `api.getVariants(product.id)` called by the parent).
- `ProductSelectModal` now calls `addToCart(product, size, color, quantity, selectedVariant)` — matches the 5-arg signature from Task 4.

- [ ] **Step 1: Create `src/components/VariantPicker.jsx`**

```jsx
import React from 'react';
import { formatCurrency } from '../utils/formatters';

export default function VariantPicker({ variants, selected, onSelect }) {
  if (!variants || variants.length === 0) return null;

  return (
    <div>
      <label className="text-xs font-mono font-bold text-zinc-800 block mb-1.5">
        เลือกตัวเลือกสินค้า (Option):
      </label>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {variants.filter((v) => v.is_active).map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
              selected?.id === v.id
                ? 'border-black bg-zinc-900 text-white shadow-xs'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
            }`}
          >
            {v.name} · {formatCurrency(v.price)}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `ProductSelectModal.jsx`**

Replace line 1 (currently `import React, { useState } from 'react';`) with:

```js
import React, { useState, useEffect } from 'react';
```

Add after line 4 (`import { useCart } from '../context/CartContext';`):

```js
import { api } from '../config/supabase';
import VariantPicker from './VariantPicker';
```

Add variant state and fetch effect right after the existing `useState` declarations (after line 16, `const [showBack, setShowBack] = useState(false);`):

```js
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);

  useEffect(() => {
    if (!product?.id) return;
    api.getVariants(product.id).then((list) => {
      setVariants(list);
      setSelectedVariant(list.find((v) => v.is_active) || null);
    });
  }, [product?.id]);
```

Replace the pricing block (lines 24-29) to use the selected variant's price when present:

```js
  const unitPrice = Number(selectedVariant?.price ?? product.price) || 219;
```

(Leave the `promoPairs`/`totalPrice`/`savings` preview math as-is for now — Task 8 replaces this preview block with the shared pricing engine so the modal's "you save X" number matches whatever promotions are actually active, instead of the hardcoded 399 assumption.)

Replace the image box (lines 71-87) to show the selected variant's gallery when one exists, falling back to the product's own images:

```jsx
            <div className="sm:col-span-5 relative aspect-square bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200 shadow-xs">
              <img
                src={
                  selectedVariant?.images?.[0]?.image_url ||
                  (showBack && product.image_back_url ? product.image_back_url : (product.image_front_url || '/assets/images/arch_shirt_front.jpg'))
                }
                alt={product.name}
                className="w-full h-full object-cover transition-opacity duration-300"
                onError={(e) => { e.target.src = '/assets/images/arch_shirt_front.jpg'; }}
              />
              {!selectedVariant && product.image_back_url && (
                <button
                  type="button"
                  onClick={() => setShowBack(!showBack)}
                  className="absolute bottom-2.5 right-2.5 px-2.5 py-1 bg-black/80 hover:bg-black text-white text-[11px] font-mono rounded-lg shadow-xs active:scale-95 transition-all"
                >
                  {showBack ? (t.viewFront || 'ดูด้านหน้า') : (t.viewBack || 'ดูด้านหลัง')}
                </button>
              )}
            </div>
```

Add the variant picker to the "Selection Options" block, right before the "1. Size" block (before line 122):

```jsx
            {variants.length > 0 && (
              <VariantPicker variants={variants} selected={selectedVariant} onSelect={setSelectedVariant} />
            )}
```

Update `sizes`/`colors` derivation (lines 10-11) to prefer the selected variant's own options:

```js
  const sizes = Array.isArray(selectedVariant?.available_sizes)
    ? selectedVariant.available_sizes
    : (Array.isArray(product?.available_sizes) ? product.available_sizes : ['S', 'M', 'L', 'XL', '2XL']);
  const colors = Array.isArray(selectedVariant?.available_colors)
    ? selectedVariant.available_colors
    : (Array.isArray(product?.available_colors) ? product.available_colors : ['Deep Black']);
```

Note this now depends on `selectedVariant`, which is declared later in the component — move this `sizes`/`colors` block (and the `size`/`color` `useState` calls that follow it) to after the `selectedVariant` state declaration to avoid a temporal-dead-zone reference error.

Update both `handleAddToCart` and `handleBuyNow` (lines 31-42) to pass the variant:

```js
  const handleAddToCart = () => {
    if (isClosed) return;
    addToCart(product, size, color, quantity, selectedVariant);
    onClose();
  };

  const handleBuyNow = () => {
    if (isClosed) return;
    addToCart(product, size, color, quantity, selectedVariant);
    onClose();
    if (onOpenCart) onOpenCart();
  };
```

- [ ] **Step 3: Manually verify in the dev server**

Run: `npm run dev`, open a product that has variants configured (from Task 5), confirm the variant picker appears, switching variants updates price/image/sizes, and "Add to Cart" records the right variant (check via `localStorage.archshop_cart_items` in devtools or the cart modal).

- [ ] **Step 4: Commit**

```bash
git add src/components/VariantPicker.jsx src/components/ProductSelectModal.jsx
git commit -m "feat: add variant picker to product select modal"
```

---

### Task 8: Dynamic promotion badges (remove hardcoded "2 for 399" copy)

**Files:**
- Modify: `src/context/CartContext.jsx` (expose raw `promotions` list, not just `appliedPromotions`)
- Modify: `src/utils/formatters.js`
- Modify: `src/components/HeroBanner.jsx`
- Modify: `src/components/CartModal.jsx`
- Modify: `src/components/ProductSelectModal.jsx`

**Interfaces:**
- Consumes: `useCart().promotions` (all active promotions, for the hero banner and the pre-cart price preview) and `useCart().appliedPromotions` (Task 4, for what actually applied to the current cart).
- `HeroBanner`, `CartModal`, and `ProductSelectModal` currently already have no `t.promoTag`/`t.promoAppliedBanner`/`t.promoHintBanner`/`t.promoDiscountLabel` fallback text usages except the two remaining instances listed in Step 3 below — `HeroBanner.jsx`'s own badge was already removed in an earlier session.

- [ ] **Step 1: Expose the raw promotions list from `CartContext.jsx`**

In the context value object updated by Task 4 (Step 1's final block), add `promotions` alongside `appliedPromotions`:

```js
        appliedPromotions,
        promotions,
```

- [ ] **Step 2: Add a label helper to `src/utils/formatters.js`**

Read the file first to match its existing export style, then add:

```js
export function describePromotion(promo) {
  if (!promo) return '';
  if (promo.type === 'quantity_break') {
    return `⚡ ซื้อ ${promo.quantity} ตัว เหลือเพียง ${promo.bundle_price}.-`;
  }
  return `⚡ ${promo.name}`;
}
```

- [ ] **Step 3: Add a badge to `HeroBanner.jsx`**

`HeroBanner.jsx` already imports `useState`/`useEffect` (line 1) but not `useCart` or `describePromotion`. Add after the existing imports (after line 4):

```js
import { useCart } from '../context/CartContext';
import { describePromotion } from '../utils/formatters';
```

Inside the `HeroBanner` component, before its `return`, add:

```js
  const { promotions } = useCart();
  const activePromo = promotions.find((p) => p.is_active) || null;
```

In the JSX, inside the `<div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">` block (the row that currently holds only the "OFFICIAL MERCH" chip, since the promo chip that used to sit next to it was removed earlier), add a second chip:

```jsx
            {activePromo && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 rounded-md text-xs font-mono font-black shadow-sm animate-pulse">
                <span>{describePromotion(activePromo)}</span>
              </div>
            )}
```

- [ ] **Step 4: Fix `CartModal.jsx`'s remaining hardcoded promo text**

`CartModal.jsx` destructures `promoPairs` from `useCart()` at line 19 — Task 4 removes `promoPairs` from the context, so this must change. Replace the destructuring (line 19) with `appliedPromotions,` and update its two usages:

Line 219 (`{t.promoAppliedBanner || 'ได้รับโปรโมชั่นพิเศษ: ซื้อ 2 ตัว 399.-'}`) becomes:

```jsx
<div className="truncate">🎉 ได้รับโปรโมชั่นพิเศษ: {appliedPromotions.map((p) => p.name).join(', ')}</div>
```

Line 220-222 (the `({promoPairs} คู่ • ...)` block) becomes:

```jsx
<div className="text-[11px] text-zinc-600 font-mono font-normal">
  ({t.saveAmountLabel || 'ประหยัดไป'} <strong className="text-emerald-700 font-bold font-mono">{formatCurrency(discount)}</strong>)
</div>
```

Line 225-227 (the hardcoded `2 FOR 399.-` chip) becomes:

```jsx
<span className="px-2.5 py-1 bg-amber-500 text-zinc-950 text-[10.5px] font-mono font-black rounded-lg shrink-0 shadow-xs">
  {appliedPromotions[0] ? describePromotion(appliedPromotions[0]) : ''}
</span>
```

Line 233 (`{t.promoHintBanner || 'ซื้อเพิ่มอีก 1 ตัว...'}`) becomes a generic nudge (no longer assumes "2 for 399" specifically):

```jsx
<span className="font-medium text-[11.5px]">💡 เพิ่มสินค้าในตะกร้าเพื่อรับสิทธิ์โปรโมชั่น</span>
```

Line 576 (`{t.promoDiscountLabel || 'ส่วนลดโปรโมชั่น (2 ตัว 399.-):'}`) becomes:

```jsx
<span>ส่วนลดโปรโมชั่น ({appliedPromotions.map((p) => p.name).join(', ')}):</span>
```

Add `import { describePromotion } from '../utils/formatters';` to `CartModal.jsx`'s existing `formatters` import (line 3, which already imports `formatCurrency, getPromptPayQRUrl` — extend that same import line).

- [ ] **Step 5: Fix `ProductSelectModal.jsx`'s hardcoded preview math**

`ProductSelectModal.jsx`'s pricing preview (lines 24-29 in the original file, already touched by Task 7 Step 2 which changed `unitPrice`) still computes `promoPairs`/`totalPrice`/`savings` from the hardcoded `399`. Replace that block with:

```js
  const { addToCart, promotions } = useCart();
```

(replacing the current `const { addToCart } = useCart();` on line 8), and replace the `promoPairs`/`remainingSingles`/`totalPrice`/`regularPrice`/`savings` lines with:

```js
  const preview = computePricing([{ price: unitPrice, quantity }], promotions);
  const totalPrice = preview.subtotal;
  const regularPrice = preview.rawSubtotal;
  const savings = preview.discount;
```

Add `import { computePricing } from '../utils/pricingEngine';` to the top imports.

Update the savings/hint JSX (the block referencing `t.promoTag`/`t.promoHintBanner` in the "Subtotal Preview" section) to use `preview.appliedPromotions` instead of static text:

```jsx
            {savings > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-[11px] text-emerald-400 font-bold">
                <span>🎉 {preview.appliedPromotions.map((p) => p.name).join(', ')}</span>
                <span>{t.saveAmountLabel || 'ประหยัดไป'} {formatCurrency(savings)}</span>
              </div>
            )}
```

The `quantity === 1` hint block (previously suggesting "buy 1 more for 399") is no longer universally true with configurable promotions — remove that conditional block entirely.

- [ ] **Step 6: Manually verify in the dev server**

Run: `npm run dev`. With at least one active `quantity_break` promotion seeded (from Task 6's UI), confirm: hero banner badge shows the live promo text, product modal preview shows correct savings using the real promotion name, cart modal shows the promo name instead of hardcoded "399" text. With zero active promotions, confirm no badge renders and nothing crashes (all guards check `.length`/truthiness first).

- [ ] **Step 7: Commit**

```bash
git add src/context/CartContext.jsx src/components/HeroBanner.jsx src/components/CartModal.jsx src/components/ProductSelectModal.jsx src/utils/formatters.js
git commit -m "feat: derive promotion badges from live admin-configured promotions"
```

---

### Task 9: Record purchased variant on orders

**Files:**
- Modify: `src/config/supabase.js`
- Modify: `src/components/OrderModal.jsx`

**Interfaces:**
- Consumes: `cartItems[].variantId` (Task 4's cart item shape).
- Produces: `orders.product_variant_id` gets populated on `api.submitOrder`.

- [ ] **Step 1: Allow `product_variant_id` through `submitOrder` in `src/config/supabase.js`**

In the `cleanOrder` object inside `submitOrder` (lines 172-189), add:

```js
      product_variant_id: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(orderData.product_variant_id || '')) ? orderData.product_variant_id : null,
```

Also add `'product_variant_id'` to the `allowedCols` array inside `updateOrder` (lines 294-299).

- [ ] **Step 2: Pass `variantId` through in `OrderModal.jsx`**

Read `src/components/OrderModal.jsx` to find where it builds the payload for `api.submitOrder` (search for `product_id:` in that file) — each cart item there already maps to one order row; add `product_variant_id: item.variantId || null` alongside the existing `product_id: item.productId` in that same object literal.

- [ ] **Step 3: Manually verify in the dev server**

Run: `npm run dev`, add a variant item to cart, complete checkout, then in admin → orders confirm the new order's `product_variant_id` is set (visible via Supabase table editor, since the admin orders UI doesn't need to display it for this task to be considered done).

- [ ] **Step 4: Commit**

```bash
git add src/config/supabase.js src/components/OrderModal.jsx
git commit -m "feat: record purchased variant on submitted orders"
```

---

## Final check

- [ ] Run `npm test` — all pricing engine tests pass.
- [ ] Run `npm run build` — confirms no build-breaking syntax errors across all modified files.
- [ ] Remind the user: `supabase/migrations/0002_variants_and_promotions.sql` still needs to be run manually in their Supabase project before any of the variant/promotion features work end-to-end.
