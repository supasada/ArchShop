import React, { useEffect, useState } from 'react';
import { api } from '../../config/supabase';

const emptyForm = {
  name: '', type: 'quantity_break', is_active: true, priority: 0,
  applies_to_all: true, quantity: 2, bundle_price: '',
  discount_type: 'fixed_amount', discount_value: '',
  scope_variant_ids: [], bundle_items: []
};

export default function PromotionManager({ products }) {
  const [promotions, setPromotions] = useState([]);
  const [allVariants, setAllVariants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const [promos, variantLists] = await Promise.all([
      api.getPromotions(),
      Promise.all(products.map((p) => api.getVariants(p.id)))
    ]);
    setPromotions(promos);
    setAllVariants(variantLists.flat().map((v, i) => ({ ...v, productName: products.find((p) => p.id === v.product_id)?.name })));
  };

  useEffect(() => { load(); }, [products]);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      type: form.type,
      is_active: form.is_active,
      priority: Number(form.priority) || 0,
      applies_to_all: form.type === 'quantity_break' ? form.applies_to_all : true,
      quantity: form.type === 'quantity_break' ? Number(form.quantity) : null,
      bundle_price: form.type === 'quantity_break' ? Number(form.bundle_price) : null,
      discount_type: form.type === 'bundle' ? form.discount_type : null,
      discount_value: form.type === 'bundle' ? Number(form.discount_value) : null,
      scope_variant_ids: form.type === 'quantity_break' && !form.applies_to_all ? form.scope_variant_ids : [],
      bundle_items: form.type === 'bundle' ? form.bundle_items : []
    };
    if (editingId) {
      await api.updatePromotion(editingId, payload);
    } else {
      await api.createPromotion(payload);
    }
    resetForm();
    load();
  };

  const handleEdit = (promo) => {
    setEditingId(promo.id);
    setForm({
      name: promo.name,
      type: promo.type,
      is_active: promo.is_active,
      priority: promo.priority,
      applies_to_all: promo.applies_to_all,
      quantity: promo.quantity || 2,
      bundle_price: promo.bundle_price || '',
      discount_type: promo.discount_type || 'fixed_amount',
      discount_value: promo.discount_value || '',
      scope_variant_ids: (promo.scope_variants || []).map((s) => s.variant_id).filter(Boolean),
      bundle_items: (promo.bundle_items || []).map((b) => ({ variant_id: b.variant_id, required_qty: b.required_qty }))
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('ลบโปรโมชั่นนี้?')) return;
    await api.deletePromotion(id);
    load();
  };

  const addBundleItem = () => {
    if (allVariants.length === 0) return;
    setForm({ ...form, bundle_items: [...form.bundle_items, { variant_id: allVariants[0].id, required_qty: 1 }] });
  };

  const updateBundleItem = (idx, field, value) => {
    const items = [...form.bundle_items];
    items[idx] = { ...items[idx], [field]: field === 'required_qty' ? Number(value) : value };
    setForm({ ...form, bundle_items: items });
  };

  const removeBundleItem = (idx) => {
    setForm({ ...form, bundle_items: form.bundle_items.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
        <h3 className="font-bold text-zinc-900">จัดการโปรโมชั่น (Promotions)</h3>
        <p className="text-xs text-zinc-500">กำหนดโปรซื้อครบราคาพิเศษ หรือโปรซื้อคู่สินค้าลดราคา</p>
      </div>

      <div className="space-y-2">
        {promotions.map((promo) => (
          <div key={promo.id} className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-sm">{promo.name}</span>
              <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 bg-zinc-100 rounded">
                {promo.type === 'quantity_break' ? 'ซื้อครบราคาพิเศษ' : 'ซื้อคู่ลดราคา'}
              </span>
              <span className={`ml-2 text-[10px] font-bold ${promo.is_active ? 'text-emerald-600' : 'text-zinc-400'}`}>
                {promo.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleEdit(promo)} className="px-2.5 py-1 bg-zinc-100 rounded text-xs font-bold">แก้ไข</button>
              <button type="button" onClick={() => handleDelete(promo.id)} className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded text-xs font-bold">ลบ</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-zinc-200 space-y-3">
        <h4 className="font-bold text-xs">{editingId ? 'แก้ไขโปรโมชั่น' : 'สร้างโปรโมชั่นใหม่'}</h4>

        <input
          type="text"
          placeholder="ชื่อโปรโมชั่น"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
        />

        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
        >
          <option value="quantity_break">ซื้อครบจำนวนราคาพิเศษ</option>
          <option value="bundle">ซื้อคู่สินค้าลดราคา</option>
        </select>

        {form.type === 'quantity_break' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="จำนวนชิ้น"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
              />
              <input
                type="number"
                placeholder="ราคารวม"
                value={form.bundle_price}
                onChange={(e) => setForm({ ...form, bundle_price: e.target.value })}
                className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.applies_to_all}
                onChange={(e) => setForm({ ...form, applies_to_all: e.target.checked })}
              />
              ใช้ได้กับสินค้าทุกชิ้นในร้าน
            </label>
            {!form.applies_to_all && (
              <select
                multiple
                value={form.scope_variant_ids}
                onChange={(e) => setForm({ ...form, scope_variant_ids: Array.from(e.target.selectedOptions, (o) => o.value) })}
                className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded h-24"
              >
                {allVariants.map((v) => (
                  <option key={v.id} value={v.id}>{v.productName} - {v.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {form.type === 'bundle' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
              >
                <option value="fixed_amount">ลดเป็นจำนวนบาท</option>
                <option value="fixed_price">ตั้งราคารวมคงที่</option>
              </select>
              <input
                type="number"
                placeholder="มูลค่า"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-300 rounded"
              />
            </div>

            <div className="space-y-1.5">
              {form.bundle_items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={item.variant_id}
                    onChange={(e) => updateBundleItem(idx, 'variant_id', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-zinc-300 rounded"
                  >
                    {allVariants.map((v) => (
                      <option key={v.id} value={v.id}>{v.productName} - {v.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.required_qty}
                    onChange={(e) => updateBundleItem(idx, 'required_qty', e.target.value)}
                    className="w-14 px-2 py-1 text-xs border border-zinc-300 rounded"
                  />
                  <button type="button" onClick={() => removeBundleItem(idx)} className="text-rose-600 text-xs">✕</button>
                </div>
              ))}
              <button type="button" onClick={addBundleItem} className="text-xs font-bold text-zinc-700 underline">
                + เพิ่มสินค้าในชุดโปร
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={
              !form.name.trim() ||
              (form.type === 'bundle' && (form.bundle_items.length < 2 || !(Number(form.discount_value) > 0))) ||
              (form.type === 'quantity_break' && !(Number(form.quantity) > 0 && Number(form.bundle_price) > 0))
            }
            className="flex-1 py-2 bg-zinc-900 text-white text-xs font-bold rounded disabled:opacity-40"
          >
            {editingId ? 'บันทึกการแก้ไข' : 'สร้างโปรโมชั่น'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-zinc-100 text-xs font-bold rounded">ยกเลิก</button>
          )}
        </div>
      </div>
    </div>
  );
}
