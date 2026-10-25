import React from 'react';
import { normalizePersonalization, formatUnit } from '../utils/personalization';

/** Read-only list of the names/numbers on one item. Customer-written: rendered as text only. */
export default function PersonalizationSummary({ units, className = '' }) {
  const list = Array.isArray(units) ? normalizePersonalization(units, units.length) : [];
  const filled = list
    .map((u, i) => ({ ...u, index: i + 1 }))
    .filter((u) => u.name || u.number);
  if (filled.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {filled.map((u) => (
        <span
          key={u.index}
          className="px-1.5 py-0.5 bg-zinc-900 text-white rounded font-mono text-[10px] font-bold"
          title={list.length > 1 ? `ตัวที่ ${u.index}` : undefined}
        >
          👕 {formatUnit(u)}
        </span>
      ))}
    </div>
  );
}
