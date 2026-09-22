function unitKey(item) {
  return item.variantId ? `v:${item.variantId}` : `p:${item.productId}`;
}

function scopeKey(ref) {
  return ref.variant_id ? `v:${ref.variant_id}` : `p:${ref.product_id}`;
}

export function computePricing(cartItems, promotions = []) {
  const pool = [];
  (cartItems || []).forEach((item) => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const price = Number(item.price) || 0;
    for (let i = 0; i < qty; i++) {
      pool.push({ key: unitKey(item), price });
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
      const items = promo.bundle_items || [];
      if (items.length === 0) return;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const consumedIdx = [];
        let complete = true;

        for (const bi of items) {
          const key = scopeKey(bi);
          const need = bi.required_qty || 1;
          const available = pool
            .map((u, idx) => ({ ...u, idx }))
            .filter((u) => u.key === key && !consumedIdx.includes(u.idx))
            .sort((a, b) => b.price - a.price);

          if (available.length < need) {
            complete = false;
            break;
          }
          for (let n = 0; n < need; n++) consumedIdx.push(available[n].idx);
        }

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
        const scopeKeys = (promo.scope_variants || []).map(scopeKey);
        eligibleIdx = pool
          .map((u, idx) => ({ u, idx }))
          .filter(({ u }) => scopeKeys.includes(u.key))
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
