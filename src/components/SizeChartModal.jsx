import React from 'react';
import { STORE_CONFIG } from '../config/storeConfig';
import { useLanguage } from '../context/LanguageContext';

export default function SizeChartModal({ isOpen, onClose }) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden">
        
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
          <h3 className="font-bold text-zinc-900 text-sm">{t.sizeChartTitle}</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
        </div>

        <div className="p-6">
          <p className="text-xs text-zinc-500 mb-4">
            {t.sizeUnitNote}
          </p>

          <table className="w-full border-collapse border border-zinc-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-zinc-900 text-white font-mono text-xs">
                <th className="py-2.5 px-4 text-center">{t.sizeCol}</th>
                <th className="py-2.5 px-4 text-center">{t.chestCol}</th>
                <th className="py-2.5 px-4 text-center">{t.lengthCol}</th>
                <th className="py-2.5 px-4 text-center">{t.shoulderCol}</th>
              </tr>
            </thead>
            <tbody>
              {STORE_CONFIG.sizeChart.map((row) => (
                <tr key={row.size} className="border-b border-zinc-100 text-center font-mono text-xs">
                  <td className="py-2.5 px-4 font-bold text-zinc-900 bg-zinc-50">{row.size}</td>
                  <td className="py-2.5 px-4 text-zinc-700">{row.chest}</td>
                  <td className="py-2.5 px-4 text-zinc-700">{row.length}</td>
                  <td className="py-2.5 px-4 text-zinc-700">{row.shoulder}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
            💡 <strong>Tip:</strong> Sizing recommendation: If you prefer an oversized streetwear fit, choose +1 size up.
          </div>
        </div>

      </div>
    </div>
  );
}
