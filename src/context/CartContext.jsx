import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const local = localStorage.getItem('archshop_cart_items');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });

  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem('archshop_cart_items', JSON.stringify(cartItems));
    } catch (e) {
      console.warn('Failed to save cart to localStorage:', e);
    }
  }, [cartItems]);

  const addToCart = (product, size, color, quantity = 1) => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const chosenSize = size || 'L';
    const chosenColor = color || (product.available_colors?.[0] || 'Deep Black');
    const itemKey = `${product.id}_${chosenSize}_${chosenColor}`;

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => item.key === itemKey);
      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.min(20, updated[existingIndex].quantity + qty)
        };
        return updated;
      } else {
        const newItem = {
          cartId: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          key: itemKey,
          productId: product.id,
          productName: product.name,
          price: Number(product.price) || 350,
          size: chosenSize,
          color: chosenColor,
          quantity: qty,
          imageFrontUrl: product.image_front_url || '/assets/images/arch_shirt_front.jpg',
          imageBackUrl: product.image_back_url,
          deadline: product.order_deadline
        };
        return [...prevItems, newItem];
      }
    });

    // Show temporary toast
    showToast(`🛒 เพิ่ม ${product.name} (ไซส์ ${chosenSize}) ลงตะกร้าแล้ว`);
  };


  const updateQuantity = (cartId, newQty) => {
    const qty = Math.max(1, Math.min(20, parseInt(newQty, 10) || 1));
    setCartItems((prevItems) =>
      prevItems.map((item) => (item.cartId === cartId ? { ...item, quantity: qty } : item))
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
  const subtotal = cartItems.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalItems,
        subtotal,
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
