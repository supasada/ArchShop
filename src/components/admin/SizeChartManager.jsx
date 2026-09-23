import React, { useEffect, useState } from 'react';
import { api } from '../../config/supabase';

const emptyForm = { size: '', chest: '', length: '', sleeve: '', armhole: '', shoulder: '' };

export default function SizeChartManager() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await api.getSizeChart();
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const handleSave = async () => {
    if (!form.size.trim()) return;
    if (editingId) {
      await api.updateSizeChartRow(editingId, form);
    } else {
      await api.createSizeChartRow({ ...form, sort_order: rows.length });
    }
    resetForm();
    load();
  };

  const handleEdit = (row) => {
    setEditingId(row.id);
    setForm({
      size: row.size, chest: row.chest, length: row.length,
      sleeve: row.sleeve, armhole: row.armhole, shoulder: row.shoulder
    });
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`ลบแถวไซส์ "${row.size}"?`)) return;
    await api.deleteSizeChartRow(row.id);
    load();
  };

  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index];
    const b = rows[target];
    await Promise.all([
      api.updateSizeChartRow(a.id, { sort_order: b.sort_order }),
      api.updateSizeChartRow(b.id, { sort_order: a.sort_order })
    ]);
    load();
  };

  if (loading) return <div className="text-xs text-zinc-400 font-mono">กำลังโหลดตารางไซส์...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
        <h3 className="font-bold text-zinc-900">จัดการตารางไซส์ (Size Chart)</h3>
        <p className="text-xs text-zinc-500">แก้ไขขนาดสัดส่วนที่แสดงในหน้าร้าน (ตารางไซส์)</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="bg-zinc-900 text-white font-bold">
              <th className="py-2.5 px-3 text-center">ไซส์</th>
              <th className="py-2.5 px-3 text-center">รอบอก</th>
              <th className="py-2.5 px-3 text-center">ความยาว</th>
              <th className="py-2.5 px-3 text-center">แขน</th>
              <th className="py-2.5 px-3 text-center">วงแขน</th>
              <th className="py-2.5 px-3 text-center">ไหล่</th>
              <th className="py-2.5 px-3 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row, idx) => (
              <tr key={row.id} className="text-center hover:bg-zinc-50">
                <td className="py-2 px-3 font-bold">{row.size}</td>
                <td className="py-2 px-3">{row.chest}</td>
                <td className="py-2 px-3">{row.length}</td>
                <td className="py-2 px-3">{row.sleeve}</td>
                <td className="py-2 px-3">{row.armhole}</td>
                <td className="py-2 px-3">{row.shoulder}</td>
                <td className="py-2 px-3">
                  <div className="flex items-center justify-center gap-1">
                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => handleEdit(row)} className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-bold">แก้ไข</button>
                    <button type="button" onClick={() => handleDelete(row)} className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 font-bold">ลบ</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-zinc-200 space-y-3">
        <h4 className="font-bold text-xs">{editingId ? 'แก้ไขแถวไซส์' : 'เพิ่มแถวไซส์ใหม่'}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input type="text" placeholder="ไซส์ (S, M, L...)" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="px-2.5 py-1.5 text-xs border border-zinc-300 rounded" />
          <input type="text" placeholder="รอบอก" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} className="px-2.5 py-1.5 text-xs border border-zinc-300 rounded" />
          <input type="text" placeholder="ความยาว" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} className="px-2.5 py-1.5 text-xs border border-zinc-300 rounded" />
          <input type="text" placeholder="แขน" value={form.sleeve} onChange={(e) => setForm({ ...form, sleeve: e.target.value })} className="px-2.5 py-1.5 text-xs border border-zinc-300 rounded" />
          <input type="text" placeholder="วงแขน" value={form.armhole} onChange={(e) => setForm({ ...form, armhole: e.target.value })} className="px-2.5 py-1.5 text-xs border border-zinc-300 rounded" />
          <input type="text" placeholder="ไหล่" value={form.shoulder} onChange={(e) => setForm({ ...form, shoulder: e.target.value })} className="px-2.5 py-1.5 text-xs border border-zinc-300 rounded" />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.size.trim()}
            className="flex-1 py-2 bg-zinc-900 text-white text-xs font-bold rounded disabled:opacity-40"
          >
            {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มแถว'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-zinc-100 text-xs font-bold rounded">ยกเลิก</button>
          )}
        </div>
      </div>
    </div>
  );
}
