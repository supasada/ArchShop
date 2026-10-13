/**
 * A cart checkout is stored as ONE row in `orders`: `product_id` is only the first
 * cart item, and the full item list lives in the leading summary of `notes`
 * (written by CartModal as `[Name [size/color] xQty | Name [size/color] xQty] note`).
 * These helpers recover every product in an order so admin filters see all of them.
 */

// One cart line inside the notes summary: "Name [size/color] xQty"
const ITEM_PATTERN = /(?:^\[| \| )(.+?) \[[^\]]*\] x\d+(?= \| |\])/g;

function findProductByItemName(itemName, products) {
  // Cart item name is either "Product" or "Product - Variant"; prefer the longest match
  // so "เสื้อ Limited - ดำ" resolves to "เสื้อ Limited" rather than "เสื้อ".
  let best = null;
  for (const p of products) {
    if (!p?.name) continue;
    if (itemName === p.name || itemName.startsWith(`${p.name} - `)) {
      if (!best || p.name.length > best.name.length) best = p;
    }
  }
  return best;
}

export function getOrderProductIds(order, products = []) {
  const ids = new Set();
  if (order?.product_id) ids.add(order.product_id);

  const notes = typeof order?.notes === 'string' ? order.notes : '';
  if (notes.startsWith('[')) {
    for (const match of notes.matchAll(ITEM_PATTERN)) {
      // matchAll keeps scanning past the summary; stop at the first non-contiguous hit
      if (match.index !== 0 && !notes.startsWith(' | ', match.index)) break;
      const prod = findProductByItemName(match[1].trim(), products);
      if (prod) ids.add(prod.id);
    }
  }
  return [...ids];
}

/**
 * mode: 'any'  → order has at least one selected product
 *       'all'  → order has every selected product (may have others too)
 *       'only' → order has exactly the selected products, nothing else
 */
export function matchesProductFilter(orderProductIds, selectedIds, mode = 'any') {
  if (!selectedIds || selectedIds.length === 0) return true;
  const has = (id) => orderProductIds.includes(id);
  if (mode === 'all') return selectedIds.every(has);
  if (mode === 'only') {
    return selectedIds.every(has) && orderProductIds.every((id) => selectedIds.includes(id));
  }
  return selectedIds.some(has);
}
