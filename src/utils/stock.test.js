import { describe, it, expect } from 'vitest';
import {
  normalizeSizeLimits,
  parseLimitInput,
  sizeLimitsFromInputs,
  sizeLimitInputs,
  indexSoldCounts,
  soldFor,
  cartQtyFor,
  remaining,
  remainingFor,
  soldOutSizes,
  maxAddable,
  stockLabel,
  checkCartStock,
  soldOfLimitText,
  isMissingStockColumn
} from './stock';

const P = 'p-1';
const V = 'v-1';
const product = { id: P, name: 'Jersey', size_stock_limits: { M: 5, L: 2 } };
const variant = { id: V, product_id: P, name: 'Men', stock_limit: 10, size_stock_limits: { M: 4 } };

const rows = [
  { product_id: P, variant_id: null, size: 'M', sold: 3 },
  { product_id: P, variant_id: null, size: 'L', sold: 2 },
  { product_id: P, variant_id: V, size: 'M', sold: 1 },
  { product_id: null, variant_id: V, size: 'M', sold: 1 }, // order_items with a bad product_id
  { product_id: P, variant_id: V, size: 'S', sold: '5' } // bigint arrives as a string
];
const sold = indexSoldCounts(rows);

describe('stock limits', () => {
  it('normalizes limits: whole numbers ≥ 0 only, missing = unlimited', () => {
    expect(normalizeSizeLimits({ M: 30, L: '20', XL: '', S: -1, XS: 1.5, '2XL': 'abc', ' 3XL ': 0 })).toEqual({ M: 30, L: 20, '3XL': 0 });
    expect(normalizeSizeLimits(null)).toEqual({});
    expect(normalizeSizeLimits([1, 2])).toEqual({});
    expect(parseLimitInput('')).toBe(null);
    expect(parseLimitInput(' 7 ')).toBe(7);
    expect(parseLimitInput('0')).toBe(0);
  });

  it('builds the column value from admin inputs, dropping sizes no longer offered', () => {
    expect(sizeLimitsFromInputs({ M: '30', L: '', XL: '5' }, ['M', 'L'])).toEqual({ M: 30 });
    expect(sizeLimitsFromInputs({ M: '' }, ['M'])).toBe(null);
    expect(sizeLimitsFromInputs({}, undefined)).toBe(null);
    expect(sizeLimitInputs({ M: 30 })).toEqual({ M: '30' });
  });

  it('indexes sold counts by variant (or product when no variant) and size', () => {
    expect(indexSoldCounts(null)).toBe(null);
    expect(soldFor(sold, { productId: P, variantId: null, size: 'M' })).toEqual({ size: 3, total: 5 });
    // variant rows are matched by variant id even when product_id is missing
    expect(soldFor(sold, { productId: P, variantId: V, size: 'M' })).toEqual({ size: 2, total: 7 });
    expect(soldFor(null, { productId: P, size: 'M' })).toEqual({ size: 0, total: 0 });
  });

  it('counts cart quantity for the same item, size "" and "-" being the same', () => {
    const cart = [
      { cartId: 'a', productId: P, variantId: null, size: 'M', quantity: 2 },
      { cartId: 'b', productId: P, variantId: V, size: 'M', quantity: 1 },
      { cartId: 'c', productId: P, variantId: null, size: '-', quantity: 1 }
    ];
    expect(cartQtyFor(cart, { productId: P, variantId: null, size: 'M' })).toEqual({ size: 2, total: 3 });
    expect(cartQtyFor(cart, { productId: P, variantId: V, size: 'M' })).toEqual({ size: 1, total: 1 });
    expect(cartQtyFor(cart, { productId: P, variantId: null, size: '' })).toEqual({ size: 1, total: 3 });
    expect(cartQtyFor(cart, { productId: P, variantId: null, size: 'M' }, { excludeCartId: 'a' })).toEqual({ size: 0, total: 1 });
  });

  it('remaining is the smaller of the size and total limit, never negative, null when unlimited', () => {
    expect(remaining({})).toBe(null);
    expect(remaining({ sizeLimit: 5, soldSize: 3 })).toBe(2);
    expect(remaining({ sizeLimit: 5, soldSize: 3, inCartSize: 1 })).toBe(1);
    expect(remaining({ sizeLimit: 5, totalLimit: 10, soldSize: 1, soldTotal: 9 })).toBe(1);
    expect(remaining({ sizeLimit: 2, soldSize: 5 })).toBe(0);
    expect(remaining({ totalLimit: 0 })).toBe(0);
  });

  it('remainingFor uses the product limits without variants and the variant limits with one', () => {
    expect(remainingFor({ product, size: 'M', sold })).toBe(2);
    expect(remainingFor({ product, size: 'L', sold })).toBe(0);
    expect(remainingFor({ product, size: 'XL', sold })).toBe(null); // no limit for XL
    expect(remainingFor({ product, size: 'M', sold, cartItems: [{ productId: P, size: 'M', quantity: 1 }] })).toBe(1);
    // variant: M limit 4 - sold 2 = 2; total 10 - sold 7 = 3 → 2
    expect(remainingFor({ product, variant, size: 'M', sold })).toBe(2);
    // variant S: no size limit, total 10 - 7 = 3
    expect(remainingFor({ product, variant, size: 'S', sold })).toBe(3);
    // size = null → total only
    expect(remainingFor({ product, variant, size: null, sold })).toBe(3);
    // unknown sold counts → unlimited
    expect(remainingFor({ product, size: 'L', sold: null })).toBe(null);
  });

  it('lists sold-out sizes', () => {
    expect(soldOutSizes({ product, sizes: ['S', 'M', 'L'], sold })).toEqual(['L']);
    expect(soldOutSizes({ product, sizes: ['L'], sold: null })).toEqual([]);
  });

  it('max addable quantity is capped at 20 and by what is left', () => {
    expect(maxAddable(null)).toBe(20);
    expect(maxAddable(3)).toBe(3);
    expect(maxAddable(50)).toBe(20);
    expect(maxAddable(0)).toBe(0);
  });

  it('labels: หมด, เหลือ N when ≤ 10, nothing otherwise', () => {
    expect(stockLabel(0)).toBe('หมด');
    expect(stockLabel(10)).toBe('เหลือ 10');
    expect(stockLabel(11)).toBe('');
    expect(stockLabel(null)).toBe('');
  });

  it('pre-submit check reports sizes and variant totals that are over', () => {
    const catalog = { products: [product], variants: [variant] };
    const cart = [
      { cartId: 'a', productId: P, variantId: null, productName: 'Jersey', size: 'M', quantity: 2 },
      { cartId: 'b', productId: P, variantId: null, productName: 'Jersey', size: 'M', quantity: 1 }, // personalized line, same size
      { cartId: 'c', productId: P, variantId: null, productName: 'Jersey', size: 'L', quantity: 1 },
      { cartId: 'd', productId: P, variantId: V, productName: 'Jersey - Men', size: 'S', quantity: 4 }
    ];
    expect(checkCartStock(cart, sold, catalog)).toEqual([
      'ไซส์ M ของ Jersey เหลือ 2 ชิ้น (ในตะกร้ามี 3 ชิ้น)',
      'ไซส์ L ของ Jersey หมดแล้ว',
      'Jersey - Men เหลือ 3 ชิ้น (ในตะกร้ามี 4 ชิ้น)'
    ]);
  });

  it('pre-submit check passes when within limits, unknown, or the item is not in the catalog', () => {
    const catalog = { products: [product], variants: [variant] };
    const ok = [{ productId: P, variantId: null, productName: 'Jersey', size: 'M', quantity: 2 }];
    expect(checkCartStock(ok, sold, catalog)).toEqual([]);
    expect(checkCartStock([{ productId: P, size: 'L', quantity: 9 }], null, catalog)).toEqual([]);
    expect(checkCartStock([{ productId: P, variantId: 'gone', size: 'M', quantity: 9 }], sold, catalog)).toEqual([]);
    expect(checkCartStock([{ productId: 'other', size: 'M', quantity: 9 }], sold, catalog)).toEqual([]);
  });

  it('admin text and missing-migration detection', () => {
    expect(soldOfLimitText(3, 10)).toBe('ขายแล้ว 3 / 10');
    expect(soldOfLimitText(3, null)).toBe('ขายแล้ว 3 (ไม่จำกัด)');
    expect(isMissingStockColumn({ message: 'column "size_stock_limits" does not exist' })).toBe(true);
    expect(isMissingStockColumn({ message: 'other' })).toBe(false);
  });
});
