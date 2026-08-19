import React, { useState } from 'react';
import { formatCurrency, formatDateThai } from '../utils/formatters';

export default function ProductCard({ product, onOrderClick }) {
  const [showBack, setShowBack] = useState(false);

  const frontImg = product.image_front_url || '/assets/images/arch_shirt_front.jpg';
  const backImg = product.image_back_url || frontImg;
  const sizes = Array.isArray(product.available_sizes) ? product.available_sizes : ['S', 'M', 'L', 'XL', '2XL'];
  const deadline = formatDateThai(product.order_deadline);
  const isExpired = product.order_deadline && new Date(product.order_deadline) < new Date();

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
            <span>{showBack ? 'ดูด้านหน้า' : 'ดูด้านหลัง'}</span>
          </button>
        )}

        <div className="absolute top-3 left-3 bg-zinc-900 text-white font-mono text-xs font-bold px-3 py-1.5 rounded-lg shadow">
          {formatCurrency(product.price)}
        </div>

        {isExpired && (
          <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
            <span className="px-4 py-2 bg-rose-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg">ปิดรับการสั่งซื้อแล้ว</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-500 font-mono mb-2">
            <span>OFFICIAL EDITION</span>
            <span>ปิดรับ: {deadline}</span>
          </div>

          <h3 className="text-lg font-bold text-zinc-900 tracking-tight group-hover:text-amber-600 transition-colors">
            {product.name}
          </h3>

          <p className="text-xs text-zinc-600 line-clamp-2 mt-2 leading-relaxed">
            {product.description || 'เสื้อกิจกรรมสโมสรนักศึกษา คณะสถาปัตยกรรมศาสตร์'}
          </p>

          <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-400 mr-1">SIZES:</span>
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
            disabled={isExpired}
            className="w-full py-3 px-4 bg-zinc-900 hover:bg-black text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>สั่งซื้อเลย (Order Now)</span>
          </button>
        </div>
      </div>

    </div>
  );
}
