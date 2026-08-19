import React from 'react';
import { isLiveSupabase } from '../config/supabase';
import { STORE_CONFIG } from '../config/storeConfig';

export default function Navbar({ onOpenTracking, onToggleAdmin, isAdminView }) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => isAdminView && onToggleAdmin()}>
          <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 p-1 flex items-center justify-center shadow-xs hover:scale-105 transition-transform overflow-hidden">
            <img src="/assets/logo.png" alt="Arch Club Logo" className="w-full h-full object-contain" onError={(e)=>{e.target.src='/assets/logo.svg'}} />
          </div>
          <div>
            <div className="font-display font-black text-base sm:text-lg tracking-tight leading-none text-zinc-950">
              smoarchcmu
            </div>
            <div className="text-[9.5px] sm:text-[10.5px] font-mono text-zinc-500 tracking-tight leading-tight mt-0.5 max-w-[260px] sm:max-w-none">
              STUDENT UNION FACULTY OF ARCHITECTURE CHIANG MAI UNIVERSITY
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">

          {/* Track Order */}
          {!isAdminView && (
            <button
              type="button"
              onClick={onOpenTracking}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              <span>เช็คสถานะคำสั่งซื้อ</span>
            </button>
          )}

          {/* Admin Toggle */}
          <button
            type="button"
            onClick={onToggleAdmin}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-black rounded-lg transition-all shadow-sm active:scale-95"
          >
            <span>{isAdminView ? 'หน้าร้านค้า' : 'Admin Portal'}</span>
          </button>
        </div>

      </div>
    </header>
  );
}
