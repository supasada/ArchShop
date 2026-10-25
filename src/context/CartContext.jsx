import React, { createContext, useContext, useState, useEffect } from 'react';
import { computePricing } from '../utils/pricingEngine';
import { api } from '../config/supabase';
import { debounce, REALTIME_DEBOUNCE_MS } from '../utils/debounce';
import { normalizeCartItem, resizePersonalization, hasPersonalization } from '../utils/personalization';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const local = localStorage.getItem('archshop_cart_items');
      const saved = local ? JSON.parse(local) : [];
      // carts saved before name/number support lack those fields
      return Array.isArray(saved) ? saved.filter((it) => it && typeof it === 'object').map(normalizeCartItem) : [];
    } catch {
      return [];
    }
  });

  const [toastMessage, setToastMessage] = useState(null);

  const [promotions, setPromotions] = useState([]);

  const reloadPromotions = () => {
    api.getPromotions().then(setPromotions).catch(() => setPromotions([]));
  };

  useEffect(() => {
    reloadPromotions();
    // Saving one promotion writes several rows across these tables: reload once per burst
    const reload = debounce(reloadPromotions, REALTIME_DEBOUNCE_MS);
    const subs = [
      api.subscribeTable('promotions', reload),
      api.subscribeTable('promotion_scope_variants', reload),
      api.subscribeTable('promotion_bundle_items', reload)
    ];
    return () => { reload.cancel(); subs.forEach((s) => s.unsubscribe()); };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('archshop_cart_items', JSON.stringify(cartItems));
    } catch (e) {
      console.warn('Failed to save cart to localStorage:', e);
    }
  }, [cartItems]);

  // personalization: optional [{name, number}] per unit, only kept when the product allows it
  const addToCart = (product, size, color, quantity = 1, variant = null, personalization = null) => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const chosenSize = size || '-';
    const chosenColor = color || (product.available_colors?.[0] || 'Deep Black');
    const variantId = variant?.id || null;
    const allowPersonalization = product.allow_personalization === true;
    const baseKey = `${product.id}_${variantId || 'base'}_${chosenSize}_${chosenColor}`;
    const units = allowPersonalization ? resizePersonalization(personalization, Math.min(20, qty)) : [];
    const isPersonalized = hasPersonalization(units);

    setCartItems((prevItems) => {
      // Lines with names/numbers are never merged with a line whose names/numbers differ
      // (only blank + blank merge), so nobody's printed shirt gets mixed up.
      const existingIndex = isPersonalized
        ? -1
        : prevItems.findIndex((item) => (item.baseKey || item.key) === baseKey && !hasPersonalization(item.personalization));
      const itemKey = prevItems.some((item) => item.key === baseKey)
        ? `${baseKey}_p${Date.now().toString(36)}${Math.random().toString(36).substr(2, 4)}`
        : baseKey;
      if (existingIndex > -1) {
        const updated = [...prevItems];
        const existing = updated[existingIndex];
        const mergedQty = Math.min(20, existing.quantity + qty);
        const allow = Boolean(existing.allowPersonalization || allowPersonalization);
        updated[existingIndex] = {
          ...existing,
          quantity: mergedQty,
          allowPersonalization: allow,
          // the existing names/numbers stay; new units start blank
          personalization: allow ? resizePersonalization(existing.personalization, mergedQty) : []
        };
        return updated;
      } else {
        const newItem = {
          cartId: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          key: itemKey,
          baseKey,
          productId: product.id,
          variantId,
          variantName: variant?.name || null,
          productName: variant?.name ? `${product.name} - ${variant.name}` : product.name,
          price: Number(variant?.price ?? product.price) || 219,
          size: chosenSize,
          color: chosenColor,
          quantity: Math.min(20, qty),
          allowPersonalization,
          personalization: units,
          imageFrontUrl: variant?.images?.[0]?.image_url || product.image_front_url || '/assets/images/arch_shirt_front.jpg',
          imageBackUrl: product.image_back_url,
          deadline: product.order_deadline,
          productionNote: product.production_note || null
        };
        return [...prevItems, newItem];
      }
    });

    showToast(`🛒 เพิ่ม ${variant?.name ? `${product.name} (${variant.name})` : product.name} ${chosenSize !== '-' ? `(ไซส์ ${chosenSize})` : ''} ลงตะกร้าแล้ว`);
  };


  const updateQuantity = (cartId, newQty) => {
    const qty = Math.max(1, Math.min(20, parseInt(newQty, 10) || 1));
    setCartItems((prevItems) =>
      prevItems.map((item) => (item.cartId === cartId
        ? { ...item, quantity: qty, personalization: item.allowPersonalization ? resizePersonalization(item.personalization, qty) : [] }
        : item))
    );
  };

  const updatePersonalization = (cartId, list) => {
    setCartItems((prevItems) =>
      prevItems.map((item) => (item.cartId === cartId && item.allowPersonalization
        ? { ...item, personalization: resizePersonalization(list, item.quantity) }
        : item))
    );
  };

  const removeFromCart = (cartId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.cartId !== cartId));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const totalItems = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  const pricing = computePricing(cartItems, promotions);
  const { rawSubtotal, subtotal, discount, appliedPromotions } = pricing;
  const isPromoApplied = appliedPromotions.length > 0;

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        updateQuantity,
        updatePersonalization,
        removeFromCart,
        clearCart,
        totalItems,
        rawSubtotal,
        discount,
        subtotal,
        isPromoApplied,
        appliedPromotions,
        promotions,
        toastMessage,
        setToastMessage
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
