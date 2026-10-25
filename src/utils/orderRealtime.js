// Admin order list: columns to load, and applying realtime changes to the loaded list
// instead of refetching every order on every INSERT/UPDATE/DELETE.

// Every orders column the admin reads (table, filters, edit form, slip inspector, receipt,
// CSV exports, print sheet, product filter). order_items = migration 0012,
// fulfillment_status = 0014, tracking_number = 0004: when any is missing PostgREST
// rejects the select and getAllOrders falls back to ORDER_FALLBACK_SELECT.
export const ORDER_PRODUCT_FIELDS = ['id', 'name', 'image_front_url'];
export const ORDER_COLUMNS = [
  'id', 'created_at', 'product_id', 'full_name', 'student_id', 'year_of_study', 'major',
  'phone_number', 'email_or_line_id', 'color', 'size', 'quantity', 'total_price',
  'payment_slip_url', 'delivery_method', 'shipping_address', 'notes', 'payment_status',
  'tracking_number', 'fulfillment_status', 'order_items'
];
export const ORDER_SELECT = `${ORDER_COLUMNS.join(', ')}, products(${ORDER_PRODUCT_FIELDS.join(', ')})`;
export const ORDER_FALLBACK_SELECT = `*, products(${ORDER_PRODUCT_FIELDS.join(', ')})`;

// The joined `products` value PostgREST would return for this product_id (null if none).
export function joinedProduct(productId, products) {
  if (!productId) return null;
  const p = (Array.isArray(products) ? products : []).find((x) => x && x.id === productId);
  if (!p) return null;
  const out = {};
  ORDER_PRODUCT_FIELDS.forEach((k) => { out[k] = p[k] ?? null; });
  return out;
}

// Only the keys the payload actually carries: realtime omits unchanged TOASTed values
// (large notes / order_items), and those must keep the loaded value.
function definedFields(row) {
  const out = {};
  Object.keys(row || {}).forEach((k) => {
    if (row[k] !== undefined && k !== 'products') out[k] = row[k];
  });
  return out;
}

const byCreatedDesc = (a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || ''));

function insertSorted(list, row) {
  const i = list.findIndex((o) => byCreatedDesc(row, o) < 0);
  if (i === -1) return [...list, row];
  return [...list.slice(0, i), row, ...list.slice(i)];
}

// change: { type: 'INSERT' | 'UPDATE' | 'DELETE', row, errors? }
//   row = payload.new for INSERT/UPDATE, payload.old for DELETE (only the id by default).
// Returns the new list, or null when the payload cannot be applied safely and the caller
// should fall back to a (debounced) full refetch.
export function applyOrderChange(list, change, products = []) {
  const current = Array.isArray(list) ? list : [];
  const type = String(change?.type || '').toUpperCase();
  const row = change?.row;
  if (Array.isArray(change?.errors) && change.errors.length > 0) return null;
  if (!row || typeof row !== 'object' || !row.id) return null;

  const idx = current.findIndex((o) => o && o.id === row.id);

  if (type === 'DELETE') {
    if (idx === -1) return current;
    return current.filter((o) => o.id !== row.id);
  }

  if (type !== 'INSERT' && type !== 'UPDATE') return null;

  const fields = definedFields(row);
  if (idx === -1) {
    // A brand-new row must be complete enough to render
    if (!fields.created_at) return null;
    const added = { ...fields, products: joinedProduct(fields.product_id, products) };
    return type === 'INSERT' ? [added, ...current] : insertSorted(current, added);
  }

  const existing = current[idx];
  const productChanged = 'product_id' in fields && fields.product_id !== existing.product_id;
  const merged = {
    ...existing,
    ...fields,
    products: productChanged || existing.products === undefined
      ? joinedProduct('product_id' in fields ? fields.product_id : existing.product_id, products)
      : existing.products
  };
  const next = current.slice();
  next[idx] = merged;
  return next;
}
