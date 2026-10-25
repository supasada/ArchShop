import { describe, it, expect } from 'vitest';
import {
  applyOrderChange, joinedProduct, ORDER_SELECT, ORDER_FALLBACK_SELECT, ORDER_COLUMNS
} from './orderRealtime';

const products = [
  { id: 'p1', name: 'Shirt', image_front_url: 'f1.jpg', description: 'long text', price: 219 },
  { id: 'p2', name: 'Jersey', image_front_url: null, price: 350 }
];
const o = (id, created_at, extra = {}) => ({ id, created_at, product_id: 'p1', products: { id: 'p1', name: 'Shirt', image_front_url: 'f1.jpg' }, payment_status: 'pending', ...extra });
const list = [o('c', '2026-10-03T00:00:00Z'), o('b', '2026-10-02T00:00:00Z'), o('a', '2026-10-01T00:00:00Z')];

describe('order select', () => {
  it('selects explicit columns and only the product fields the admin reads', () => {
    expect(ORDER_SELECT).not.toContain('*');
    expect(ORDER_SELECT).toContain('products(id, name, image_front_url)');
    ['order_items', 'fulfillment_status', 'tracking_number', 'payment_slip_url', 'notes', 'email_or_line_id']
      .forEach((c) => expect(ORDER_COLUMNS).toContain(c));
    expect(ORDER_FALLBACK_SELECT).toBe('*, products(id, name, image_front_url)');
  });
});

describe('joinedProduct', () => {
  it('picks only the joined fields, null when missing', () => {
    expect(joinedProduct('p1', products)).toEqual({ id: 'p1', name: 'Shirt', image_front_url: 'f1.jpg' });
    expect(joinedProduct('nope', products)).toBeNull();
    expect(joinedProduct(null, products)).toBeNull();
    expect(joinedProduct('p1', undefined)).toBeNull();
  });
});

describe('applyOrderChange', () => {
  it('INSERT prepends with the product joined from the loaded products', () => {
    const next = applyOrderChange(list, { type: 'INSERT', row: { id: 'd', created_at: '2026-10-04T00:00:00Z', product_id: 'p2' } }, products);
    expect(next.map((x) => x.id)).toEqual(['d', 'c', 'b', 'a']);
    expect(next[0].products).toEqual({ id: 'p2', name: 'Jersey', image_front_url: null });
    expect(list).toHaveLength(3); // not mutated
  });

  it('INSERT of an already-loaded id merges instead of duplicating', () => {
    const next = applyOrderChange(list, { type: 'INSERT', row: { id: 'b', created_at: '2026-10-02T00:00:00Z', payment_status: 'confirmed' } }, products);
    expect(next.map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(next[1].payment_status).toBe('confirmed');
  });

  it('UPDATE merges by id and keeps the joined product', () => {
    const next = applyOrderChange(list, { type: 'UPDATE', row: { id: 'b', product_id: 'p1', payment_status: 'confirmed', fulfillment_status: 'ready' } }, []);
    expect(next[1]).toMatchObject({ id: 'b', payment_status: 'confirmed', fulfillment_status: 'ready', created_at: '2026-10-02T00:00:00Z' });
    expect(next[1].products).toBe(list[1].products);
    expect(next[0]).toBe(list[0]);
  });

  it('UPDATE that changes product_id re-joins from the products list', () => {
    const next = applyOrderChange(list, { type: 'UPDATE', row: { id: 'b', product_id: 'p2' } }, products);
    expect(next[1].products.name).toBe('Jersey');
    const unlinked = applyOrderChange(list, { type: 'UPDATE', row: { id: 'b', product_id: null } }, products);
    expect(unlinked[1].products).toBeNull();
  });

  it('UPDATE keeps loaded values for keys the payload omits (unchanged TOAST)', () => {
    const withItems = [o('x', '2026-10-01T00:00:00Z', { order_items: [{ name: 'A' }], notes: 'n' })];
    const next = applyOrderChange(withItems, { type: 'UPDATE', row: { id: 'x', payment_status: 'confirmed', order_items: undefined } }, products);
    expect(next[0].order_items).toEqual([{ name: 'A' }]);
    expect(next[0].notes).toBe('n');
  });

  it('UPDATE of an unknown row inserts it in created_at order', () => {
    const next = applyOrderChange(list, { type: 'UPDATE', row: { id: 'm', created_at: '2026-10-02T12:00:00Z', product_id: 'p1' } }, products);
    expect(next.map((x) => x.id)).toEqual(['c', 'm', 'b', 'a']);
    const oldest = applyOrderChange(list, { type: 'UPDATE', row: { id: 'z', created_at: '2026-09-01T00:00:00Z' } }, products);
    expect(oldest.map((x) => x.id)).toEqual(['c', 'b', 'a', 'z']);
  });

  it('DELETE removes by id (payload.old has only the id)', () => {
    expect(applyOrderChange(list, { type: 'DELETE', row: { id: 'b' } }).map((x) => x.id)).toEqual(['c', 'a']);
    expect(applyOrderChange(list, { type: 'DELETE', row: { id: 'gone' } })).toBe(list);
  });

  it('returns null (refetch) when the payload cannot be applied', () => {
    expect(applyOrderChange(list, { type: 'DELETE', row: {} })).toBeNull();
    expect(applyOrderChange(list, { type: 'UPDATE', row: null })).toBeNull();
    expect(applyOrderChange(list, { type: 'INSERT', row: { id: 'n' } })).toBeNull(); // no created_at
    expect(applyOrderChange(list, { type: 'UPDATE', row: { id: 'b' }, errors: ['Error 413: Payload too large'] })).toBeNull();
    expect(applyOrderChange(list, { type: 'TRUNCATE', row: { id: 'b' } })).toBeNull();
  });

  it('tolerates a non-array list', () => {
    expect(applyOrderChange(null, { type: 'INSERT', row: { id: 'n', created_at: '2026-10-05T00:00:00Z' } }, products)).toHaveLength(1);
  });
});
