import React, { useState, useEffect } from 'react';
import { api } from '../config/supabase';
import { STORE_CONFIG } from '../config/storeConfig';
import { formatDateThai, formatDateToInputLocal, parseInputLocalToDate } from '../utils/formatters';

export default function DeadlineModal({ isOpen, onClose, products = [], onDeadlineSaved }) {
  const [deadlineInput, setDeadlineInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      // 1. Check localStorage first
      const saved = localStorage.getItem('arch_custom_deadline');
      let initialDate = null;

      if (saved) {
        const d = new Date(saved);
        if (!isNaN(d.getTime())) initialDate = d;
      }

      // 2. If not in localStorage, check active products
      if (!initialDate && products && products.length > 0) {
        const activeProds = products.filter(p => p.is_active !== false && p.order_deadline);
        if (activeProds.length > 0) {
          const d = new Date(activeProds[0].order_deadline);
          if (!isNaN(d.getTime())) initialDate = d;
        }
      }

      // 3. Fallback to store default
      if (!initialDate) {
        initialDate = new Date(STORE_CONFIG.faculty.defaultDeadline || '2026-08-31T23:59:59');
      }

      setDeadlineInput(formatDateToInputLocal(initialDate));
      setStatusMessage('');
    }
  }, [isOpen, products]);

  if (!isOpen) return null;

  const handleApplyPreset = (daysFromNow, endOfMonth = false, nextMonth = false, closeNow = false) => {
    const now = new Date();

    if (closeNow) {
      // Set to 1 minute in past
      const past = new Date(now.getTime() - 60000);
      setDeadlineInput(formatDateToInputLocal(past));
      return;
    }

    if (endOfMonth) {
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      setDeadlineInput(formatDateToInputLocal(lastDay));
      return;
    }

    if (nextMonth) {
      const lastDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
      setDeadlineInput(formatDateToInputLocal(lastDayNextMonth));
      return;
    }

    const target = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
    target.setHours(23, 59, 0, 0);
    setDeadlineInput(formatDateToInputLocal(target));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!deadlineInput) {
      alert('กรุณาระบุวันและเวลาที่ต้องการปิดรับจอง');
      return;
    }

    const targetDate = parseInputLocalToDate(deadlineInput);
    if (!targetDate || isNaN(targetDate.getTime())) {
      alert('รูปแบบวันและเวลาไม่ถูกต้อง กรุณาเลือกใหม่');
      return;
    }

    setSaving(true);
    setStatusMessage('กำลังบันทึกเวลาปิดรับจอง...');

    const isoDate = targetDate.toISOString();

    try {
      // 1. Save to local storage
      localStorage.setItem('arch_custom_deadline', isoDate);

      // 2. Dispatch real-time global event
      window.dispatchEvent(new CustomEvent('arch_deadline_updated', { detail: isoDate }));

      // 3. Update all products in Supabase / Local storage
      const prodsToUpdate = products && products.length > 0 ? products : await api.getProducts(false);
      if (Array.isArray(prodsToUpdate) && prodsToUpdate.length > 0) {
        for (const p of prodsToUpdate) {
          try {
            await api.updateProduct(p.id, { order_deadline: isoDate });
          } catch (err) {
            console.warn('Product deadline update notice:', err);
          }
        }
      }

      if (onDeadlineSaved) {
        onDeadlineSaved(isoDate);
      }

      setStatusMessage('✅ บันทึกเวลาปิดรับจองเรียบร้อยแล้ว!');
      setTimeout(() => {
        setSaving(false);
        onClose();
      }, 500);
    } catch (err) {
      console.error('Save deadline error:', err);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || 'กรุณาลองใหม่อีกครั้ง'));
      setSaving(false);
    }
  };

  const previewDate = parseInputLocalToDate(deadlineInput);
  const isPast = previewDate && previewDate.getTime() <= Date.now();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-5 py-4 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⏱️</span>
            <div>
              <h3 className="font-bold text-sm leading-tight">กำหนดวัน-เวลา ปิดรับสั่งจอง</h3>
              <p className="text-[10px] text-zinc-400 font-mono">COUNTDOWN DEADLINE SETTINGS</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 text-xs">
          
          {/* Current Selection & Input */}
          <div className="space-y-1.5">
            <label className="block font-bold text-zinc-800 text-xs">
              เลือกวันและเวลาปิดรับจอง (Target Date & Time):
            </label>
            <input
              type="datetime-local"
              required
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-mono text-sm focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all"
            />
            {previewDate && !isNaN(previewDate.getTime()) && (
              <div className="text-[11.5px] font-mono text-zinc-600 pt-0.5 flex items-center gap-1">
                <span>🗓️ แสดงผล:</span>
                <span className="font-bold text-zinc-900">{formatDateThai(previewDate, true)}</span>
                {isPast && <span className="text-rose-600 font-bold ml-1">(หมดเวลา/ปิดรับจอง)</span>}
              </div>
            )}
          </div>

          {/* Quick Presets */}
          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <label className="text-[11px] font-mono text-zinc-500 font-bold">⚡ ปุ่มลัดตั้งค่าด่วน (Quick Presets):</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset(3)}
                className="py-2 px-1 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-800 font-medium text-[11px] transition-all text-center"
              >
                +3 วัน (23:59)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(7)}
                className="py-2 px-1 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-800 font-medium text-[11px] transition-all text-center"
              >
                +7 วัน (23:59)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(14)}
                className="py-2 px-1 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-800 font-medium text-[11px] transition-all text-center"
              >
                +14 วัน (23:59)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(0, true)}
                className="py-2 px-1 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-800 font-medium text-[11px] transition-all text-center"
              >
                สิ้นเดือนนี้
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(0, false, true)}
                className="py-2 px-1 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-800 font-medium text-[11px] transition-all text-center"
              >
                สิ้นเดือนหน้า
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(0, false, false, true)}
                className="py-2 px-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-[11px] rounded-lg transition-all text-center"
              >
                🔴 ปิดรับทันที
              </button>
            </div>
          </div>

          {/* Info Notice */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-amber-950 text-[11px] space-y-1">
            <div className="font-bold flex items-center gap-1">
              <span>⚡ นับถอยหลังแบบเรียลไทม์ (Real-Time Sync):</span>
            </div>
            <p className="text-amber-900 leading-relaxed">
              เมื่อกดบันทึก ตัวเลขนับถอยหลังหน้าเว็บ (วัน : ชม. : นาที : วินาที) และสถานะการสั่งจองของทุกลายเสื้อจะอัปเดตตรงกันทันที
            </p>
          </div>

          {statusMessage && (
            <div className="text-center font-bold text-xs py-1 text-emerald-600 animate-pulse">
              {statusMessage}
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-zinc-900 hover:bg-black text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <span>{saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกเวลาปิดรับจอง'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs"
            >
              ยกเลิก
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
