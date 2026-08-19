import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Navbar({ onOpenTracking, onToggleAdmin, isAdminView }) {
  const { lang, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => isAdminView && onToggleAdmin()}>
          <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 p-1 flex items-center justify-center shadow-xs hover:scale-105 transition-transform overflow-hidden shrink-0">
            <img src="/assets/logo.png" alt="smoarchcmu logo" className="w-full h-full object-contain" onError={(e)=>{e.target.src='/assets/logo.svg'}} />
          </div>
          <div>
            <div className="font-display font-black text-base sm:text-lg tracking-tight leading-none text-zinc-950">
              {t.brandTitle}
            </div>
            <div className="text-[9px] sm:text-[10.5px] font-mono text-zinc-500 tracking-tight leading-tight mt-0.5 max-w-[220px] sm:max-w-none truncate sm:whitespace-normal">
              {t.brandSubtitle}
            </div>
          </div>
        </div>

        {/* Actions & Language Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Language Switcher */}
          <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setLanguage('th')}
              className={`px-2 py-1 rounded-md transition-all ${
                lang === 'th' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
              title="ภาษาไทย"
            >
              🇹🇭 TH
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded-md transition-all ${
                lang === 'en' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
              title="English"
            >
              🇬🇧 EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('zh')}
              className={`px-2 py-1 rounded-md transition-all ${
                lang === 'zh' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
              title="中文"
            >
              🇨🇳 中文
            </button>
          </div>

          {/* Track Order */}
          {!isAdminView && (
            <button
              type="button"
              onClick={onOpenTracking}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              <span>{t.trackOrder}</span>
            </button>
          )}

          {/* Admin Toggle */}
          <button
            type="button"
            onClick={onToggleAdmin}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-black rounded-lg transition-all shadow-sm active:scale-95 shrink-0"
          >
            <span>{isAdminView ? t.storeFront : t.adminPortal}</span>
          </button>
        </div>

      </div>
    </header>
  );
}
