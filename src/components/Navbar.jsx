import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';

export default function Navbar({ onOpenTracking, onOpenCart, onToggleAdmin, isAdminView }) {
  const { lang, setLanguage, t } = useLanguage();
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-1.5 sm:gap-4">
        
        {/* Brand */}
        <div 
          className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0 flex-1 sm:flex-initial" 
          onClick={() => isAdminView && onToggleAdmin()}
          title="smoarchcmu store"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-zinc-200 p-1 flex items-center justify-center shadow-xs hover:scale-105 transition-transform overflow-hidden shrink-0">
            <img src="/assets/logo.png" alt="smoarchcmu logo" className="w-full h-full object-contain" onError={(e)=>{e.target.src='/assets/logo.svg'}} />
          </div>
          <div className="min-w-0">
            <div className="font-display font-black text-sm sm:text-lg tracking-tight leading-none text-zinc-950 truncate">
              {t.brandTitle}
            </div>
            <div className="text-[8.5px] sm:text-[10.5px] font-mono text-zinc-500 tracking-tight leading-tight mt-0.5 truncate max-w-[130px] xs:max-w-[200px] sm:max-w-none">
              {t.brandSubtitle}
            </div>
          </div>
        </div>

        {/* Actions & Language Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">

          {/* Language Switcher */}
          <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-[10px] sm:text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setLanguage('th')}
              className={`px-1.5 sm:px-2 py-1 rounded-md transition-all ${
                lang === 'th' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
              title="ภาษาไทย"
            >
              <span className="inline sm:hidden">🇹🇭</span>
              <span className="hidden sm:inline">🇹🇭 TH</span>
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-1.5 sm:px-2 py-1 rounded-md transition-all ${
                lang === 'en' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
              title="English"
            >
              <span className="inline sm:hidden">🇬🇧</span>
              <span className="hidden sm:inline">🇬🇧 EN</span>
            </button>
            <button
              type="button"
              onClick={() => setLanguage('zh')}
              className={`px-1.5 sm:px-2 py-1 rounded-md transition-all ${
                lang === 'zh' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
              title="中文"
            >
              <span className="inline sm:hidden">🇨🇳</span>
              <span className="hidden sm:inline">🇨🇳 中文</span>
            </button>
          </div>

          {/* Shopping Cart Button */}
          {!isAdminView && (
            <button
              type="button"
              onClick={onOpenCart}
              className="relative inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-bold text-zinc-900 bg-white hover:bg-zinc-100 rounded-xl transition-all border border-zinc-300 shadow-xs active:scale-95 shrink-0"
              title={t.cartTitle || 'Shopping Cart'}
            >
              <span className="text-sm sm:text-base">🛒</span>
              <span className="hidden sm:inline font-mono">{t.cartNavBtn || 'ตะกร้า'}</span>
              {totalItems > 0 && (
                <span className="px-1.5 py-0.2 min-w-[18px] sm:min-w-[20px] h-[18px] sm:h-[20px] rounded-full bg-amber-500 text-zinc-950 font-mono font-black text-[10px] sm:text-[11px] flex items-center justify-center shadow-xs animate-pulse">
                  {totalItems}
                </span>
              )}
            </button>
          )}


          {/* Track Order Button */}
          {!isAdminView && (
            <>
              {/* Desktop/Tablet button */}
              <button
                type="button"
                onClick={onOpenTracking}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors border border-zinc-200"
                title={t.trackOrder}
              >
                <span>📦</span>
                <span>{t.trackOrder}</span>
              </button>

              {/* Mobile/Tablet icon button */}
              <button
                type="button"
                onClick={onOpenTracking}
                className="inline-flex md:hidden items-center justify-center w-8 h-8 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors border border-zinc-200"
                title={t.trackOrder}
              >
                <span>📦</span>
              </button>
            </>
          )}

          {/* Admin Toggle */}
          <button
            type="button"
            onClick={onToggleAdmin}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-white bg-zinc-900 hover:bg-black rounded-lg transition-all shadow-xs active:scale-95 shrink-0"
          >
            <span>{isAdminView ? t.storeFront : t.adminPortal}</span>
          </button>
        </div>

      </div>
    </header>
  );
}

