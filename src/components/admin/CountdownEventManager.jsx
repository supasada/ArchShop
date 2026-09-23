import React, { useEffect, useState } from 'react';
import { api } from '../../config/supabase';
import { formatDateToInputLocal, parseInputLocalToDate, formatDateThai } from '../../utils/formatters';

const emptyForm = { title: '', target_at: '' };

export default function CountdownEventManager() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await api.getCountdownEvents();
    setEvents(data);
    setLoading(false);
  };

  const reloadQuiet = async () => {
    const data = await api.getCountdownEvents();
    setEvents(data);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const sub = api.subscribeTable('countdown_events', reloadQuiet);
    return () => sub.unsubscribe();
  }, []);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const handleSave = async () => {
    if (!form.title.trim() || !form.target_at) return;
    const payload = {
      title: form.title.trim(),
      target_at: parseInputLocalToDate(form.target_at).toISOString()
    };
    if (editingId) {
      await api.updateCountdownEvent(editingId, payload);
    } else {
      await api.createCountdownEvent({ ...payload, sort_order: events.length });
    }
    resetForm();
    load();
  };

  const handleEdit = (ev) => {
    setEditingId(ev.id);
    setForm({ title: ev.title, target_at: formatDateToInputLocal(ev.target_at) });
  };

  const handleToggleActive = async (ev) => {
    await api.updateCountdownEvent(ev.id, { is_active: !ev.is_active });
    load();
  };

  const handleDelete = async (ev) => {
    if (!window.confirm(`ลบอีเว้นต์ "${ev.title}"?`)) return;
    await api.deleteCountdownEvent(ev.id);
    load();
  };

  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= events.length) return;
    const a = events[index];
    const b = events[target];
    await Promise.all([
      api.updateCountdownEvent(a.id, { sort_order: b.sort_order }),
      api.updateCountdownEvent(b.id, { sort_order: a.sort_order })
    ]);
    load();
  };

  if (loading) return <div className="text-xs text-zinc-400 font-mono">กำลังโหลดอีเว้นต์นับถอยหลัง...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
        <h3 className="font-bold text-zinc-900">จัดการอีเว้นต์นับถอยหลัง (Countdown Events)</h3>
        <p className="text-xs text-zinc-500">สร้างได้หลายอีเว้นต์พร้อมกัน แสดงในหน้าร้านใต้กล่องนับถอยหลังหลัก</p>
      </div>

      <div className="space-y-2">
        {events.map((ev, idx) => (
          <div key={ev.id} className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-bold text-sm truncate">{ev.title}</span>
              <div className="text-[11px] font-mono text-zinc-500">{formatDateThai(ev.target_at, true)}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="px-1.5 py-1 rounded bg-zinc-100 text-zinc-700 disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(idx, 1)} disabled={idx === events.length - 1} className="px-1.5 py-1 rounded bg-zinc-100 text-zinc-700 disabled:opacity-30">↓</button>
              <button
                type="button"
                onClick={() => handleToggleActive(ev)}
                className={`px-2 py-1 rounded text-[10px] font-bold ${ev.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-600'}`}
              >
                {ev.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </button>
              <button type="button" onClick={() => handleEdit(ev)} className="px-2.5 py-1 bg-zinc-100 rounded text-xs font-bold">แก้ไข</button>
              <button type="button" onClick={() => handleDelete(ev)} className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded text-xs font-bold">ลบ</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-zinc-200 space-y-3">
        <h4 className="font-bold text-xs">{editingId ? 'แก้ไขอีเว้นต์' : 'สร้างอีเว้นต์ใหม่'}</h4>
        <input
          type="text"
          placeholder="ชื่ออีเว้นต์ เช่น ปิดรับสั่งจองรอบ 1"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
        />
        <input
          type="datetime-local"
          value={form.target_at}
          onChange={(e) => setForm({ ...form, target_at: e.target.value })}
          className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded font-mono"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.title.trim() || !form.target_at}
            className="flex-1 py-2 bg-zinc-900 text-white text-xs font-bold rounded disabled:opacity-40"
          >
            {editingId ? 'บันทึกการแก้ไข' : 'สร้างอีเว้นต์'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-zinc-100 text-xs font-bold rounded">ยกเลิก</button>
          )}
        </div>
      </div>
    </div>
  );
}
