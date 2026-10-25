import { describe, it, expect } from 'vitest';
import {
  refKey, cleanRefs, toggleRef, scopeRefsFromPayload, scopeRowsFromRefs,
  slotsFromBundleRows, bundleItemsFromSlots
} from './promotionRefs';

describe('promotionRefs', () => {
  it('keys and dedupes variant and product refs', () => {
    expect(refKey({ variant_id: 'v1' })).toBe('v:v1');
    expect(refKey({ product_id: 'p1' })).toBe('p:p1');
    expect(refKey({})).toBeNull();
    expect(cleanRefs([
      { variant_id: 'v1', product_id: null, promotion_id: 'x' },
      { variant_id: 'v1' },
      { product_id: 'p1', variant_id: null },
      { variant_id: null, product_id: null }
    ])).toEqual([{ variant_id: 'v1' }, { product_id: 'p1' }]);
  });

  it('toggles a ref on and off', () => {
    const on = toggleRef([], { product_id: 'p1' });
    expect(on).toEqual([{ product_id: 'p1' }]);
    expect(toggleRef(on, { product_id: 'p1' })).toEqual([]);
  });

  it('reads scope refs from new and legacy payloads', () => {
    expect(scopeRefsFromPayload({ scope_refs: [{ product_id: 'p1' }, { variant_id: 'v1' }] }))
      .toEqual([{ product_id: 'p1' }, { variant_id: 'v1' }]);
    expect(scopeRefsFromPayload({ scope_variant_ids: ['v1', 'v2'] }))
      .toEqual([{ variant_id: 'v1' }, { variant_id: 'v2' }]);
    expect(scopeRefsFromPayload({})).toBeNull();
  });

  it('builds scope rows with exactly one of variant_id / product_id', () => {
    expect(scopeRowsFromRefs('promo', [{ product_id: 'p1' }, { variant_id: 'v1' }])).toEqual([
      { promotion_id: 'promo', variant_id: null, product_id: 'p1' },
      { promotion_id: 'promo', variant_id: 'v1', product_id: null }
    ]);
  });

  it('round-trips bundle slots through DB rows, including legacy variant-only rows', () => {
    const rows = [
      { variant_id: 'vA1', product_id: null, slot: 0, required_qty: 1 },
      { variant_id: null, product_id: 'pA', slot: 0, required_qty: 1 },
      { variant_id: 'vB', slot: 1, required_qty: 2 },
      { variant_id: 'vC', required_qty: 1 } // legacy row without slot
    ];
    const slots = slotsFromBundleRows(rows);
    expect(slots).toEqual([
      { refs: [{ variant_id: 'vA1' }, { product_id: 'pA' }], required_qty: 1 },
      { refs: [{ variant_id: 'vB' }], required_qty: 2 },
      { refs: [{ variant_id: 'vC' }], required_qty: 1 }
    ]);
    expect(bundleItemsFromSlots(slots)).toEqual([
      { variant_id: 'vA1', product_id: null, slot: 0, required_qty: 1 },
      { variant_id: null, product_id: 'pA', slot: 0, required_qty: 1 },
      { variant_id: 'vB', product_id: null, slot: 1, required_qty: 2 },
      { variant_id: 'vC', product_id: null, slot: 2, required_qty: 1 }
    ]);
  });
});
