// Order fulfillment status (orders.fulfillment_status, migration 0014) — separate from
// payment_status. Pure helpers shared by the admin list/modal and the customer tracking timeline.

export const FULFILLMENT_STATUSES = ['pending', 'in_production', 'ready', 'shipped', 'completed'];

// Admin-facing labels (Thai)
export const FULFILLMENT_LABELS = {
  pending: 'รอดำเนินการ',
  in_production: 'ส่งผลิต',
  ready: 'พร้อมรับ',
  shipped: 'จัดส่งแล้ว',
  completed: 'เสร็จสิ้น'
};

export const FULFILLMENT_BADGE_CLASSES = {
  pending: 'bg-zinc-100 text-zinc-600',
  in_production: 'bg-sky-100 text-sky-800',
  ready: 'bg-violet-100 text-violet-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-emerald-100 text-emerald-800'
};

// Orders read before migration 0014 has run have no column → 'pending'.
export function normalizeFulfillmentStatus(value) {
  return FULFILLMENT_STATUSES.includes(value) ? value : 'pending';
}

export function isShippingOrder(order) {
  return order?.delivery_method === 'shipping';
}

// Step keys: 'paid' → 'in_production' → 'ready' (pickup) | 'shipped' (shipping) → 'completed'
export function getFulfillmentSteps(order) {
  return ['paid', 'in_production', isShippingOrder(order) ? 'shipped' : 'ready', 'completed'];
}

const STATUS_INDEX = { pending: 0, in_production: 1, ready: 2, shipped: 2, completed: 3 };

/**
 * Timeline for one order.
 * state: 'rejected' (payment rejected) | 'awaiting_payment' (no step reached yet) | 'active'
 * currentIndex: index of the last reached step, -1 when none is reached.
 * steps: [{ key, reached, current }]
 * Payment decides first: an unconfirmed order never shows production progress.
 */
export function getFulfillmentProgress(order) {
  const keys = getFulfillmentSteps(order);
  let state = 'active';
  let currentIndex = -1;
  if (order?.payment_status === 'rejected') {
    state = 'rejected';
  } else if (order?.payment_status !== 'confirmed') {
    state = 'awaiting_payment';
  } else {
    currentIndex = STATUS_INDEX[normalizeFulfillmentStatus(order?.fulfillment_status)];
  }
  const steps = keys.map((key, i) => ({ key, reached: i <= currentIndex, current: i === currentIndex }));
  return { state, currentIndex, steps };
}

// Orders a bulk fulfillment change may touch: confirmed payment only.
export function bulkFulfillmentTargets(orders) {
  return (Array.isArray(orders) ? orders : [])
    .filter((o) => o && o.id && o.payment_status === 'confirmed')
    .map((o) => o.id);
}

export function chunkIds(ids, size = 200) {
  const list = Array.isArray(ids) ? ids : [];
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// True when a Supabase/PostgREST error says the 0014 columns do not exist yet.
export function isMissingFulfillmentColumn(error) {
  const msg = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return /fulfillment_status|production_note/i.test(msg);
}
