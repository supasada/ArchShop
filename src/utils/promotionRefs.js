// A promo ref targets one variant ({variant_id}) or a whole product ({product_id}: every variant,
// including ones added later, and the base no-variant item). Helpers convert form state <-> DB rows.

export function refKey(ref) {
  if (ref?.variant_id) return `v:${ref.variant_id}`;
  if (ref?.product_id) return `p:${ref.product_id}`;
  return null;
}

// Keep only valid refs, one of each, as {variant_id} or {product_id}
export function cleanRefs(refs) {
  const seen = new Set();
  const out = [];
  (refs || []).forEach((r) => {
    const key = refKey(r);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(r.variant_id ? { variant_id: r.variant_id } : { product_id: r.product_id });
  });
  return out;
}

export function toggleRef(refs, ref) {
  const key = refKey(ref);
  return refs.some((r) => refKey(r) === key) ? refs.filter((r) => refKey(r) !== key) : [...refs, ref];
}

// Scope refs from a save payload; falls back to the older `scope_variant_ids` (variant ids only)
export function scopeRefsFromPayload({ scope_refs, scope_variant_ids } = {}) {
  if (Array.isArray(scope_refs)) return cleanRefs(scope_refs);
  if (Array.isArray(scope_variant_ids)) return cleanRefs(scope_variant_ids.map((id) => ({ variant_id: id })));
  return null; // nothing given: leave existing rows alone
}

export function scopeRowsFromRefs(promotionId, refs) {
  return cleanRefs(refs).map((r) => ({
    promotion_id: promotionId,
    variant_id: r.variant_id || null,
    product_id: r.product_id || null
  }));
}

// DB bundle rows -> form slots [{refs, required_qty}]; rows sharing a `slot` are alternatives
export function slotsFromBundleRows(rows) {
  const slots = [];
  const bySlot = new Map();
  (rows || []).forEach((b) => {
    const ref = cleanRefs([b])[0];
    if (!ref) return;
    if (b.slot != null && bySlot.has(b.slot)) {
      bySlot.get(b.slot).refs.push(ref);
    } else {
      const slot = { refs: [ref], required_qty: b.required_qty || 1 };
      if (b.slot != null) bySlot.set(b.slot, slot);
      slots.push(slot);
    }
  });
  return slots;
}

// Form slots -> bundle_items payload (slot index groups the alternatives)
export function bundleItemsFromSlots(slots) {
  return (slots || []).flatMap((slot, idx) =>
    cleanRefs(slot.refs).map((r) => ({
      variant_id: r.variant_id || null,
      product_id: r.product_id || null,
      slot: idx,
      required_qty: slot.required_qty || 1
    })));
}
