import { describe, it, expect } from 'vitest';
import { expectedOrderTotal, checkOrderTotal, orderTotalBadge, priceOrder } from './orderPricing';

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const V1 = 'aaaaaaaa-1111-4111-8111-111111111111';

const products = [{ id: P1, price: 299 }, { id: P2, price: 219 }];
const variants = [{ id: V1, product_id: P1, price: 350 }];
const promotions = [
  { id: 'q', type: 'quantity_break', is_active: true, applies_to_all: false, quantity: 2, bundle_price: 400, scope_variants: [{ product_id: P2 }] }
];
const catalog = { products, variants, promotions, shippingFee: 50 };

const line = (over) => ({ product_id: P1, variant_id: null, product_name: 'x', size: 'M', color: 'Black', quantity: 1, unit_price: 1, ...over });

describe('expectedOrderTotal', () => {
  it('prices lines with current product / variant prices and promotions, plus shipping', () => {
    const order = {
      delivery_method: 'shipping',
      order_items: [line({ quantity: 2 }), line({ variant_id: V1 }), line({ product_id: P2, quantity: 2 })]
    };
    // 2×299 + 350 + promo(2×219 → 400) + 50
    expect(expectedOrderTotal(order, catalog)).toBe(598 + 350 + 400 + 50);
  });

  it('ignores the customer-written unit_price', () => {
    expect(expectedOrderTotal({ order_items: [line({ unit_price: 0.01 })] }, catalog)).toBe(299);
  });

  it('returns null for unknown products / variants', () => {
    expect(expectedOrderTotal({ order_items: [line({ product_id: 'gone' })] }, catalog)).toBeNull();
    expect(expectedOrderTotal({ order_items: [line({ variant_id: 'gone' })] }, catalog)).toBeNull();
  });
});

describe('priceOrder: legacy orders (no order_items)', () => {
  const legacy = (over) => ({ order_items: null, product_id: P1, product_variant_id: null, quantity: 2, notes: '[Jersey [M/Black] x2]', ...over });
  it('prices a single-item legacy order from product_id x quantity', () => {
    expect(priceOrder(legacy(), catalog)).toEqual({ ok: true, expected: 598 });
    expect(priceOrder(legacy({ order_items: [] }), catalog)).toEqual({ ok: true, expected: 598 });
    expect(priceOrder(legacy({ notes: 'old form, no summary' }), catalog)).toEqual({ ok: true, expected: 598 });
    expect(priceOrder(legacy({ notes: null, quantity: 1 }), catalog)).toEqual({ ok: true, expected: 299 });
  });
  it('uses product_variant_id when set (also without product_id) and applies promotions', () => {
    expect(priceOrder(legacy({ product_variant_id: V1, quantity: 1 }), catalog)).toEqual({ ok: true, expected: 350 });
    expect(priceOrder(legacy({ product_id: null, product_variant_id: V1, quantity: 1 }), catalog)).toEqual({ ok: true, expected: 350 });
    expect(priceOrder(legacy({ product_id: P2, notes: null }), catalog)).toEqual({ ok: true, expected: 400 });
  });
  it('is unverifiable for multi-item, unreadable-summary, product-less or unknown legacy orders', () => {
    expect(priceOrder(legacy({ notes: '[Jersey [M/Black] x1 | Tee [L/White] x1]' }), catalog)).toEqual({ ok: false, reason: 'legacy_multi_item' });
    expect(priceOrder(legacy({ notes: '[Jersey [M/Black] x1 | Tee [L/Wh' }), catalog)).toEqual({ ok: false, reason: 'legacy_multi_item' });
    expect(priceOrder(legacy({ product_id: null }), catalog)).toEqual({ ok: false, reason: 'legacy_no_product' });
    expect(priceOrder(legacy({ product_id: 'gone' }), catalog)).toEqual({ ok: false, reason: 'unknown_product' });
    expect(priceOrder(legacy({ product_variant_id: 'gone' }), catalog)).toEqual({ ok: false, reason: 'unknown_variant' });
    expect(priceOrder(legacy({ quantity: 0 }), catalog)).toEqual({ ok: false, reason: 'legacy_bad_quantity' });
    expect(priceOrder(legacy({ quantity: 'x' }), catalog)).toEqual({ ok: false, reason: 'legacy_bad_quantity' });
    expect(priceOrder({}, catalog)).toEqual({ ok: false, reason: 'legacy_no_product' });
  });
});

describe('priceOrder: fails closed on bad order_items', () => {
  it('rejects lines sanitizeOrderItems would silently drop or clamp', () => {
    const bad = (order_items) => priceOrder({ order_items }, catalog);
    expect(bad('[{"quantity":1}]')).toEqual({ ok: false, reason: 'unreadable_items' }); // JSON text, not an array
    expect(bad({ quantity: 1 })).toEqual({ ok: false, reason: 'unreadable_items' });
    expect(bad([line(), 5])).toEqual({ ok: false, reason: 'unreadable_items' });
    expect(bad([line({ quantity: 0 })])).toEqual({ ok: false, reason: 'unreadable_items' });
    expect(bad([line({ quantity: 99 })])).toEqual({ ok: false, reason: 'unreadable_items' });
    expect(bad([line({ quantity: '2abc' })])).toEqual({ ok: false, reason: 'unreadable_items' });
    expect(bad(Array.from({ length: 51 }, () => line()))).toEqual({ ok: false, reason: 'unreadable_items' });
    expect(bad([line({ product_id: null })])).toEqual({ ok: false, reason: 'unknown_product' });
    expect(bad([line({ product_id: P2, variant_id: V1 })])).toEqual({ ok: false, reason: 'unknown_variant' }); // variant of another product
  });
  it('accepts a numeric-string quantity like the database does', () => {
    expect(priceOrder({ order_items: [line({ quantity: '2' })] }, catalog)).toEqual({ ok: true, expected: 598 });
  });
  it('is unverifiable while the catalog is loading, or when the price is missing', () => {
    expect(priceOrder({ order_items: [line()] }, { ...catalog, ready: false })).toEqual({ ok: false, reason: 'catalog_loading' });
    expect(priceOrder({ order_items: [line()] }, { ...catalog, products: [{ id: P1, price: 0 }] })).toEqual({ ok: false, reason: 'no_price' });
  });
});

describe('checkOrderTotal', () => {
  const order = (total_price) => ({ total_price, delivery_method: 'pickup', order_items: [line({ quantity: 2 })] });
  it('flags totals below the expected amount (with tolerance)', () => {
    expect(checkOrderTotal(order(1), catalog)).toEqual({ status: 'underpaid', expected: 598 });
    expect(checkOrderTotal(order('abc'), catalog)).toEqual({ status: 'underpaid', expected: 598 });
    expect(checkOrderTotal(order(597.5), catalog)).toEqual({ status: 'ok', expected: 598 });
    expect(checkOrderTotal(order(598), catalog)).toEqual({ status: 'ok', expected: 598 });
    expect(checkOrderTotal(order(700), catalog)).toEqual({ status: 'ok', expected: 598 }); // overpaying is not flagged
  });
  it('reports orders it cannot price as unverifiable instead of fine', () => {
    expect(checkOrderTotal({ total_price: 1, order_items: [line({ product_id: 'forged' })] }, catalog))
      .toEqual({ status: 'unverifiable', expected: null, reason: 'unknown_product' });
  });
  it('checks single-item legacy orders too', () => {
    expect(checkOrderTotal({ total_price: 1, product_id: P1, quantity: 1, order_items: null }, catalog))
      .toEqual({ status: 'underpaid', expected: 299 });
  });
});

describe('orderTotalBadge', () => {
  const forged = (payment_status) => ({ payment_status, total_price: 1, order_items: [line({ product_id: 'forged' })] });
  const cheap = (payment_status) => ({ payment_status, total_price: 1, order_items: [line()] });
  it('shows "cannot verify" only for pending orders', () => {
    const b = orderTotalBadge(forged('pending'), catalog);
    expect(b.status).toBe('unverifiable');
    expect(b.reason).toBe('unknown_product');
    expect(b.message).toMatch(/ไม่มีในระบบ/);
    expect(orderTotalBadge(forged('confirmed'), catalog)).toBeNull();
    expect(orderTotalBadge(forged('rejected'), catalog)).toBeNull();
  });
  it('shows underpayment for every status, nothing for correct totals', () => {
    for (const st of ['pending', 'confirmed', 'rejected']) {
      expect(orderTotalBadge(cheap(st), catalog)).toEqual({ status: 'underpaid', expected: 299 });
    }
    expect(orderTotalBadge({ ...cheap('pending'), total_price: 299 }, catalog)).toBeNull();
  });
});
