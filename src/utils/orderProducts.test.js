import { describe, it, expect } from 'vitest';
import { getOrderProductKeys, listOrphanProducts, matchesProductFilter } from './orderProducts';

const products = [
  { id: 'sash', name: 'ผ้าคาด' },
  { id: 'doi', name: 'ชุดขึ้นดอย' },
  { id: 'shirt', name: 'เสื้อ' },
  { id: 'shirt-ltd', name: 'เสื้อ Limited' }
];

// Cart order: one row, product_id = first cart item, the rest only in notes
const sashAndDoi = {
  product_id: 'sash',
  notes: '[ผ้าคาด [F/แดง] x1 | ชุดขึ้นดอย - หญิง [M/ขาว] x1] ฝากรับแทน'
};
const sashOnly = { product_id: 'sash', notes: '[ผ้าคาด [F/แดง] x2]' };
const doiOnly = { product_id: 'doi', notes: null };

describe('getOrderProductKeys', () => {
  it('includes products that are not the first cart item', () => {
    expect(getOrderProductKeys(sashAndDoi, products).sort()).toEqual(['doi', 'sash']);
  });

  it('falls back to product_id when notes has no item summary', () => {
    expect(getOrderProductKeys(doiOnly, products)).toEqual(['doi']);
    expect(getOrderProductKeys({ product_id: 'doi', notes: 'โทรก่อนส่ง' }, products)).toEqual(['doi']);
  });

  it('picks the longest product name when one name is a prefix of another', () => {
    const o = { product_id: null, notes: '[เสื้อ Limited - ดำ [L/ดำ] x1]' };
    expect(getOrderProductKeys(o, products)).toEqual(['shirt-ltd']);
  });

  it('ignores customer notes that mention a product name', () => {
    const o = { product_id: 'sash', notes: '[ผ้าคาด [F/แดง] x1] อยากได้ ชุดขึ้นดอย ด้วย' };
    expect(getOrderProductKeys(o, products)).toEqual(['sash']);
  });

  it('handles product names that contain brackets', () => {
    const prods = [...products, { id: 'ltd', name: 'เสื้อ [Limited]' }];
    const o = { product_id: 'sash', notes: '[ผ้าคาด [F/แดง] x1 | เสื้อ [Limited] - ดำ [L/ดำ] x1]' };
    expect(getOrderProductKeys(o, prods).sort()).toEqual(['ltd', 'sash']);
  });

  it('stays fast on hostile notes', () => {
    const hostile = ['[' + ' | a'.repeat(200000), '[' + 'a [b] '.repeat(200000), '[' + ' ['.repeat(200000)];
    const t0 = performance.now();
    for (const notes of hostile) getOrderProductKeys({ product_id: 'sash', notes }, products);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('keeps a deleted product filterable by its saved name', () => {
    // Deleting a product nulls orders.product_id; only the name in notes survives
    const o = { product_id: null, notes: '[เสื้อรุ่นเก่า - ดำ [L/ดำ] x1 | ผ้าคาด [F/แดง] x1]' };
    expect(getOrderProductKeys(o, products).sort()).toEqual(['name:เสื้อรุ่นเก่า', 'sash']);
  });

  it('does not double count the first item when its product was renamed', () => {
    const o = { product_id: 'sash', notes: '[ผ้าคาดชื่อเดิม [F/แดง] x1 | ชุดขึ้นดอย [M/ขาว] x1]' };
    expect(getOrderProductKeys(o, products).sort()).toEqual(['doi', 'sash']);
  });

  it('picks up a newly added product without any other change', () => {
    const withNew = [...products, { id: 'new', name: 'หมวกรุ่นใหม่' }];
    const o = { product_id: 'sash', notes: '[ผ้าคาด [F/แดง] x1 | หมวกรุ่นใหม่ [F/ดำ] x1]' };
    expect(getOrderProductKeys(o, withNew).sort()).toEqual(['new', 'sash']);
  });
});

describe('listOrphanProducts', () => {
  it('lists each missing product once, grouping its variants', () => {
    const orders = [
      { product_id: null, notes: '[เสื้อรุ่นเก่า - ดำ [L/ดำ] x1]' },
      { product_id: 'sash', notes: '[ผ้าคาด [F/แดง] x1 | เสื้อรุ่นเก่า - ขาว [M/ขาว] x2]' },
      sashOnly
    ];
    expect(listOrphanProducts(orders, products)).toEqual([{ id: 'name:เสื้อรุ่นเก่า', name: 'เสื้อรุ่นเก่า' }]);
  });
});

describe('matchesProductFilter', () => {
  const ids = (o) => getOrderProductKeys(o, products);

  it('matches everything when nothing is selected', () => {
    expect(matchesProductFilter(ids(sashOnly), [], 'only')).toBe(true);
  });

  it('any: order contains at least one selected product', () => {
    expect(matchesProductFilter(ids(sashAndDoi), ['doi'], 'any')).toBe(true);
    expect(matchesProductFilter(ids(sashOnly), ['doi'], 'any')).toBe(false);
    expect(matchesProductFilter(ids(sashOnly), ['doi', 'sash'], 'any')).toBe(true);
  });

  it('all: order contains every selected product', () => {
    expect(matchesProductFilter(ids(sashAndDoi), ['sash', 'doi'], 'all')).toBe(true);
    expect(matchesProductFilter(ids(sashOnly), ['sash', 'doi'], 'all')).toBe(false);
  });

  it('only: order contains exactly the selected products and nothing else', () => {
    expect(matchesProductFilter(ids(sashOnly), ['sash'], 'only')).toBe(true);
    expect(matchesProductFilter(ids(sashAndDoi), ['sash'], 'only')).toBe(false);
    expect(matchesProductFilter(ids(sashAndDoi), ['sash', 'doi'], 'only')).toBe(true);
    expect(matchesProductFilter(ids(sashOnly), ['sash', 'doi'], 'only')).toBe(false);
  });
});
