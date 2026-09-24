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

  it('lets one bundle slot accept several alternative variants', () => {
    const cartItems = [
      { productId: 'pA', variantId: 'vA2', price: 300, quantity: 1 },
      { productId: 'pB', variantId: 'vB', price: 300, quantity: 1 }
    ];
    const promotions = [{
      id: 'promo3', name: 'A(any)+B', type: 'bundle', is_active: true, priority: 0,
      discount_type: 'fixed_amount', discount_value: 40,
      bundle_items: [
        { variant_id: 'vA1', slot: 0, required_qty: 1 },
        { variant_id: 'vA2', slot: 0, required_qty: 1 },
        { variant_id: 'vB', slot: 1, required_qty: 1 }
      ]
    }];
    const result = computePricing(cartItems, promotions);
    expect(result.subtotal).toBe(560);
    expect(result.appliedPromotions).toHaveLength(1);
  });

  it('finds every bundle set when slots overlap (no greedy mis-assignment)', () => {
    const cartItems = [
      { productId: 'pB', variantId: 'vF', price: 760, quantity: 1 },
      { productId: 'pA', variantId: 'vUp', price: 730, quantity: 2 },
      { productId: 'pB', variantId: 'vM', price: 730, quantity: 1 }
    ];
    const promotions = [{
      id: 'promo4', name: 'ขึ้นดอย+ศิลป์จุ่ม', type: 'bundle', is_active: true, priority: 0,
      discount_type: 'fixed_amount', discount_value: 70,
      bundle_items: [
        { variant_id: 'vM', slot: 0, required_qty: 1 },
        { variant_id: 'vUp', slot: 0, required_qty: 1 },
        { variant_id: 'vF', slot: 1, required_qty: 1 },
        { variant_id: 'vUp', slot: 1, required_qty: 1 }
      ]
    }];
    const result = computePricing(cartItems, promotions);
    expect(result.appliedPromotions).toHaveLength(2);
    expect(result.discount).toBe(140);
  });
});
