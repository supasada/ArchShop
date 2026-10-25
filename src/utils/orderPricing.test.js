import { describe, it, expect } from 'vitest';
import { expectedOrderTotal, findUnderpayment } from './orderPricing';

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

  it('returns null for legacy orders and unknown products / variants', () => {
    expect(expectedOrderTotal({ order_items: null }, catalog)).toBeNull();
    expect(expectedOrderTotal({}, catalog)).toBeNull();
    expect(expectedOrderTotal({ order_items: [line({ product_id: 'gone' })] }, catalog)).toBeNull();
    expect(expectedOrderTotal({ order_items: [line({ variant_id: 'gone' })] }, catalog)).toBeNull();
  });
});

describe('findUnderpayment', () => {
  const order = (total_price) => ({ total_price, delivery_method: 'pickup', order_items: [line({ quantity: 2 })] });
  it('flags totals below the expected amount (with tolerance)', () => {
    expect(findUnderpayment(order(1), catalog)).toEqual({ expected: 598 });
    expect(findUnderpayment(order(597.5), catalog)).toBeNull();
    expect(findUnderpayment(order(598), catalog)).toBeNull();
    expect(findUnderpayment(order(700), catalog)).toBeNull(); // overpaying is not flagged
  });
  it('skips orders it cannot price', () => {
    expect(findUnderpayment({ total_price: 1, order_items: null }, catalog)).toBeNull();
  });
});
