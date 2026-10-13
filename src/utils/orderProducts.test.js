import { describe, it, expect } from 'vitest';
import { getOrderProductIds, matchesProductFilter } from './orderProducts';

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

describe('getOrderProductIds', () => {
  it('includes products that are not the first cart item', () => {
    expect(getOrderProductIds(sashAndDoi, products).sort()).toEqual(['doi', 'sash']);
  });

  it('falls back to product_id when notes has no item summary', () => {
    expect(getOrderProductIds(doiOnly, products)).toEqual(['doi']);
    expect(getOrderProductIds({ product_id: 'doi', notes: 'โทรก่อนส่ง' }, products)).toEqual(['doi']);
  });

  it('picks the longest product name when one name is a prefix of another', () => {
    const o = { product_id: null, notes: '[เสื้อ Limited - ดำ [L/ดำ] x1]' };
    expect(getOrderProductIds(o, products)).toEqual(['shirt-ltd']);
  });

  it('ignores customer notes that mention a product name', () => {
    const o = { product_id: 'sash', notes: '[ผ้าคาด [F/แดง] x1] อยากได้ ชุดขึ้นดอย ด้วย' };
    expect(getOrderProductIds(o, products)).toEqual(['sash']);
  });

  it('handles product names that contain brackets', () => {
    const prods = [...products, { id: 'ltd', name: 'เสื้อ [Limited]' }];
    const o = { product_id: 'sash', notes: '[ผ้าคาด [F/แดง] x1 | เสื้อ [Limited] - ดำ [L/ดำ] x1]' };
    expect(getOrderProductIds(o, prods).sort()).toEqual(['ltd', 'sash']);
  });

  it('stays fast on hostile notes', () => {
    const hostile = ['[' + ' | a'.repeat(200000), '[' + 'a [b] '.repeat(200000), '[' + ' ['.repeat(200000)];
    const t0 = performance.now();
    for (const notes of hostile) getOrderProductIds({ product_id: 'sash', notes }, products);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe('matchesProductFilter', () => {
  const ids = (o) => getOrderProductIds(o, products);

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
