import React from 'react';
import { formatCurrency } from '../utils/formatters';

export default function VariantPicker({ variants, quantities, onToggle, onQtyChange }) {
  if (!variants || variants.length === 0) return null;

  return (
    <div>
      <label className="text-xs font-mono font-bold text-zinc-800 block mb-1.5">
        เลือกตัวเลือกสินค้า (เลือกได้มากกว่า 1):
      </label>
      <div className="space-y-1.5">
        {variants.filter((v) => v.is_active).map((v) => {
          const qty = quantities[v.id] || 0;
          const selected = qty > 0;
          return (
            <div
              key={v.id}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all ${
                selected ? 'border-black bg-zinc-900 text-white shadow-xs' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
              }`}
            >
              <button
                type="button"
                onClick={() => onToggle(v)}
                className="flex-1 text-left text-xs font-bold min-w-0 truncate"
              >
                {selected ? '✓ ' : ''}{v.name} · {formatCurrency(v.price)}
              </button>
              {selected && (
                <div className={`inline-flex items-center border rounded-lg overflow-hidden shrink-0 ${selected ? 'border-zinc-700' : 'border-zinc-200'}`}>
                  <button
                    type="button"
                    onClick={() => onQtyChange(v.id, Math.max(1, qty - 1))}
                    className="w-7 h-7 text-xs font-bold hover:bg-white/10 flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-xs font-mono font-bold">{qty}</span>
                  <button
                    type="button"
                    onClick={() => onQtyChange(v.id, Math.min(20, qty + 1))}
                    className="w-7 h-7 text-xs font-bold hover:bg-white/10 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
