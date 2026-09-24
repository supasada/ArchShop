import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { api } from '../config/supabase';
import { computePricing } from '../utils/pricingEngine';
import VariantPicker from './VariantPicker';

export default function ProductSelectModal({ product, onClose, onOpenSizeChart, onOpenCart }) {
  const { t } = useLanguage();
  const { addToCart, promotions } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [showBack, setShowBack] = useState(false);

  const [variants, setVariants] = useState([]);
  const [variantQuantities, setVariantQuantities] = useState({});

  useEffect(() => {
    if (!product?.id) return;
    api.getVariants(product.id).then((list) => {
      setVariants(list);
      setVariantQuantities({});
      setVariantSizes({});
    });
  }, [product?.id]);

  const [variantCharts, setVariantCharts] = useState({}); // variantId -> size chart rows
  const hasVariants = variants.length > 0;
  const selectedVariants = variants.filter((v) => (variantQuantities[v.id] || 0) > 0);

  useEffect(() => {
    let cancelled = false;
    Promise.all(variants.map((v) => api.getVariantSizeRows(v.id).then((rows) => [v.id, rows]))).then((pairs) => {
      if (!cancelled) setVariantCharts(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, [variants]);
  const chartVariants = variants.filter((v) => (variantCharts[v.id] || []).length > 0);

  const toggleVariant = (variant) => {
    setVariantQuantities((prev) => {
      const next = { ...prev };
      if (next[variant.id]) {
        delete next[variant.id];
      } else {
        next[variant.id] = 1;
      }
      return next;
    });
  };

  const setVariantQty = (variantId, qty) => {
    setVariantQuantities((prev) => ({ ...prev, [variantId]: qty }));
  };

  // Product without variants: sizes the admin ticked. With variants: sizes come from each variant's size chart.
  const sizes = Array.isArray(product?.available_sizes) ? product.available_sizes : [];
  const sizesFor = (v) => (variantCharts[v.id] || []).map((r) => r.size_label).filter(Boolean);
  const [variantSizes, setVariantSizes] = useState({});
  const sizeOfVariant = (v) => {
    const options = sizesFor(v);
    if (options.length === 0) return '';
    return options.includes(variantSizes[v.id]) ? variantSizes[v.id] : options[0];
  };
  const colors = Array.isArray(product?.available_colors) ? product.available_colors : ['Deep Black'];

  const [size, setSize] = useState(sizes[0] || '');
  const [color, setColor] = useState(colors[0] || 'Deep Black');

  useEffect(() => {
    if (!sizes.includes(size)) setSize(sizes[0] || '');
  }, [sizes]);
  useEffect(() => {
    if (!colors.includes(color)) setColor(colors[0] || 'Deep Black');
  }, [colors]);

  if (!product) return null;

  const effectiveDeadline = product.order_deadline || (typeof localStorage !== 'undefined' ? localStorage.getItem('arch_custom_deadline') : null);
  const isExpired = Boolean(effectiveDeadline && new Date(effectiveDeadline) < new Date());
  const isClosed = product.is_active === false || isExpired;

  const unitPrice = selectedVariants.length === 1
    ? Number(selectedVariants[0].price)
    : Number(product.price) || 219;

  const previewItems = hasVariants
    ? selectedVariants.map((v) => ({ productId: product.id, variantId: v.id, price: Number(v.price), quantity: variantQuantities[v.id] }))
    : [{ productId: product.id, variantId: null, price: unitPrice, quantity }];

  const preview = computePricing(previewItems, promotions);
  const totalPrice = preview.subtotal;
  const regularPrice = preview.rawSubtotal;
  const savings = preview.discount;

  const canAdd = hasVariants ? selectedVariants.length > 0 : true;

  const displayImage =
    selectedVariants[0]?.images?.[0]?.image_url ||
    (showBack && product.image_back_url ? product.image_back_url : (product.image_front_url || '/assets/images/arch_shirt_front.jpg'));

  const handleAddToCart = () => {
    if (isClosed || !canAdd) return;
    if (hasVariants) {
      selectedVariants.forEach((v) => addToCart(product, sizeOfVariant(v), v.name, variantQuantities[v.id], v));
    } else {
      addToCart(product, size, color, quantity, null);
    }
    onClose();
  };

  const handleBuyNow = () => {
    if (isClosed || !canAdd) return;
    if (hasVariants) {
      selectedVariants.forEach((v) => addToCart(product, sizeOfVariant(v), v.name, variantQuantities[v.id], v));
    } else {
      addToCart(product, size, color, quantity, null);
    }
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
                src={displayImage}
                alt={product.name}
                className="w-full h-full object-cover transition-opacity duration-300"
                onError={(e) => { e.target.src = '/assets/images/arch_shirt_front.jpg'; }}
              />
              {selectedVariants.length === 0 && product.image_back_url && (
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
                  {formatCurrency(unitPrice)}
                </div>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed line-clamp-3">
                  {product.description || 'เสื้อกิจกรรมสโมสรนักศึกษาคณะสถาปัตยกรรมศาสตร์ มหาวิทยาลัยเชียงใหม่'}
                </p>
              </div>

              {/* Size Chart Shortcut — only variants that have a size chart */}
              {product.show_size_chart !== false && chartVariants.length > 0 && (
                <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-zinc-600 truncate">{t.unsureSize || 'ไม่แน่ใจขนาดไซส์?'}</span>
                    {chartVariants.length === 1 && (
                      <button
                        type="button"
                        onClick={() => onOpenSizeChart(chartVariants[0])}
                        className="text-xs font-bold text-zinc-900 underline hover:text-amber-600 shrink-0"
                      >
                        {t.viewSizeChartBtn || 'ตารางไซส์ ↗'}
                      </button>
                    )}
                  </div>
                  {chartVariants.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {chartVariants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => onOpenSizeChart(v)}
                          className="px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-900 hover:border-zinc-900 active:scale-95"
                        >
                          📏 {v.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selection Options */}
          <div className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-200">

            {hasVariants && (
              <VariantPicker
                variants={variants}
                quantities={variantQuantities}
                onToggle={toggleVariant}
                onQtyChange={setVariantQty}
              />
            )}

            {/* Size — per selected variant, since each variant can offer different sizes */}
            {hasVariants ? (
              selectedVariants.map((v) => {
                const options = sizesFor(v);
                if (options.length === 0) return null;
                return (
                  <div key={v.id}>
                    <label className="text-xs font-mono font-bold text-zinc-800 block mb-1.5">
                      {(t.stepSizeNoNum || 'เลือกไซส์ (Size):')} <span className="text-amber-600">{v.name}</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {options.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setVariantSizes((prev) => ({ ...prev, [v.id]: s }))}
                          className={`min-w-[44px] py-2 px-3 rounded-xl border font-mono text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                            sizeOfVariant(v) === s
                              ? 'border-black bg-black text-white shadow-xs'
                              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : sizes.length > 0 && (
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
            )}

            {/* Color — only when this product has no variants; the variant itself already determines the look */}
            {!hasVariants && (
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
            )}

            {/* Quantity — only when this product has no variants; with variants, quantity is set per-variant above */}
            {!hasVariants && (
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
            )}

          </div>

          {/* Subtotal Preview */}
          <div className="p-3.5 bg-zinc-900 text-white rounded-xl font-mono text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">{t.itemSubtotalLabel || 'ยอดรวมสินค้ารายการนี้:'}</span>
              <div className="text-right">
                {savings > 0 && (
                  <span className="text-xs text-zinc-400 line-through mr-2">{formatCurrency(regularPrice)}</span>
                )}
                <span className="font-bold text-amber-400 text-sm sm:text-base">{formatCurrency(totalPrice)}</span>
              </div>
            </div>
            {savings > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-[11px] text-emerald-400 font-bold">
                <span>🎉 {preview.appliedPromotions.map((p) => p.name).join(', ')}</span>
                <span>{t.saveAmountLabel || 'ประหยัดไป'} {formatCurrency(savings)}</span>
              </div>
            )}
            {hasVariants && !canAdd && (
              <div className="pt-1 border-t border-zinc-800 text-[11px] text-amber-300">
                💡 เลือกตัวเลือกสินค้าอย่างน้อย 1 อย่างก่อนเพิ่มลงตะกร้า
              </div>
            )}
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
                disabled={!canAdd}
                className="w-full sm:flex-1 py-3 px-4 bg-white hover:bg-zinc-100 text-zinc-900 border-2 border-zinc-900 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>🛒</span>
                <span>{t.addToCartModalBtn || 'เพิ่มลงตะกร้า (Add to Cart)'}</span>
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!canAdd}
                className="w-full sm:flex-1 py-3 px-4 bg-zinc-900 hover:bg-black text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
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
