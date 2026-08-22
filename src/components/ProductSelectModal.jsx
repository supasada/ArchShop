import React, { useState } from 'react';
import { formatCurrency } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';

export default function ProductSelectModal({ product, onClose, onOpenSizeChart, onOpenCart }) {
  const { t } = useLanguage();
  const { addToCart } = useCart();

  const sizes = Array.isArray(product?.available_sizes) ? product.available_sizes : ['S', 'M', 'L', 'XL', '2XL'];
  const colors = Array.isArray(product?.available_colors) ? product.available_colors : ['Deep Black'];

  const [size, setSize] = useState(sizes[0] || 'L');
  const [color, setColor] = useState(colors[0] || 'Deep Black');
  const [quantity, setQuantity] = useState(1);
  const [showBack, setShowBack] = useState(false);

  if (!product) return null;

  const effectiveDeadline = product.order_deadline || (typeof localStorage !== 'undefined' ? localStorage.getItem('arch_custom_deadline') : null);
  const isExpired = Boolean(effectiveDeadline && new Date(effectiveDeadline) < new Date());
  const isClosed = product.is_active === false || isExpired;

  const unitPrice = Number(product.price) || 350;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    if (isClosed) return;
    addToCart(product, size, color, quantity);
    onClose();
  };

  const handleBuyNow = () => {
    if (isClosed) return;
    addToCart(product, size, color, quantity);
    onClose();
    if (onOpenCart) onOpenCart();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <h3 className="font-bold text-zinc-900 text-sm sm:text-base truncate">{t.selectProductDetailsTitle || 'เลือกรายละเอียดสินค้า'}</h3>

          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-zinc-200/80 hover:bg-zinc-300 flex items-center justify-center text-zinc-700 text-xs font-bold transition-all active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Product Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-6">
            
            {/* Image Box */}
            <div className="sm:col-span-5 relative aspect-square bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200 shadow-xs">
              <img
                src={showBack && product.image_back_url ? product.image_back_url : (product.image_front_url || '/assets/images/arch_shirt_front.jpg')}
                alt={product.name}
                className="w-full h-full object-cover transition-opacity duration-300"
                onError={(e) => { e.target.src = '/assets/images/arch_shirt_front.jpg'; }}
              />
              {product.image_back_url && (
                <button
                  type="button"
                  onClick={() => setShowBack(!showBack)}
                  className="absolute bottom-2.5 right-2.5 px-2.5 py-1 bg-black/80 hover:bg-black text-white text-[11px] font-mono rounded-lg shadow-xs active:scale-95 transition-all"
                >
                  {showBack ? (t.viewFront || 'ดูด้านหน้า') : (t.viewBack || 'ดูด้านหลัง')}
                </button>
              )}
            </div>

            {/* Info */}
            <div className="sm:col-span-7 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 uppercase">
                  OFFICIAL MERCH 2026
                </span>
                <h4 className="font-bold text-zinc-900 text-base sm:text-lg leading-snug mt-1.5">{product.name}</h4>
                <div className="text-xl sm:text-2xl font-black font-mono text-zinc-950 mt-1">
                  {formatCurrency(product.price)}
                </div>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed line-clamp-3">
                  {product.description || 'เสื้อกิจกรรมสโมสรนักศึกษาคณะสถาปัตยกรรมศาสตร์ มหาวิทยาลัยเชียงใหม่'}
                </p>
              </div>

              {/* Size Chart Shortcut */}
              <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-zinc-600 truncate">{t.unsureSize || 'ไม่แน่ใจขนาดไซส์?'}</span>
                <button 
                  type="button" 
                  onClick={onOpenSizeChart} 
                  className="text-xs font-bold text-zinc-900 underline hover:text-amber-600 shrink-0"
                >
                  {t.viewSizeChartBtn || 'ตารางไซส์ ↗'}
                </button>
              </div>
            </div>
          </div>

          {/* Selection Options */}
          <div className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
            
            {/* 1. Size */}
            <div>
              <label className="text-xs font-mono font-bold text-zinc-800 block mb-1.5">
                {t.step1Size || '1. เลือกไซส์ (Size):'}
              </label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`min-w-[44px] py-2 px-3 rounded-xl border font-mono text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                      size === s 
                        ? 'border-black bg-black text-white shadow-xs' 
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Color */}
            <div>
              <label className="text-xs font-mono font-bold text-zinc-800 block mb-1.5">
                {t.step2Color || '2. เลือกสี (Color):'}
              </label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                      color === c 
                        ? 'border-black bg-zinc-900 text-white shadow-xs' 
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

            </div>

            {/* 3. Quantity */}
            <div>
              <label className="text-xs font-mono font-bold text-zinc-800 block mb-1.5">
                {t.step3Qty || '3. จำนวน (Quantity):'}
              </label>
              <div className="inline-flex items-center border border-zinc-200 rounded-xl bg-white overflow-hidden shadow-xs">
                <button 
                  type="button" 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))} 
                  className="w-10 h-9 sm:w-11 sm:h-10 text-zinc-600 hover:bg-zinc-100 font-bold flex items-center justify-center text-base"
                >
                  -
                </button>
                <span className="w-10 sm:w-12 text-center font-mono font-bold text-xs sm:text-sm">{quantity}</span>
                <button 
                  type="button" 
                  onClick={() => setQuantity(Math.min(20, quantity + 1))} 
                  className="w-10 h-9 sm:w-11 sm:h-10 text-zinc-600 hover:bg-zinc-100 font-bold flex items-center justify-center text-base"
                >
                  +
                </button>
              </div>
            </div>

          </div>

          {/* Subtotal Preview */}
          <div className="flex items-center justify-between p-3.5 bg-zinc-900 text-white rounded-xl font-mono text-xs">
            <span className="text-zinc-300">{t.itemSubtotalLabel || 'ยอดรวมสินค้ารายการนี้:'}</span>
            <span className="font-bold text-amber-400 text-sm sm:text-base">{formatCurrency(totalPrice)}</span>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row items-center gap-2 shrink-0">
          {isClosed ? (
            <div className="w-full p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold text-center">
              {t.closedNotice || '🔴 ปิดรับการสั่งจองเสื้อรอบนี้แล้ว'}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleAddToCart}
                className="w-full sm:flex-1 py-3 px-4 bg-white hover:bg-zinc-100 text-zinc-900 border-2 border-zinc-900 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98]"
              >
                <span>🛒</span>
                <span>{t.addToCartModalBtn || 'เพิ่มลงตะกร้า (Add to Cart)'}</span>
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                className="w-full sm:flex-1 py-3 px-4 bg-zinc-900 hover:bg-black text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              >
                <span>💳</span>
                <span>{t.checkoutNowBtn || 'ชำระเงินทันที (Checkout)'}</span>
              </button>
            </>
          )}
        </div>


      </div>
    </div>
  );
}
