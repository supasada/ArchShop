import React from 'react';
import { formatCurrency } from '../utils/formatters';

export default function VariantPicker({ variants, selected, onSelect }) {
  if (!variants || variants.length === 0) return null;

  return (
    <div>
      <label className="text-xs font-mono font-bold text-zinc-800 block mb-1.5">
        เลือกตัวเลือกสินค้า (Option):
      </label>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {variants.filter((v) => v.is_active).map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
              selected?.id === v.id
                ? 'border-black bg-zinc-900 text-white shadow-xs'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
            }`}
          >
            {v.name} · {formatCurrency(v.price)}
          </button>
        ))}
      </div>
    </div>
  );
}
