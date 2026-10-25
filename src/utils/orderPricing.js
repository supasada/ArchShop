// Admin check for forged / stale order totals. Customers write orders.total_price themselves
// (the public key can insert any amount), and repricing promotions in SQL would duplicate
// pricingEngine. Instead the admin list recomputes what the order should cost with the
// CURRENT product / variant prices and promotions, and flags orders that paid less.
// Old orders placed under a since-changed price or promotion can also be flagged: the badge
// is a prompt to check the slip, not proof of fraud.
//
// Fails CLOSED: an order that cannot be priced (unknown product / variant, unreadable lines,
// a legacy order whose notes summary does not confirm product_id x quantity, catalog not loaded
// yet) is reported as 'unverifiable', never as fine, so a forged order cannot dodge the check by
// pointing at a product that does not exist. (After 0016 customers cannot insert orders without
// order_items, so the legacy path only applies to rows written before it.)
import { computePricing } from './pricingEngine';
import { readSummaryItems, findProductByItemName } from './orderProducts';

export const PRICE_TOLERANCE = 1; // baht

// Same per-line bounds the database enforces for customer inserts (order_items_within_limits, 0016).
const MAX_LINES = 50;
const MAX_LINE_QTY = 20;
const MAX_LEGACY_QTY = 20;

export const UNVERIFIABLE_REASONS = {
  catalog_loading: 'ยังโหลดราคาสินค้า/โปรโมชั่นไม่เสร็จ',
  unreadable_items: 'รายการสินค้าในออร์เดอร์อ่านไม่ได้หรือผิดรูปแบบ (อาจถูกแก้ไขหรือปลอมมา)',
  unknown_product: 'ออร์เดอร์อ้างถึงสินค้าที่ไม่มีในระบบ (ถูกลบ หรือรหัสสินค้าปลอม)',
  unknown_variant: 'ออร์เดอร์อ้างถึงตัวเลือกสินค้าที่ไม่มีในระบบ (ถูกลบ หรือรหัสปลอม)',
  no_price: 'สินค้าในออร์เดอร์ไม่มีราคาในระบบ',
  legacy_multi_item: 'ออร์เดอร์เก่าที่มีหลายรายการ ไม่มีรายละเอียดราคาแยกรายการ',
  legacy_no_summary: 'ออร์เดอร์เก่าไม่มีสรุปรายการสินค้าที่อ่านได้',
  legacy_mismatch: 'ออร์เดอร์เก่า: ชื่อสินค้า/จำนวนในสรุปรายการไม่ตรงกับรหัสสินค้า/จำนวนของออร์เดอร์',
  legacy_no_product: 'ออร์เดอร์เก่าไม่มีรหัสสินค้า',
  legacy_bad_quantity: 'จำนวนสินค้าในออร์เดอร์ผิดรูปแบบ'
};

const isStrictQty = (q, max) => Number.isInteger(q) && q >= 1 && q <= max;
const unverifiable = (reason) => ({ ok: false, reason });

function lookupLine({ productId, variantId, quantity }, productById, variantById) {
  const variant = variantId ? variantById.get(variantId) : null;
  if (variantId && !variant) return unverifiable('unknown_variant');
  const pid = productId || variant?.product_id || null;
  const product = pid ? productById.get(pid) : null;
  if (!product) return unverifiable('unknown_product');
  if (variant && variant.product_id && variant.product_id !== product.id) return unverifiable('unknown_variant');
  // same rule as CartContext.addToCart
  const price = Number(variant?.price ?? product.price);
  if (!Number.isFinite(price) || price <= 0) return unverifiable('no_price');
  return { ok: true, line: { productId: product.id, variantId: variant?.id || null, price, quantity } };
}

/**
 * Price an order with the current catalog.
 * → { ok: true, expected } | { ok: false, reason } (reason: a key of UNVERIFIABLE_REASONS)
 * catalog: { products, variants, promotions, shippingFee, ready } — ready === false while
 * variants / promotions are still loading.
 */
export function priceOrder(order, { products = [], variants = [], promotions = [], shippingFee = 0, ready = true } = {}) {
  if (ready === false) return unverifiable('catalog_loading');
  const productById = new Map((products || []).filter(Boolean).map((p) => [p.id, p]));
  const variantById = new Map((variants || []).filter(Boolean).map((v) => [v.id, v]));
  const raw = order?.order_items;

  const cart = [];
  if (raw == null || (Array.isArray(raw) && raw.length === 0)) {
    // Legacy order (before order_items): priced as product_id / product_variant_id x quantity,
    // but only when the notes summary confirms it: readable, exactly one cart line, whose name
    // resolves to order.product_id and whose xQty equals order.quantity. Anything else (no
    // summary, multi-item carts that only stored the first product, mismatches) is unverifiable.
    const items = readSummaryItems(order?.notes);
    if (!items) return unverifiable('legacy_no_summary');
    if (items.length !== 1) return unverifiable('legacy_multi_item');
    if (!order?.product_id) return unverifiable('legacy_no_product');
    const quantity = Number(order?.quantity);
    if (!isStrictQty(quantity, MAX_LEGACY_QTY)) return unverifiable('legacy_bad_quantity');
    if (!productById.has(order.product_id)) return unverifiable('unknown_product');
    const named = findProductByItemName(items[0].name, products);
    if (!named || named.id !== order.product_id || items[0].quantity !== quantity) {
      return unverifiable('legacy_mismatch');
    }
    const r = lookupLine({ productId: order.product_id, variantId: order.product_variant_id, quantity }, productById, variantById);
    if (!r.ok) return r;
    cart.push(r.line);
  } else {
    // Read the raw lines strictly: sanitizeOrderItems would drop / clamp bad lines, which
    // could only make the expected total LOWER than what the order really contains.
    if (!Array.isArray(raw) || raw.length > MAX_LINES) return unverifiable('unreadable_items');
    for (const it of raw) {
      if (!it || typeof it !== 'object' || Array.isArray(it)) return unverifiable('unreadable_items');
      const quantity = typeof it.quantity === 'string' && /^[0-9]{1,2}$/.test(it.quantity) ? Number(it.quantity) : it.quantity;
      if (!isStrictQty(quantity, MAX_LINE_QTY)) return unverifiable('unreadable_items');
      const productId = typeof it.product_id === 'string' && it.product_id ? it.product_id : null;
      const variantId = typeof it.variant_id === 'string' && it.variant_id ? it.variant_id : null;
      const r = lookupLine({ productId, variantId, quantity }, productById, variantById);
      if (!r.ok) return r;
      cart.push(r.line);
    }
  }

  const { subtotal } = computePricing(cart, promotions);
  const shipping = order?.delivery_method === 'shipping' ? Number(shippingFee) || 0 : 0;
  return { ok: true, expected: subtotal + shipping };
}

/** Expected total (incl. shipping), or null when the order cannot be priced. */
export function expectedOrderTotal(order, catalog) {
  const r = priceOrder(order, catalog);
  return r.ok ? r.expected : null;
}

/**
 * → { status: 'ok', expected } | { status: 'underpaid', expected } | { status: 'unverifiable', expected: null, reason }
 */
export function checkOrderTotal(order, catalog, tolerance = PRICE_TOLERANCE) {
  const r = priceOrder(order, catalog);
  if (!r.ok) return { status: 'unverifiable', expected: null, reason: r.reason };
  const paid = Number(order?.total_price);
  const under = !Number.isFinite(paid) || paid < r.expected - tolerance;
  return { status: under ? 'underpaid' : 'ok', expected: r.expected };
}

/**
 * What the admin list should show for an order's total: the underpayment badge for every
 * order, the "cannot verify" badge only while payment is still pending (where the admin
 * decides — old history would otherwise be full of it). null = show nothing.
 */
export function orderTotalBadge(order, catalog, tolerance = PRICE_TOLERANCE) {
  const check = checkOrderTotal(order, catalog, tolerance);
  if (check.status === 'underpaid') return check;
  if (check.status === 'unverifiable' && order?.payment_status === 'pending') {
    return { ...check, message: UNVERIFIABLE_REASONS[check.reason] || 'ตรวจยอดอัตโนมัติไม่ได้' };
  }
  return null;
}
