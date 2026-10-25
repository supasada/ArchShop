import React, { useEffect, useState } from 'react';
import { api } from '../../config/supabase';
import { debounce, REALTIME_DEBOUNCE_MS } from '../../utils/debounce';
import { formatCurrency } from '../../utils/formatters';
import VariantSizeChartManager from './VariantSizeChartManager';
import {
  indexSoldCounts, soldFor, normalizeSizeLimits, sizeLimitsFromInputs, sizeLimitInputs,
  parseLimitInput, soldOfLimitText, isMissingStockColumn
} from '../../utils/stock';

// Per-variant stock: total limit + one limit per size (sizes = the variant's size chart rows,
// the same sizes the storefront offers). Blank = unlimited. Shows sold / limit from get_sold_counts.
function VariantStockEditor({ variant, sold, onSaved }) {
  const [sizes, setSizes] = useState(null); // null = loading
  const [total, setTotal] = useState(variant.stock_limit != null ? String(variant.stock_limit) : '');
  const [inputs, setInputs] = useState(() => sizeLimitInputs(variant.size_stock_limits));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getVariantSizeRows(variant.id).then((rows) => {
      if (!cancelled) setSizes((rows || []).map((r) => r.size_label).filter(Boolean));
    });
    return () => { cancelled = true; };
  }, [variant.id]);

  const target = { productId: variant.product_id, variantId: variant.id };
  const limits = normalizeSizeLimits(variant.size_stock_limits);

  const handleSave = async () => {
    const totalLimit = parseLimitInput(total);
    if (total.trim() !== '' && totalLimit === null) return alert('สต๊อกรวมต้องเป็นจำนวนเต็ม 0 ขึ้นไป หรือเว้นว่าง (ไม่จำกัด)');
    const bad = (sizes || []).find((s) => (inputs[s] || '').trim() !== '' && parseLimitInput(inputs[s]) === null);
    if (bad) return alert(`สต๊อกไซส์ ${bad} ต้องเป็นจำนวนเต็ม 0 ขึ้นไป หรือเว้นว่าง (ไม่จำกัด)`);
    const sizeLimits = sizeLimitsFromInputs(inputs, sizes || []);
    const updates = { stock_limit: totalLimit };
    // only send the new column when it exists (migration 0015) or is in use
    if (sizeLimits || 'size_stock_limits' in variant) updates.size_stock_limits = sizeLimits;
    setSaving(true);
    try {
      await api.updateVariant(variant.id, updates);
      onSaved();
    } catch (err) {
      alert('บันทึกสต๊อกไม่สำเร็จ: ' + err.message + (isMissingStockColumn(err)
        ? '\n\nฐานข้อมูลยังไม่มีคอลัมน์ size_stock_limits — กรุณารัน supabase/migrations/0015_size_stock_limits.sql ก่อน'
        : ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 space-y-2 text-[11px]">
      {!sold && (
        <div className="text-amber-700">ยังดูยอดขายไม่ได้ (รัน migration 0015 ก่อน) — สต๊อกจะยังไม่ถูกบังคับใช้หน้าร้าน</div>
      )}
      <div className="flex items-center gap-2">
        <span className="font-bold text-zinc-700 w-24 shrink-0">สต๊อกรวม</span>
        <input
          type="number"
          min="0"
          placeholder="ไม่จำกัด"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          className="w-20 px-2 py-1 border border-zinc-300 rounded font-mono"
        />
        {sold && <span className="font-mono text-zinc-500">{soldOfLimitText(soldFor(sold, target).total, variant.stock_limit)}</span>}
      </div>
      {sizes === null ? (
        <div className="text-zinc-400 font-mono">กำลังโหลดไซส์...</div>
      ) : sizes.length === 0 ? (
        <div className="text-zinc-500">ยังไม่มีไซส์ — เพิ่มไซส์ใน "ตารางไซส์" ก่อน จึงจะกำหนดสต๊อกรายไซส์ได้</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {sizes.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className="font-mono font-bold text-zinc-700 w-12 shrink-0 truncate" title={s}>{s}</span>
              <input
                type="number"
                min="0"
                placeholder="ไม่จำกัด"
                value={inputs[s] ?? ''}
                onChange={(e) => setInputs({ ...inputs, [s]: e.target.value })}
                className="w-20 px-2 py-1 border border-zinc-300 rounded font-mono"
              />
              {sold && <span className="font-mono text-zinc-500 truncate">{soldOfLimitText(soldFor(sold, { ...target, size: s }).size, limits[s] ?? null)}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-zinc-400">เว้นว่าง = ไม่จำกัด · นับทุกออร์เดอร์ที่ไม่ถูกปฏิเสธ</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || sizes === null}
          className="px-3 py-1 bg-zinc-900 text-white font-bold rounded disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกสต๊อก'}
        </button>
      </div>
    </div>
  );
}

export default function VariantManager({ productId }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', price: '', stock_limit: '' });
  const [uploadingId, setUploadingId] = useState(null);
  const [expandedSizeChartId, setExpandedSizeChartId] = useState(null);
  const [expandedStockId, setExpandedStockId] = useState(null);
  const [sold, setSold] = useState(null); // get_sold_counts index; null = unavailable

  const loadSold = () => api.getSoldCounts().then((rows) => setSold(indexSoldCounts(rows)));

  const load = async () => {
    setLoading(true);
    const data = await api.getVariants(productId);
    setVariants(data);
    setLoading(false);
  };

  const reloadQuiet = async () => {
    const data = await api.getVariants(productId);
    setVariants(data);
  };

  useEffect(() => { load(); loadSold(); }, [productId]);


  useEffect(() => {
    const reload = debounce(reloadQuiet, REALTIME_DEBOUNCE_MS);
    const subs = [
      api.subscribeTable('product_variants', reload),
      api.subscribeTable('product_variant_images', reload)
    ];
    return () => { reload.cancel(); subs.forEach((s) => s.unsubscribe()); };
  }, [productId]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.price) return;
    await api.createVariant({
      product_id: productId,
      name: form.name.trim(),
      price: Number(form.price),
      stock_limit: form.stock_limit ? Number(form.stock_limit) : null,
      available_sizes: [],
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
                <span className="ml-2 text-[10px] font-mono text-zinc-400">
                  สต๊อก: {sold ? `${soldFor(sold, { productId: v.product_id, variantId: v.id }).total} / ` : ''}{v.stock_limit}
                </span>
              )}
              {Object.keys(normalizeSizeLimits(v.size_stock_limits)).length > 0 && (
                <span className="ml-2 text-[10px] font-mono text-zinc-400">จำกัดรายไซส์</span>
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
                onClick={() => {
                  const next = expandedStockId === v.id ? null : v.id;
                  setExpandedStockId(next);
                  if (next) loadSold();
                }}
                className="px-2 py-1 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700"
              >
                {expandedStockId === v.id ? 'ซ่อนสต๊อก' : 'สต๊อก'}
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

          {expandedStockId === v.id && (
            <VariantStockEditor
              key={`${v.id}-${v.stock_limit}-${JSON.stringify(v.size_stock_limits ?? null)}`}
              variant={v}
              sold={sold}
              onSaved={() => { reloadQuiet(); loadSold(); }}
            />
          )}

          <div className="flex gap-1.5 flex-wrap">
            {(v.images || []).map((img) => (
              <div key={img.id} className="relative w-14 h-14">
                <img loading="lazy" decoding="async" src={img.image_url} alt="" className="w-full h-full object-cover rounded border" />
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
          placeholder="สต๊อกรวม"
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
