import { describe, it, expect } from 'vitest';
import {
  sanitizeNameInput, normalizeName, sanitizeNumberInput,
  resizePersonalization, normalizePersonalization, hasPersonalization,
  normalizeCartItem, cartHasPersonalization, buildOrderItems, sanitizeOrderItems,
  formatPersonalizationText, appendPersonalizationNote, isMissingOrderItemsColumn,
  buildPrintSheetRows, MAX_ORDER_ITEMS
} from './personalization';
import { getOrderProductKeys } from './orderProducts';

describe('name / number validation', () => {
  it('keeps any language and letter case, trims, max 20 code points', () => {
    expect(normalizeName('  SomChai  ')).toBe('SomChai');
    expect(normalizeName('สมชาย')).toBe('สมชาย');
    expect(normalizeName('a'.repeat(25))).toBe('a'.repeat(20));
    // emoji are one code point each even though they are two UTF-16 units
    expect(normalizeName('😀'.repeat(25))).toBe('😀'.repeat(20));
    expect(Array.from(normalizeName('😀'.repeat(25))).length).toBe(20);
    expect(normalizeName(null)).toBe('');
    expect(normalizeName('a\nb\tc')).toBe('abc');
  });

  it('keeps inner and trailing spaces while typing', () => {
    expect(sanitizeNameInput('JOHN ')).toBe('JOHN ');
    expect(sanitizeNameInput('x'.repeat(30))).toHaveLength(20);
  });

  it('numbers: digits only, max 3, kept as a string', () => {
    expect(sanitizeNumberInput('07')).toBe('07');
    expect(sanitizeNumberInput('7')).toBe('7');
    expect(sanitizeNumberInput('12a34')).toBe('123');
    expect(sanitizeNumberInput('-5')).toBe('5');
    expect(sanitizeNumberInput('๑๒')).toBe('12');
    expect(sanitizeNumberInput(10)).toBe('10');
    expect(sanitizeNumberInput(undefined)).toBe('');
  });
});

describe('per-unit list', () => {
  it('grows with blanks and shrinks from the end', () => {
    const one = [{ name: 'A', number: '1' }];
    expect(resizePersonalization(one, 3)).toEqual([
      { name: 'A', number: '1' }, { name: '', number: '' }, { name: '', number: '' }
    ]);
    expect(resizePersonalization([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 2).map((u) => u.name)).toEqual(['A', 'B']);
    expect(resizePersonalization(undefined, 2)).toHaveLength(2);
    expect(resizePersonalization('junk', 0)).toEqual([]);
  });

  it('normalizes entries and detects content', () => {
    expect(normalizePersonalization([{ name: '  a ', number: 'x9' }, 'junk'], 2))
      .toEqual([{ name: 'a', number: '9' }, { name: '', number: '' }]);
    expect(hasPersonalization([{ name: '   ', number: '' }])).toBe(false);
    expect(hasPersonalization([{ name: '', number: '0' }])).toBe(true);
    expect(hasPersonalization(null)).toBe(false);
  });

  it('upgrades cart items saved before the feature', () => {
    const old = { cartId: 'c1', productId: 'p1', quantity: 2, price: 219 };
    expect(normalizeCartItem(old)).toMatchObject({ allowPersonalization: false, personalization: [], quantity: 2 });
    const allowed = normalizeCartItem({ ...old, allowPersonalization: true, personalization: [{ name: 'A', number: '1' }] });
    expect(allowed.personalization).toEqual([{ name: 'A', number: '1' }, { name: '', number: '' }]);
    expect(cartHasPersonalization([allowed])).toBe(true);
    expect(cartHasPersonalization([normalizeCartItem(old)])).toBe(false);
  });
});

describe('order_items', () => {
  const cart = [
    {
      productId: 'p1', variantId: 'v1', variantName: 'Home', productName: 'Jersey - Home',
      size: 'M', color: 'Home', quantity: 2, price: 450, allowPersonalization: true,
      personalization: [{ name: ' Somchai ', number: '07' }, { name: '', number: '' }]
    },
    { productId: 'p2', variantId: null, productName: 'Tote', size: '-', color: 'Black', quantity: 1, price: 150 }
  ];

  it('builds one structured entry per cart line', () => {
    const items = buildOrderItems(cart);
    expect(items).toEqual([
      {
        product_id: 'p1', variant_id: 'v1', product_name: 'Jersey - Home', variant_name: 'Home',
        size: 'M', color: 'Home', quantity: 2, unit_price: 450,
        personalization: [{ name: 'Somchai', number: '07' }, { name: '', number: '' }]
      },
      {
        product_id: 'p2', variant_id: null, product_name: 'Tote', variant_name: null,
        size: '-', color: 'Black', quantity: 1, unit_price: 150, personalization: []
      }
    ]);
  });

  it('drops personalization on products that do not allow it', () => {
    const items = buildOrderItems([{ ...cart[0], allowPersonalization: false }]);
    expect(items[0].personalization).toEqual([]);
  });

  it('sanitizes untrusted input', () => {
    expect(sanitizeOrderItems('nope')).toEqual([]);
    expect(sanitizeOrderItems(Array.from({ length: 80 }, () => ({ quantity: 1 })))).toHaveLength(MAX_ORDER_ITEMS);
    const [it0] = sanitizeOrderItems([{
      product_id: 'x'.repeat(100), product_name: 'N'.repeat(500), size: 42, quantity: '5000', unit_price: 'abc',
      personalization: [{ name: 'A'.repeat(50), number: '12345' }, null, { name: 'B' }]
    }]);
    expect(it0.product_id).toHaveLength(64);
    expect(it0.product_name).toHaveLength(200);
    expect(it0.size).toBe('42');
    expect(it0.quantity).toBe(999);
    expect(it0.unit_price).toBe(0);
    expect(it0.personalization).toEqual([
      { name: 'A'.repeat(20), number: '123' }, { name: '', number: '' }, { name: 'B', number: '' }
    ]);
    // never more units than the quantity
    expect(sanitizeOrderItems([{ quantity: 1, personalization: [{ name: 'A' }, { name: 'B' }] }])[0].personalization)
      .toEqual([{ name: 'A', number: '' }]);
    expect(sanitizeOrderItems([null, [], 'x', { quantity: -3 }])).toHaveLength(1);
  });

  it('formats a readable line and appends it after the notes summary', () => {
    const items = buildOrderItems(cart);
    const line = formatPersonalizationText(items);
    expect(line).toBe('ชื่อ/เบอร์บนเสื้อ: Jersey - Home [M]: Somchai #07');
    expect(formatPersonalizationText([])).toBe('');
    expect(formatPersonalizationText(null)).toBe('');

    const notes = '[Jersey - Home [M/Home] x2 | Tote [-/Black] x1] ฝากไว้ที่สโม';
    const appended = appendPersonalizationNote(notes, items);
    expect(appended).toBe(`${notes} (${line})`);
    expect(appendPersonalizationNote('[Tote [-/Black] x1]', items)).toBe(`[Tote [-/Black] x1] (${line})`);
    expect(appendPersonalizationNote(null, items)).toBe(`(${line})`);
    expect(appendPersonalizationNote('x', [])).toBe('x');

    // the summary parser still reads the same products
    const products = [{ id: 'p1', name: 'Jersey' }, { id: 'p2', name: 'Tote' }];
    expect(getOrderProductKeys({ product_id: 'p1', notes: appended }, products).sort())
      .toEqual(getOrderProductKeys({ product_id: 'p1', notes }, products).sort());
  });

  it('detects the missing-column error from PostgREST', () => {
    expect(isMissingOrderItemsColumn({ code: 'PGRST204', message: "Could not find the 'order_items' column of 'orders' in the schema cache" })).toBe(true);
    expect(isMissingOrderItemsColumn({ code: '42703', message: 'column "order_items" of relation "orders" does not exist' })).toBe(true);
    expect(isMissingOrderItemsColumn({ code: '23503', message: 'violates foreign key constraint' })).toBe(false);
    expect(isMissingOrderItemsColumn(null)).toBe(false);
  });
});

describe('print sheet rows', () => {
  const products = [{ id: 'p1', name: 'Jersey' }];
  const items = (units, extra = {}) => [{
    product_id: 'p1', variant_id: 'v1', product_name: 'Jersey - Home', variant_name: 'Home',
    size: 'L', color: 'Home', quantity: units.length, unit_price: 450, personalization: units, ...extra
  }];
  const orders = [
    { id: 'o1', full_name: 'A', student_id: '1', phone_number: '08', payment_status: 'confirmed',
      order_items: items([{ name: 'Zed', number: '10' }, { name: '', number: '' }, { name: '', number: '2' }]) },
    { id: 'o2', full_name: 'B', payment_status: 'pending', order_items: items([{ name: 'Bee', number: '' }], { size: 'S' }) },
    { id: 'o3', full_name: 'C', payment_status: 'rejected', order_items: items([{ name: 'Cee', number: '1' }]) },
    { id: 'o4', full_name: 'D', payment_status: 'confirmed', notes: '[x]' }, // legacy order, no order_items
    { id: 'o5', full_name: 'E', payment_status: 'confirmed', order_items: 'garbage' }
  ];

  it('one row per filled unit, confirmed only by default', () => {
    const rows = buildPrintSheetRows(orders, products);
    expect(rows.map((r) => [r.order_id, r.name, r.number])).toEqual([['o1', '', '2'], ['o1', 'Zed', '10']]);
    expect(rows[0]).toMatchObject({ product: 'Jersey', variant: 'Home', size: 'L', customer: 'A', payment_status: 'confirmed' });
  });

  it('can include pending orders but never rejected ones, sorted by size', () => {
    const rows = buildPrintSheetRows(orders, products, { includeUnconfirmed: true });
    expect(rows.map((r) => r.order_id)).toEqual(['o2', 'o1', 'o1']);
  });

  it('falls back to the saved name when the product was deleted', () => {
    const rows = buildPrintSheetRows([orders[0]], []);
    expect(rows[0].product).toBe('Jersey');
  });
});
