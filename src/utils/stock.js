/**
 * Per-size stock limits (migration 0015).
 *
 * Limits:  products.size_stock_limits / product_variants.size_stock_limits = {"M": 30, "L": 20}
 *          (a missing size = unlimited) and the variant's total product_variants.stock_limit.
 *          The product's per-size limits apply to products without variants; a variant uses its own.
 * Sold:    rows from the `get_sold_counts()` RPC: [{product_id, variant_id, size, sold}],
 *          counting every order that is not rejected. `null` = unknown (RPC missing / failed),
 *          which is treated as unlimited everywhere.
 *
 * LIMITATION: this is enforced in the browser only — when the product opens and again right
 * before the order is submitted. It is not transactional, so two customers ordering the last
 * units at the same moment can oversell by a few. Accepted for pre-orders.
 */

export const LOW_STOCK_THRESHOLD = 10;
export const MAX_QTY_PER_LINE = 20; // same cap as the cart

const toLimit = (value) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const s = String(value).trim();
  if (!/^[0-9]{1,6}$/.test(s)) return null;
  return parseInt(s, 10);
};

/** Admin input → limit: blank / invalid = null (unlimited), otherwise a whole number ≥ 0. */
export const parseLimitInput = toLimit;

/** Keep only {size: whole number ≥ 0}; anything else is dropped (= unlimited). */
export function normalizeSizeLimits(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [size, value] of Object.entries(raw)) {
    const key = String(size).trim();
    const limit = toLimit(value);
    if (key && limit !== null) out[key] = limit;
  }
  return out;
}

/**
 * Admin form inputs ({size: "30" | ""}) → value for the size_stock_limits column.
 * Only sizes that are still offered are kept; all blank → null.
 */
export function sizeLimitsFromInputs(inputs, sizes) {
  const offered = Array.isArray(sizes) ? sizes.map((s) => String(s).trim()).filter(Boolean) : [];
  const out = {};
  for (const size of offered) {
    const limit = toLimit(inputs?.[size]);
    if (limit !== null) out[size] = limit;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Column value → admin form inputs ({size: "30"}). */
export function sizeLimitInputs(raw) {
  const limits = normalizeSizeLimits(raw);
  return Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, String(v)]));
}

export const sizeKey = (size) => {
  const s = String(size ?? '').trim();
  return s || '-';
};

const targetKey = (productId, variantId) =>
  variantId ? `v:${variantId}` : productId ? `p:${productId}` : null;

/** get_sold_counts() rows → lookup index. Returns null when rows are unknown. */
export function indexSoldCounts(rows) {
  if (!Array.isArray(rows)) return null;
  const bySize = new Map();
  const byTarget = new Map();
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const key = targetKey(r.product_id, r.variant_id);
    const n = Number(r.sold);
    if (!key || !Number.isFinite(n) || n <= 0) continue;
    const sk = `${key}|${sizeKey(r.size)}`;
    bySize.set(sk, (bySize.get(sk) || 0) + n);
    byTarget.set(key, (byTarget.get(key) || 0) + n);
  }
  return { bySize, byTarget };
}

/** Units already ordered for this product/variant: { size, total }. */
export function soldFor(sold, { productId, variantId, size }) {
  if (!sold) return { size: 0, total: 0 };
  const key = targetKey(productId, variantId);
  if (!key) return { size: 0, total: 0 };
  return {
    size: sold.bySize.get(`${key}|${sizeKey(size)}`) || 0,
    total: sold.byTarget.get(key) || 0
  };
}

const itemMatches = (item, productId, variantId) =>
  variantId ? item.variantId === variantId : (!item.variantId && item.productId === productId);

/** Units of this product/variant already in the cart: { size, total }. */
export function cartQtyFor(cartItems, { productId, variantId, size }, { excludeCartId = null } = {}) {
  let sizeQty = 0;
  let total = 0;
  const sk = sizeKey(size);
  for (const it of Array.isArray(cartItems) ? cartItems : []) {
    if (!it || (excludeCartId && it.cartId === excludeCartId)) continue;
    if (!itemMatches(it, productId, variantId)) continue;
    const q = Math.max(0, parseInt(it.quantity, 10) || 0);
    total += q;
    if (sizeKey(it.size) === sk) sizeQty += q;
  }
  return { size: sizeQty, total };
}

/**
 * Units that can still be ordered, or null when unlimited.
 * The smaller of the per-size limit and the variant's total limit wins.
 */
export function remaining({ sizeLimit = null, totalLimit = null, soldSize = 0, soldTotal = 0, inCartSize = 0, inCartTotal = 0 } = {}) {
  const left = [];
  if (sizeLimit !== null && sizeLimit !== undefined) left.push(sizeLimit - soldSize - inCartSize);
  if (totalLimit !== null && totalLimit !== undefined) left.push(totalLimit - soldTotal - inCartTotal);
  if (left.length === 0) return null;
  return Math.max(0, Math.min(...left));
}

/** Which limits apply to a product (no variant) or one of its variants. */
export function stockLimitsOf(product, variant = null) {
  if (variant) {
    return {
      productId: variant.product_id || product?.id || null,
      variantId: variant.id || null,
      sizeLimits: normalizeSizeLimits(variant.size_stock_limits),
      totalLimit: toLimit(variant.stock_limit)
    };
  }
  return {
    productId: product?.id || null,
    variantId: null,
    sizeLimits: normalizeSizeLimits(product?.size_stock_limits),
    totalLimit: null
  };
}

/**
 * Remaining units for one size of a product/variant, after what is sold and (optionally)
 * what is already in the cart. null = unlimited or unknown (sold counts unavailable).
 * Pass size = null to ignore the per-size limit (variant total only).
 */
export function remainingFor({ product, variant = null, size = null, sold, cartItems = [] }) {
  if (!sold) return null;
  const t = stockLimitsOf(product, variant);
  const ignoreSize = size === null;
  const sizeLimit = ignoreSize ? null : (t.sizeLimits[sizeKey(size)] ?? null);
  const s = soldFor(sold, { ...t, size });
  const c = cartQtyFor(cartItems, { ...t, size });
  return remaining({
    sizeLimit,
    totalLimit: t.totalLimit,
    soldSize: s.size,
    soldTotal: s.total,
    inCartSize: c.size,
    inCartTotal: c.total
  });
}

/** Sizes with nothing left to order (sold out, not counting the cart). */
export function soldOutSizes({ product, variant = null, sizes, sold }) {
  if (!sold) return [];
  return (Array.isArray(sizes) ? sizes : []).filter((s) => remainingFor({ product, variant, size: s, sold }) === 0);
}

/** Largest quantity that may be added now (0 = none). */
export function maxAddable(rem, cap = MAX_QTY_PER_LINE) {
  if (rem === null || rem === undefined) return cap;
  return Math.max(0, Math.min(cap, rem));
}

/** Short badge for a size / variant button: "หมด", "เหลือ 3" (≤ 10), or "". */
export function stockLabel(rem) {
  if (rem === null || rem === undefined) return '';
  if (rem <= 0) return 'หมด';
  if (rem <= LOW_STOCK_THRESHOLD) return `เหลือ ${rem}`;
  return '';
}

/**
 * Pre-submit check of the whole cart against fresh limits and sold counts.
 * catalog: { products: [...], variants: [...] } with size_stock_limits / stock_limit.
 * Returns a list of Thai messages; [] = OK (also when sold counts are unknown).
 */
export function checkCartStock(cartItems, sold, catalog) {
  if (!sold || !Array.isArray(cartItems)) return [];
  const products = new Map((catalog?.products || []).filter(Boolean).map((p) => [p.id, p]));
  const variants = new Map((catalog?.variants || []).filter(Boolean).map((v) => [v.id, v]));

  const sizeGroups = new Map(); // targetKey|size -> { t, size, name, qty }
  const totalGroups = new Map(); // targetKey -> { t, name, qty }
  for (const it of cartItems) {
    if (!it) continue;
    const variant = it.variantId ? variants.get(it.variantId) : null;
    const product = products.get(it.productId) || (variant ? { id: variant.product_id } : null);
    if (it.variantId && !variant) continue; // deleted / unknown: nothing to check against
    if (!it.variantId && !product) continue;
    const t = stockLimitsOf(product, variant);
    const key = targetKey(t.productId, t.variantId);
    if (!key) continue;
    const qty = Math.max(0, parseInt(it.quantity, 10) || 0);
    const name = it.productName || product?.name || 'สินค้า';
    const size = sizeKey(it.size);
    const sk = `${key}|${size}`;
    const sg = sizeGroups.get(sk) || { t, size, name, qty: 0 };
    sg.qty += qty;
    sizeGroups.set(sk, sg);
    const tg = totalGroups.get(key) || { t, name, qty: 0 };
    tg.qty += qty;
    totalGroups.set(key, tg);
  }

  const problems = [];
  for (const g of sizeGroups.values()) {
    const limit = g.t.sizeLimits[g.size];
    if (limit === undefined) continue;
    const left = remaining({ sizeLimit: limit, soldSize: soldFor(sold, { ...g.t, size: g.size }).size });
    if (g.qty > left) {
      problems.push(left === 0
        ? `ไซส์ ${g.size} ของ ${g.name} หมดแล้ว`
        : `ไซส์ ${g.size} ของ ${g.name} เหลือ ${left} ชิ้น (ในตะกร้ามี ${g.qty} ชิ้น)`);
    }
  }
  for (const g of totalGroups.values()) {
    if (g.t.totalLimit === null) continue;
    const left = remaining({ totalLimit: g.t.totalLimit, soldTotal: soldFor(sold, g.t).total });
    if (g.qty > left) {
      problems.push(left === 0
        ? `${g.name} หมดแล้ว`
        : `${g.name} เหลือ ${left} ชิ้น (ในตะกร้ามี ${g.qty} ชิ้น)`);
    }
  }
  return problems;
}

/** "ขายแล้ว 12 / 30" style text for the admin; limit null = ไม่จำกัด. */
export function soldOfLimitText(soldQty, limit) {
  return limit === null || limit === undefined
    ? `ขายแล้ว ${soldQty} (ไม่จำกัด)`
    : `ขายแล้ว ${soldQty} / ${limit}`;
}

/** The function / column does not exist yet (migration 0015 not run). */
export function isMissingStockColumn(error) {
  if (!error) return false;
  return /size_stock_limits|get_sold_counts/i.test(`${error.message || ''} ${error.details || ''} ${error.hint || ''}`);
}
