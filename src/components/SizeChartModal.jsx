import React, { useState } from 'react';
import { STORE_CONFIG } from '../config/storeConfig';
import { useLanguage } from '../context/LanguageContext';

export default function SizeChartModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'graphic'

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 animate-pulse"></span>
            <h3 className="font-bold text-zinc-900 text-xs sm:text-sm truncate">{t.sizeChartTitle}</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-zinc-200/80 hover:bg-zinc-300 flex items-center justify-center text-zinc-700 text-xs font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* View Mode Switcher */}
        <div className="px-4 sm:px-6 pt-3 pb-1 flex items-center justify-between border-b border-zinc-100 bg-white">
          <div className="inline-flex bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span>📊 ตารางขนาด (Table)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('graphic')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'graphic' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span>🖼️ แผนผังไซส์ (Graphic)</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
            T-SHIRT UNISEX
          </span>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {viewMode === 'table' ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-xs">
                <table className="w-full border-collapse text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-zinc-900 text-white font-bold">
                      <th className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">{t.sizeCol}</th>
                      <th className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">{t.chestCol}</th>
                      <th className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">{t.lengthCol}</th>
                      <th className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">{t.sleeveCol}</th>
                      <th className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">{t.armholeCol}</th>
                      <th className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">{t.shoulderCol}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {STORE_CONFIG.sizeChart.map((row) => (
                      <tr key={row.size} className="hover:bg-zinc-50 text-center transition-colors">
                        <td className="py-3 px-3 sm:px-4 font-bold text-zinc-950 bg-zinc-50/70">{row.size}</td>
                        <td className="py-3 px-3 sm:px-4 text-zinc-900 font-bold">{row.chest}</td>
                        <td className="py-3 px-3 sm:px-4 text-zinc-700">{row.length}</td>
                        <td className="py-3 px-3 sm:px-4 text-zinc-700">{row.sleeve}</td>
                        <td className="py-3 px-3 sm:px-4 text-zinc-700">{row.armhole}</td>
                        <td className="py-3 px-3 sm:px-4 text-zinc-700">{row.shoulder}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-500 px-1">
                <span>{t.sizeUnitNote}</span>
                <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-block self-start sm:self-auto">
                  ⚠️ {t.sizeVariationNote}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-2 bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden">
              <img
                src="/assets/size_chart.jpg"
                alt="T-Shirt Unisex Size Chart"
                className="w-full max-w-md h-auto object-contain rounded-xl shadow-xs"
                onError={(e) => { e.target.src = '/assets/images/size_chart.jpg'; }}
              />
            </div>
          )}

          <div className="p-3.5 bg-zinc-50 rounded-xl sm:rounded-2xl border border-zinc-200 text-zinc-700 text-xs flex items-start gap-2.5">
            <span className="text-base">💡</span>
            <div className="text-[11.5px] leading-relaxed">
              <strong>คำแนะนำในการเลือกไซส์:</strong> ทรงเสื้อเป็นแบบ Unisex สำหรับผู้ชายและผู้หญิง หากต้องการสวมใส่แบบ Oversized แนะนำให้เผื่อไซส์ +1 ขนาดจากปกติ
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
