import React, { useEffect, useState } from 'react';
import { api } from '../../config/supabase';
import { formatCurrency } from '../../utils/formatters';
import VariantSizeChartManager from './VariantSizeChartManager';

export default function VariantManager({ productId }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', price: '', stock_limit: '' });
  const [uploadingId, setUploadingId] = useState(null);
  const [expandedSizeChartId, setExpandedSizeChartId] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await api.getVariants(productId);
    setVariants(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [productId]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.price) return;
    await api.createVariant({
      product_id: productId,
      name: form.name.trim(),
      price: Number(form.price),
      stock_limit: form.stock_limit ? Number(form.stock_limit) : null,
      sort_order: variants.length
    });
    setForm({ name: '', price: '', stock_limit: '' });
    load();
  };

  const handleToggleActive = async (variant) => {
    await api.updateVariant(variant.id, { is_active: !variant.is_active });
    load();
  };

  const handleDelete = async (variant) => {
    if (!window.confirm(`ลบตัวเลือก "${variant.name}"?`)) return;
    await api.deleteVariant(variant.id);
    load();
  };

  const handleImageUpload = async (variant, file) => {
    if (!file) return;
    setUploadingId(variant.id);
    try {
      const url = await api.uploadProductImage(file, 'variant');
      await api.addVariantImage(variant.id, url, variant.images?.length || 0);
      await load();
    } finally {
      setUploadingId(null);
    }
  };

  const handleImageDelete = async (imageId) => {
    await api.deleteVariantImage(imageId);
    load();
  };

  if (loading) return <div className="text-xs text-zinc-400 font-mono">กำลังโหลดตัวเลือกสินค้า...</div>;

  return (
    <div className="space-y-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
      <h5 className="font-bold text-xs text-zinc-800">ตัวเลือกสินค้า (Variants)</h5>

      {variants.map((v) => (
        <div key={v.id} className="p-3 bg-white rounded-lg border border-zinc-200 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-sm">{v.name}</span>
              <span className="ml-2 text-xs font-mono text-zinc-500">{formatCurrency(v.price)}</span>
              {v.stock_limit != null && (
                <span className="ml-2 text-[10px] font-mono text-zinc-400">สต๊อก: {v.stock_limit}</span>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setExpandedSizeChartId(expandedSizeChartId === v.id ? null : v.id)}
                className="px-2 py-1 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700"
              >
                {expandedSizeChartId === v.id ? 'ซ่อนตารางไซส์' : 'ตารางไซส์'}
              </button>
              <button
                type="button"
                onClick={() => handleToggleActive(v)}
                className={`px-2 py-1 rounded text-[10px] font-bold ${v.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-600'}`}
              >
                {v.is_active ? 'เปิดขาย' : 'ปิดขาย'}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(v)}
                className="px-2 py-1 rounded text-[10px] font-bold bg-rose-50 text-rose-600"
              >
                ลบ
              </button>
            </div>
          </div>

          {expandedSizeChartId === v.id && (
            <VariantSizeChartManager variantId={v.id} />
          )}

          <div className="flex gap-1.5 flex-wrap">
            {(v.images || []).map((img) => (
              <div key={img.id} className="relative w-14 h-14">
                <img src={img.image_url} alt="" className="w-full h-full object-cover rounded border" />
                <button
                  type="button"
                  onClick={() => handleImageDelete(img.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] leading-4"
                >
                  ✕
                </button>
              </div>
            ))}
            <label className="w-14 h-14 border-2 border-dashed border-zinc-300 rounded flex items-center justify-center text-xs text-zinc-400 cursor-pointer">
              {uploadingId === v.id ? '...' : '+'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(v, e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
      ))}

      <div className="flex gap-2 pt-2 border-t border-zinc-200">
        <input
          type="text"
          placeholder="ชื่อตัวเลือก เช่น เสื้อผู้ชาย"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="flex-1 px-2 py-1.5 text-xs border border-zinc-300 rounded"
        />
        <input
          type="number"
          placeholder="ราคา"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="w-20 px-2 py-1.5 text-xs border border-zinc-300 rounded"
        />
        <input
          type="number"
          placeholder="สต๊อก"
          value={form.stock_limit}
          onChange={(e) => setForm({ ...form, stock_limit: e.target.value })}
          className="w-20 px-2 py-1.5 text-xs border border-zinc-300 rounded"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded"
        >
          + เพิ่ม
        </button>
      </div>
    </div>
  );
}
