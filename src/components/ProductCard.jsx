import React, { useState } from 'react';
import { formatCurrency, formatDateThai } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';

export default function ProductCard({ product, onOrderClick }) {
  const { t, lang } = useLanguage();
  const [showBack, setShowBack] = useState(false);

  const frontImg = product.image_front_url || '/assets/images/arch_shirt_front.jpg';
  const backImg = product.image_back_url || frontImg;
  const sizes = Array.isArray(product.available_sizes) ? product.available_sizes : ['S', 'M', 'L', 'XL', '2XL'];
  
  const effectiveDeadline = product.order_deadline || localStorage.getItem('arch_custom_deadline');

  const formattedDeadline = effectiveDeadline ? (
    lang === 'en' 
      ? new Date(effectiveDeadline).toLocaleDateString('en-US')
      : lang === 'zh'
      ? new Date(effectiveDeadline).toLocaleDateString('zh-CN')
      : formatDateThai(effectiveDeadline)
  ) : '-';

  const isExpired = Boolean(effectiveDeadline && new Date(effectiveDeadline) < new Date());
  const isClosed = product.is_active === false || isExpired;


  return (
    <div className="arch-card-interactive bg-white rounded-2xl overflow-hidden flex flex-col group border border-zinc-200">
      
      {/* Image Flip Box */}
      <div className="relative aspect-square bg-zinc-100 overflow-hidden border-b border-zinc-100">
        <img
          src={showBack ? backImg : frontImg}
          alt={product.name}
          className="w-full h-full object-cover transition-opacity duration-300"
          onError={(e) => { e.target.src = '/assets/images/arch_shirt_front.jpg'; }}
        />

        {product.image_back_url && (
          <button
            type="button"
            onClick={() => setShowBack(!showBack)}
            className="absolute bottom-3 right-3 z-10 px-3 py-1.5 bg-black/80 hover:bg-black text-white text-xs font-mono rounded-lg flex items-center gap-1.5 shadow-sm transition-transform active:scale-95"
          >
            <span>{showBack ? t.viewFront : t.viewBack}</span>
          </button>
        )}

        <div className="absolute top-3 left-3 bg-zinc-900 text-white font-mono text-xs font-bold px-3 py-1.5 rounded-lg shadow">
          {formatCurrency(product.price)}
        </div>

        {isClosed && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4 text-center">
            <span className="px-4 py-2 bg-rose-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg animate-pulse">
              🔴 ปิดรับการสั่งจองเสื้อรอบนี้แล้ว
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-500 font-mono mb-2">
            <span>OFFICIAL MERCH</span>
            {product.order_deadline && <span>{t.deadlinePrefix} {formattedDeadline}</span>}
          </div>

          <h3 className="text-lg font-bold text-zinc-900 tracking-tight group-hover:text-amber-600 transition-colors">
            {product.name}
          </h3>

          <p className="text-xs text-zinc-600 line-clamp-2 mt-2 leading-relaxed">
            {product.description || 'OFFICIAL MERCHANDISE // ARCH CMU 2026'}
          </p>

          <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-400 mr-1">{t.selectSizeLabel}:</span>
            {sizes.map((s) => (
              <span key={s} className="text-[11px] font-mono px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded border border-zinc-200">
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => onOrderClick(product)}
            disabled={isClosed}
            className={`w-full py-3 px-4 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all duration-200 ${
              isClosed
                ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed border border-zinc-300'
                : 'bg-zinc-900 hover:bg-black text-white hover:shadow-md active:scale-[0.99]'
            }`}
          >
            <span>🛒</span>
            <span>{isClosed ? '🔴 ปิดรับจองแล้ว (Closed)' : (t.addToCartBtn || 'เลือกไซส์ & เพิ่มลงตะกร้า')}</span>
          </button>
        </div>
      </div>


    </div>
  );
}
