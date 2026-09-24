import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../config/supabase';

export default function SizeChartModal({ isOpen, onClose, variant }) {
  const { t } = useLanguage();
  const [variantRows, setVariantRows] = useState([]);
  const [variantColumns, setVariantColumns] = useState([]);

  useEffect(() => {
    if (!isOpen || !variant?.id) {
      setVariantRows([]);
      setVariantColumns([]);
      return;
    }
    let cancelled = false;
    const load = () => api.getVariantSizeRows(variant.id).then((rows) => {
      if (cancelled) return;
      const cols = [];
      rows.forEach((row) => {
        Object.keys(row.attributes || {}).forEach((key) => {
          if (!cols.includes(key)) cols.push(key);
        });
      });
      setVariantRows(rows);
      setVariantColumns(cols);
    });
    load();
    const sub = api.subscribeTable('variant_size_rows', load);
    return () => { cancelled = true; sub.unsubscribe(); };
  }, [isOpen, variant?.id]);

  if (!isOpen) return null;

  const usingVariantChart = variantRows.length > 0 && variantColumns.length > 0;

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

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">

          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-xs">
              {usingVariantChart ? (
                <table className="w-full border-collapse text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-zinc-900 text-white font-bold">
                      <th className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">{t.sizeCol}</th>
                      {variantColumns.map((col) => (
                        <th key={col} className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {variantRows.map((row) => (
                      <tr key={row.id} className="hover:bg-zinc-50 text-center transition-colors">
                        <td className="py-3 px-3 sm:px-4 font-bold text-zinc-950 bg-zinc-50/70">{row.size_label}</td>
                        {variantColumns.map((col) => (
                          <td key={col} className="py-3 px-3 sm:px-4 text-zinc-700">{row.attributes?.[col] || '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-xs font-mono text-zinc-500">ยังไม่มีตารางไซส์สำหรับตัวเลือกนี้</div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-500 px-1">
              <span>{t.sizeUnitNote}</span>
              <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-block self-start sm:self-auto">
                ⚠️ {t.sizeVariationNote}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-zinc-50 rounded-xl sm:rounded-2xl border border-zinc-200 text-zinc-700 text-xs flex items-start gap-2.5">
            <span className="text-base">💡</span>
            <div className="text-[11.5px] leading-relaxed">
              <strong>{t.sizeChartTipTitle || 'คำแนะนำในการเลือกไซส์:'}</strong> {t.sizeChartTipDesc || 'ทรงเสื้อเป็นแบบ Unisex สำหรับผู้ชายและผู้หญิง หากต้องการสวมใส่แบบ Oversized แนะนำให้เผื่อไซส์ +1 ขนาดจากปกติ'}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
