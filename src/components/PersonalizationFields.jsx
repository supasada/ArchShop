import React from 'react';
import {
  resizePersonalization, sanitizeNameInput, sanitizeNumberInput, NAME_MAX_LENGTH, NUMBER_MAX_LENGTH
} from '../utils/personalization';

/**
 * Required name/number for each unit (quantity 3 → 3 pairs), with a plain text preview.
 * Values are customer-written and are only ever rendered as text.
 */
export default function PersonalizationFields({ quantity, value, onChange, title, compact = false }) {
  const units = resizePersonalization(value, quantity);

  const setUnit = (index, field, raw) => {
    const next = units.map((u, i) => (i === index
      ? { ...u, [field]: field === 'name' ? sanitizeNameInput(raw) : sanitizeNumberInput(raw) }
      : u));
    onChange(next);
  };

  if (units.length === 0) return null;

  return (
    <div className={`space-y-2 ${compact ? '' : 'p-3 bg-white rounded-xl border border-zinc-200'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <span className="text-xs font-mono font-bold text-zinc-800">
          👕 {title || 'ชื่อ/เบอร์บนเสื้อ'} <span className="text-rose-600">*</span>
        </span>
        <span className="text-[10.5px] text-zinc-500">ชื่อไม่เกิน {NAME_MAX_LENGTH} ตัวอักษร · เบอร์เป็นตัวเลขไม่เกิน {NUMBER_MAX_LENGTH} หลัก</span>
      </div>
      {units.map((u, i) => (
        <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {units.length > 1 && (
            <span className="text-[10.5px] font-mono text-zinc-500 w-12 shrink-0">ตัวที่ {i + 1}</span>
          )}
          <input
            type="text"
            value={u.name}
            onChange={(e) => setUnit(i, 'name', e.target.value)}
            placeholder="ชื่อบนเสื้อ"
            aria-label={`ชื่อบนเสื้อ ตัวที่ ${i + 1}`}
            autoComplete="off"
            className="flex-1 min-w-[120px] px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          <input
            type="text"
            inputMode="numeric"
            value={u.number}
            onChange={(e) => setUnit(i, 'number', e.target.value)}
            placeholder="เบอร์"
            aria-label={`เบอร์ ตัวที่ ${i + 1}`}
            autoComplete="off"
            className="w-16 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-center focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          {/* Simple text preview of the back of the shirt */}
          <div className="w-24 shrink-0 h-12 rounded-lg bg-zinc-900 text-white flex flex-col items-center justify-center overflow-hidden px-1" title="ตัวอย่างข้อความบนเสื้อ">
            <span className={`text-[10px] font-bold leading-tight truncate max-w-full ${u.name.trim() ? '' : 'text-zinc-600'}`}>{u.name.trim() || 'NAME'}</span>
            <span className={`text-base font-black font-mono leading-none ${u.number ? '' : 'text-zinc-600'}`}>{u.number || '00'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
