/**
 * Required, free name/number printed on a jersey, one pair per unit.
 * Cart items carry `personalization: [{ name, number }]` with length == quantity,
 * and checkout saves a structured `orders.order_items` array alongside the notes
 * summary. Everything here is customer-written, so it is bounded and treated as text.
 */

export const NAME_MAX_LENGTH = 5; // code points, so Thai / emoji count per character
export const NUMBER_MAX_LENGTH = 2;
export const MAX_ORDER_ITEMS = 50;
const MAX_UNITS_PER_ITEM = 100;
const MAX_QUANTITY = 999;

// Control characters (incl. newlines / tabs) have no place on a shirt and can break CSV / notes.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

const takeCodePoints = (str, max) => Array.from(str).slice(0, max).join('');

// Names are printed in English capitals only: uppercase, then keep A–Z and spaces
const englishCaps = (str) => str.toUpperCase().replace(/[^A-Z ]/g, '');

/** While typing: drop control chars, uppercase and cap the length, but keep spaces (the user may still be typing). */
export function sanitizeNameInput(value) {
  if (value === null || value === undefined) return '';
  return takeCodePoints(englishCaps(String(value).replace(CONTROL_CHARS, '')), NAME_MAX_LENGTH);
}

/** Final form: English capitals only, trimmed, at most NAME_MAX_LENGTH characters. */
export function normalizeName(value) {
  if (value === null || value === undefined) return '';
  return takeCodePoints(englishCaps(String(value).replace(CONTROL_CHARS, '')).trim(), NAME_MAX_LENGTH).trim();
}

/** Digits only, at most NUMBER_MAX_LENGTH, kept as a string so "07" stays "07". Thai digits are converted. */
export function sanitizeNumberInput(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50))
    .replace(/[^0-9]/g, '')
    .slice(0, NUMBER_MAX_LENGTH);
}

export const normalizeNumber = sanitizeNumberInput;

const emptyUnit = () => ({ name: '', number: '' });

function unitFrom(raw, finalize) {
  if (!raw || typeof raw !== 'object') return emptyUnit();
  return {
    name: finalize ? normalizeName(raw.name) : sanitizeNameInput(raw.name),
    number: sanitizeNumberInput(raw.number)
  };
}

const unitHasContent = (u) => Boolean(normalizeName(u?.name) || sanitizeNumberInput(u?.number));

const clampQty = (quantity) => Math.max(0, Math.min(MAX_UNITS_PER_ITEM, parseInt(quantity, 10) || 0));

/** Grow (with blank pairs) or shrink the per-unit list so it has exactly `quantity` entries. */
export function resizePersonalization(list, quantity) {
  const qty = clampQty(quantity);
  const src = Array.isArray(list) ? list : [];
  return Array.from({ length: qty }, (_, i) => unitFrom(src[i], false));
}

/** Trimmed, validated list of length `quantity`. */
export function normalizePersonalization(list, quantity) {
  const qty = clampQty(quantity);
  const src = Array.isArray(list) ? list : [];
  return Array.from({ length: qty }, (_, i) => unitFrom(src[i], true));
}

export function hasPersonalization(list) {
  return Array.isArray(list) && list.some(unitHasContent);
}

/** Cart items saved before this feature lack the new fields; make every item consistent. */
export function normalizeCartItem(item) {
  if (!item || typeof item !== 'object') return item;
  const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
  const allowPersonalization = Boolean(item.allowPersonalization);
  return {
    ...item,
    quantity,
    allowPersonalization,
    personalization: allowPersonalization ? resizePersonalization(item.personalization, quantity) : []
  };
}

export const cartHasPersonalization = (cartItems) =>
  Array.isArray(cartItems) && cartItems.some((it) => it?.allowPersonalization && hasPersonalization(it.personalization));

const unitIsComplete = (u) => Boolean(normalizeName(u?.name) && sanitizeNumberInput(u?.number));

/** Name and number are required on every unit of a personalizable product. */
export function isPersonalizationComplete(list, quantity) {
  const units = resizePersonalization(list, quantity);
  return units.length > 0 && units.every(unitIsComplete);
}

/** Cart lines of personalizable products still missing a name or number on some unit. */
export const incompletePersonalizationItems = (cartItems) =>
  (Array.isArray(cartItems) ? cartItems : [])
    .filter((it) => it?.allowPersonalization && !isPersonalizationComplete(it.personalization, it.quantity));

/** Structured copy of the cart for `orders.order_items`. */
export function buildOrderItems(cartItems) {
  if (!Array.isArray(cartItems)) return [];
  return cartItems.map((it) => {
    const quantity = Math.max(1, parseInt(it.quantity, 10) || 1);
    const units = it.allowPersonalization ? normalizePersonalization(it.personalization, quantity) : [];
    return {
      product_id: it.productId || null,
      variant_id: it.variantId || null,
      product_name: it.productName || '',
      variant_name: it.variantName || null,
      size: it.size || '-',
      color: it.color || '',
      quantity,
      unit_price: Number(it.price) || 0,
      personalization: hasPersonalization(units) ? units : []
    };
  });
}

const boundedString = (value, max) => {
  if (value === null || value === undefined) return '';
  return takeCodePoints(String(value).replace(CONTROL_CHARS, ' ').trim(), max);
};
const optionalId = (value) => {
  const s = boundedString(value, 64);
  return s ? s : null;
};

/**
 * Validate / clamp order_items before saving, and again when reading them back
 * (rows can be written by anyone with the public key). Returns [] for anything unusable.
 */
export function sanitizeOrderItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_ORDER_ITEMS)
    .filter((it) => it && typeof it === 'object' && !Array.isArray(it))
    .map((it) => {
      const quantity = Math.max(1, Math.min(MAX_QUANTITY, parseInt(it.quantity, 10) || 1));
      const unitPrice = Number(it.unit_price);
      const units = Array.isArray(it.personalization)
        ? normalizePersonalization(it.personalization, Math.min(it.personalization.length, quantity))
        : [];
      return {
        product_id: optionalId(it.product_id),
        variant_id: optionalId(it.variant_id),
        product_name: boundedString(it.product_name, 200),
        variant_name: boundedString(it.variant_name, 100) || null,
        size: boundedString(it.size, 30) || '-',
        color: boundedString(it.color, 60),
        quantity,
        unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? Math.min(unitPrice, 1e6) : 0,
        personalization: hasPersonalization(units) ? units : []
      };
    });
}

/** "SOMCHAI #07" / "SOMCHAI" / "#07" */
export const formatUnit = (u) => [u.name, u.number ? `#${u.number}` : ''].filter(Boolean).join(' ');

/** Items that carry at least one name/number, with only the filled units. */
export function personalizedItems(orderItems) {
  return sanitizeOrderItems(orderItems)
    .map((it) => ({ ...it, units: it.personalization.filter(unitHasContent) }))
    .filter((it) => it.units.length > 0);
}

/**
 * One readable line, e.g. `ชื่อ/เบอร์บนเสื้อ: Jersey [M]: SOMCHAI #07, #10; Jersey [L]: นิด`.
 * Used for the notes fallback (pre-migration DB) and the main CSV column.
 */
export function formatPersonalizationText(orderItems) {
  const items = personalizedItems(orderItems);
  if (items.length === 0) return '';
  const parts = items.map((it) => `${it.product_name || 'สินค้า'} [${it.size}]: ${it.units.map(formatUnit).join(', ')}`);
  return `ชื่อ/เบอร์บนเสื้อ: ${parts.join('; ')}`;
}

/** Append the personalization line after the notes (the leading item summary stays untouched). */
export function appendPersonalizationNote(notes, orderItems) {
  const line = formatPersonalizationText(orderItems);
  const base = notes ? String(notes).trim() : '';
  if (!line) return base || null;
  return base ? `${base} (${line})` : `(${line})`;
}

/**
 * The insert failed because `orders.order_items` does not exist yet (migration 0012 not run).
 * Strict on purpose: only a missing-column error (PostgREST PGRST204 / Postgres 42703) that names
 * order_items. submitOrder drops order_items only in that case; after 0016 (which requires 0012)
 * this can never match, and an order without order_items would be refused by RLS anyway.
 */
export function isMissingOrderItemsColumn(error) {
  if (!error) return false;
  if (error.code !== 'PGRST204' && error.code !== '42703') return false;
  return /order_items/i.test(`${error.message || ''} ${error.details || ''} ${error.hint || ''}`);
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL', '6XL'];
const sizeRank = (s) => {
  const i = SIZE_ORDER.indexOf(String(s || '').toUpperCase());
  return i === -1 ? SIZE_ORDER.length : i;
};

/**
 * Print-shop sheet: one row per unit that has a name or number.
 * Confirmed orders only unless `includeUnconfirmed` (rejected orders are never included).
 */
export function buildPrintSheetRows(orders, products = [], { includeUnconfirmed = false } = {}) {
  const rows = [];
  for (const order of Array.isArray(orders) ? orders : []) {
    if (!order) continue;
    const status = order.payment_status;
    if (status === 'rejected') continue;
    if (!includeUnconfirmed && status !== 'confirmed') continue;
    for (const it of personalizedItems(order.order_items)) {
      const prod = it.product_id ? products.find((p) => p.id === it.product_id) : null;
      const productName = prod?.name || (it.variant_name && it.product_name.endsWith(` - ${it.variant_name}`)
        ? it.product_name.slice(0, -(` - ${it.variant_name}`).length)
        : it.product_name);
      for (const u of it.units) {
        rows.push({
          product: productName || 'สินค้า',
          variant: it.variant_name || '',
          size: it.size,
          color: it.color,
          name: u.name,
          number: u.number,
          order_id: String(order.id || ''),
          customer: String(order.full_name || ''),
          student_id: String(order.student_id || ''),
          phone: String(order.phone_number || ''),
          payment_status: String(status || '')
        });
      }
    }
  }
  return rows.sort((a, b) =>
    a.product.localeCompare(b.product, 'th') ||
    a.variant.localeCompare(b.variant, 'th') ||
    sizeRank(a.size) - sizeRank(b.size) ||
    a.size.localeCompare(b.size) ||
    a.number.localeCompare(b.number, undefined, { numeric: true }) ||
    a.name.localeCompare(b.name, 'th')
  );
}
