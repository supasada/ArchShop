import React, { useEffect, useState } from 'react';
import { api } from '../../config/supabase';

export default function VariantSizeChartManager({ variantId }) {
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await api.getVariantSizeRows(variantId);
    const cols = [];
    data.forEach((row) => {
      Object.keys(row.attributes || {}).forEach((key) => {
        if (!cols.includes(key)) cols.push(key);
      });
    });
    setRows(data.map((row) => ({ ...row, attributes: { ...row.attributes } })));
    setColumns(cols);
    setLoading(false);
  };

  useEffect(() => { load(); }, [variantId]);

  const addRow = () => {
    const sizeLabel = window.prompt('ชื่อไซส์ (เช่น S, ฟรีไซส์, 150cm):');
    if (!sizeLabel || !sizeLabel.trim()) return;
    const attributes = {};
    columns.forEach((c) => { attributes[c] = ''; });
    setRows([...rows, { id: null, size_label: sizeLabel.trim(), attributes, sort_order: rows.length }]);
  };

  const removeRow = (index) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const addColumn = () => {
    const colName = window.prompt('ชื่อคุณสมบัติ (เช่น รอบอก, ความยาว):');
    if (!colName || !colName.trim() || columns.includes(colName.trim())) return;
    const name = colName.trim();
    setColumns([...columns, name]);
    setRows(rows.map((r) => ({ ...r, attributes: { ...r.attributes, [name]: '' } })));
  };

  const removeColumn = (colName) => {
    if (!window.confirm(`ลบคอลัมน์ "${colName}" ออกจากทุกไซส์?`)) return;
    setColumns(columns.filter((c) => c !== colName));
    setRows(rows.map((r) => {
      const attrs = { ...r.attributes };
      delete attrs[colName];
      return { ...r, attributes: attrs };
    }));
  };

  const updateCell = (index, colName, value) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], attributes: { ...updated[index].attributes, [colName]: value } };
    setRows(updated);
  };

  const updateSizeLabel = (index, value) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], size_label: value };
    setRows(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const payload = { size_label: row.size_label, attributes: row.attributes, sort_order: i };
        if (row.id) {
          await api.updateVariantSizeRow(row.id, payload);
        } else {
          await api.createVariantSizeRow({ ...payload, variant_id: variantId });
        }
      }
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (row, index) => {
    if (row.id) {
      if (!window.confirm(`ลบแถวไซส์ "${row.size_label}"?`)) return;
      await api.deleteVariantSizeRow(row.id);
      load();
    } else {
      removeRow(index);
    }
  };

  if (loading) return <div className="text-xs text-zinc-400 font-mono">กำลังโหลดตารางไซส์...</div>;

  return (
    <div className="space-y-2 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
      <div className="flex items-center justify-between">
        <h6 className="font-bold text-[11px] text-zinc-700">ตารางไซส์ของตัวเลือกนี้</h6>
        <div className="flex gap-1.5">
          <button type="button" onClick={addColumn} className="px-2 py-1 rounded text-[10px] font-bold bg-zinc-200 text-zinc-700">+ คอลัมน์</button>
          <button type="button" onClick={addRow} className="px-2 py-1 rounded text-[10px] font-bold bg-zinc-200 text-zinc-700">+ ไซส์</button>
        </div>
      </div>

      {columns.length === 0 && rows.length === 0 && (
        <p className="text-[10px] text-zinc-400">ยังไม่มีตารางไซส์เฉพาะ — จะใช้ตารางไซส์กลางแทน กด "+ คอลัมน์" เพื่อเริ่มสร้าง</p>
      )}

      {(columns.length > 0 || rows.length > 0) && (
        <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="bg-zinc-900 text-white">
                <th className="py-1.5 px-2 text-left">ไซส์</th>
                {columns.map((col) => (
                  <th key={col} className="py-1.5 px-2 text-left">
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      <button type="button" onClick={() => removeColumn(col)} className="text-rose-300 hover:text-rose-100">✕</button>
                    </div>
                  </th>
                ))}
                <th className="py-1.5 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row, idx) => (
                <tr key={row.id || `new-${idx}`}>
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      value={row.size_label}
                      onChange={(e) => updateSizeLabel(idx, e.target.value)}
                      className="w-16 px-1 py-0.5 border border-zinc-200 rounded text-[11px]"
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col} className="py-1 px-2">
                      <input
                        type="text"
                        value={row.attributes[col] || ''}
                        onChange={(e) => updateCell(idx, col, e.target.value)}
                        className="w-20 px-1 py-0.5 border border-zinc-200 rounded text-[11px]"
                      />
                    </td>
                  ))}
                  <td className="py-1 px-2">
                    <button type="button" onClick={() => handleDeleteRow(row, idx)} className="text-rose-600 font-bold">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-zinc-900 text-white text-[10px] font-bold rounded disabled:opacity-40"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกตารางไซส์'}
        </button>
      )}
    </div>
  );
}
