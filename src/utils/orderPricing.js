// Admin check for forged / stale order totals. Customers write orders.total_price themselves
// (the public key can insert any amount), and repricing promotions in SQL would duplicate
// pricingEngine. Instead the admin list recomputes what order_items should cost with the
// CURRENT product / variant prices and promotions, and flags orders that paid less.
// Old orders placed under a since-changed price or promotion can also be flagged: the badge
// is a prompt to check the slip, not proof of fraud.
import { computePricing } from './pricingEngine';
import { sanitizeOrderItems } from './personalization';

export const PRICE_TOLERANCE = 1; // baht

/**
 * Expected total (incl. shipping) for an order, or null when it cannot be computed:
 * legacy orders without order_items, or a line whose product / variant is no longer known.
 * catalog: { products, variants, promotions, shippingFee }
 */
export function expectedOrderTotal(order, { products = [], variants = [], promotions = [], shippingFee = 0 } = {}) {
  const items = sanitizeOrderItems(order?.order_items);
  if (items.length === 0) return null;
  const productById = new Map((products || []).filter(Boolean).map((p) => [p.id, p]));
  const variantById = new Map((variants || []).filter(Boolean).map((v) => [v.id, v]));

  const cart = [];
  for (const it of items) {
    const variant = it.variant_id ? variantById.get(it.variant_id) : null;
    if (it.variant_id && !variant) return null;
    const productId = it.product_id || variant?.product_id || null;
    const product = productId ? productById.get(productId) : null;
    if (!product) return null;
    // same rule as CartContext.addToCart
    const price = Number(variant?.price ?? product.price) || 0;
    if (price <= 0) return null;
    cart.push({ productId: product.id, variantId: variant?.id || null, price, quantity: it.quantity });
  }

  const { subtotal } = computePricing(cart, promotions);
  const shipping = order?.delivery_method === 'shipping' ? Number(shippingFee) || 0 : 0;
  return subtotal + shipping;
}

/** { expected } when the order paid noticeably less than expected, otherwise null. */
export function findUnderpayment(order, catalog, tolerance = PRICE_TOLERANCE) {
  const expected = expectedOrderTotal(order, catalog);
  if (expected === null) return null;
  const paid = Number(order?.total_price);
  if (!Number.isFinite(paid)) return { expected };
  return paid < expected - tolerance ? { expected } : null;
}
