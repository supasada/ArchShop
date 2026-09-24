function unitKey(item) {
  return item.variantId ? `v:${item.variantId}` : `p:${item.productId}`;
}

// A unit matches a promo reference by exact variant, or by product (any variant of it)
function unitMatchesRef(unit, ref) {
  if (ref.variant_id) return unit.variantId === ref.variant_id;
  return unit.productId === ref.product_id;
}

// Bundle rows sharing a `slot` are alternatives for one slot; rows without a slot are their own slot
function groupBundleSlots(items) {
  const slots = [];
  const bySlot = new Map();
  items.forEach((bi) => {
    if (bi.slot == null) {
      slots.push({ refs: [bi], need: bi.required_qty || 1 });
    } else if (bySlot.has(bi.slot)) {
      bySlot.get(bi.slot).refs.push(bi);
    } else {
      const slot = { refs: [bi], need: bi.required_qty || 1 };
      bySlot.set(bi.slot, slot);
      slots.push(slot);
    }
  });
  return slots;
}

// Assign pool units to every required slot-unit with bipartite matching, so a unit that fits
// several slots is never greedily spent on the wrong one. Higher-priced units are tried first.
// Returns the pool indexes of one complete set, or null when no complete set exists.
function findBundleSet(pool, slots) {
  const requirements = slots.flatMap((slot) => Array.from({ length: slot.need }, () => slot));
  const order = pool.map((_, idx) => idx).sort((a, b) => pool[b].price - pool[a].price);
  const owner = new Map(); // pool index -> requirement index

  const assign = (req, seen) => {
    for (const idx of order) {
      if (seen.has(idx) || !requirements[req].refs.some((r) => unitMatchesRef(pool[idx], r))) continue;
      seen.add(idx);
      if (!owner.has(idx) || assign(owner.get(idx), seen)) {
        owner.set(idx, req);
        return true;
      }
    }
    return false;
  };

  for (let req = 0; req < requirements.length; req++) {
    if (!assign(req, new Set())) return null;
  }
  return [...owner.keys()];
}

export function computePricing(cartItems, promotions = []) {
  const pool = [];
  (cartItems || []).forEach((item) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const price = Number(item.price) || 0;
    for (let i = 0; i < qty; i++) {
      pool.push({ key: unitKey(item), productId: item.productId, variantId: item.variantId || null, price });
    }
  });

  const rawSubtotal = pool.reduce((sum, u) => sum + u.price, 0);
  const appliedPromotions = [];
  let subtotal = 0;

  const activePromos = (promotions || [])
    .filter((p) => p.is_active)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));

  // --- Bundle pass: consume exact matching sets first ---
  activePromos
    .filter((p) => p.type === 'bundle')
    .forEach((promo) => {
      const slots = groupBundleSlots(promo.bundle_items || []);
      if (slots.length === 0) return;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const consumedIdx = findBundleSet(pool, slots);
        const complete = consumedIdx !== null;

        if (!complete) break;

        const setSum = consumedIdx.reduce((s, idx) => s + pool[idx].price, 0);
        const setPrice = promo.discount_type === 'fixed_price'
          ? Math.max(0, Number(promo.discount_value) || 0)
          : Math.max(0, setSum - (Number(promo.discount_value) || 0));

        subtotal += setPrice;
        appliedPromotions.push({ id: promo.id, name: promo.name, type: 'bundle', discount: setSum - setPrice });

        consumedIdx.sort((a, b) => b - a).forEach((idx) => pool.splice(idx, 1));
      }
    });

  // --- Quantity-break pass: chunk remaining eligible units ---
  activePromos
    .filter((p) => p.type === 'quantity_break')
    .forEach((promo) => {
      const n = Number(promo.quantity) || 0;
      if (n <= 0) return;

      let eligibleIdx;
      if (promo.applies_to_all) {
        eligibleIdx = pool.map((_, idx) => idx);
      } else {
        eligibleIdx = pool
          .map((u, idx) => ({ u, idx }))
          .filter(({ u }) => (promo.scope_variants || []).some((r) => unitMatchesRef(u, r)))
          .map(({ idx }) => idx);
      }
      eligibleIdx.sort((a, b) => pool[b].price - pool[a].price);

      const groups = Math.floor(eligibleIdx.length / n);
      if (groups <= 0) return;

      const consumed = eligibleIdx.slice(0, groups * n);
      const groupSum = consumed.reduce((s, idx) => s + pool[idx].price, 0);
      const newSum = groups * (Number(promo.bundle_price) || 0);

      subtotal += newSum;
      appliedPromotions.push({ id: promo.id, name: promo.name, type: 'quantity_break', discount: groupSum - newSum });

      consumed.sort((a, b) => b - a).forEach((idx) => pool.splice(idx, 1));
    });

  // --- Remainder at full price ---
  subtotal += pool.reduce((s, u) => s + u.price, 0);

  return {
    rawSubtotal,
    subtotal,
    discount: Math.max(0, rawSubtotal - subtotal),
    appliedPromotions
  };
}

// "Promo A ×2, Promo B" — one label per promotion even when it applied to several sets
export function summarizePromotions(appliedPromotions = []) {
  const counts = new Map();
  appliedPromotions.forEach((p) => counts.set(p.name, (counts.get(p.name) || 0) + 1));
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ');
}
