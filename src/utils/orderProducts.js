/**
 * A cart checkout is stored as ONE row in `orders`: `product_id` is only the first
 * cart item, and the full item list lives in the leading summary of `notes`
 * (written by CartModal as `[Name [size/color] xQty | Name [size/color] xQty] note`).
 * These helpers recover every product in an order so admin filters see all of them.
 */

// What must follow the "]" closing an item's [size/color]: " xQty" then " | " or the final "]"
const ITEM_TAIL = /\] x\d+( \| |\])/y;

// Item names from the leading "[Name [size/color] xQty | ...]" summary of notes.
// Hand-rolled single forward pass: notes are customer-written, so a backtracking
// regex here could be made to freeze the admin page.
function parseSummaryItemNames(notes) {
  const names = [];
  if (!notes.startsWith('[')) return names;
  let start = 1;
  let search = start;
  while (search < notes.length) {
    const nameEnd = notes.indexOf(' [', search);
    if (nameEnd === -1) break;
    if (nameEnd === start) { search = start + 1; continue; }
    const close = notes.indexOf(']', nameEnd + 2);
    if (close === -1) break;
    ITEM_TAIL.lastIndex = close;
    const tail = ITEM_TAIL.exec(notes);
    if (!tail) {
      // That "[" belonged to the name itself (e.g. "เสื้อ [Limited]"); keep looking past it
      search = close + 1;
      continue;
    }
    names.push(notes.slice(start, nameEnd));
    if (tail[1] === ']') break;
    start = ITEM_TAIL.lastIndex;
    search = start;
  }
  return names;
}

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

// Filter key for a product that no longer exists (deleted) or was renamed after the
// order was placed: all we have left is the name saved in the order's notes.
const ORPHAN_PREFIX = 'name:';
const orphanKey = (itemName) => ORPHAN_PREFIX + itemName.split(' - ')[0].trim();

/**
 * Every product in an order, as filter keys: a product id when the product still
 * exists, otherwise a "name:<saved name>" key so old orders stay filterable.
 */
export function getOrderProductKeys(order, products = []) {
  const keys = new Set();
  const knownProductId = products.some((p) => p.id === order?.product_id) ? order.product_id : null;
  if (knownProductId) keys.add(knownProductId);

  const notes = typeof order?.notes === 'string' ? order.notes : '';
  parseSummaryItemNames(notes).forEach((rawName, index) => {
    const itemName = rawName.trim();
    const prod = findProductByItemName(itemName, products);
    if (prod) keys.add(prod.id);
    // product_id is the first cart item, so a first name that no longer matches
    // just means that product was renamed; it is already counted above.
    else if (!(index === 0 && knownProductId)) keys.add(orphanKey(itemName));
  });
  return [...keys];
}

/** Products found in orders but missing from the product list, for extra filter chips. */
export function listOrphanProducts(orders = [], products = []) {
  const found = new Map();
  for (const order of orders) {
    for (const key of getOrderProductKeys(order, products)) {
      if (key.startsWith(ORPHAN_PREFIX) && !found.has(key)) {
        found.set(key, { id: key, name: key.slice(ORPHAN_PREFIX.length) });
      }
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

/**
 * mode: 'any'  → order has at least one selected product
 *       'all'  → order has every selected product (may have others too)
 *       'only' → order has exactly the selected products, nothing else
 */
export function matchesProductFilter(orderProductKeys, selectedIds, mode = 'any') {
  if (!selectedIds || selectedIds.length === 0) return true;
  const has = (id) => orderProductKeys.includes(id);
  if (mode === 'all') return selectedIds.every(has);
  if (mode === 'only') {
    return selectedIds.every(has) && orderProductKeys.every((id) => selectedIds.includes(id));
  }
  return selectedIds.some(has);
}
