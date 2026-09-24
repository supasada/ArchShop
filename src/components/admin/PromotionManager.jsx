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
      bundle_items: form.type === 'bundle'
        ? form.bundle_items.flatMap((slot, idx) =>
            slot.variant_ids.map((variantId) => ({ variant_id: variantId, slot: idx, required_qty: slot.required_qty })))
        : []
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
      bundle_items: (() => {
        const slots = [];
        const bySlot = new Map();
        (promo.bundle_items || []).forEach((b) => {
          if (!b.variant_id) return;
          if (b.slot != null && bySlot.has(b.slot)) {
            bySlot.get(b.slot).variant_ids.push(b.variant_id);
          } else {
            const slot = { variant_ids: [b.variant_id], required_qty: b.required_qty || 1 };
            if (b.slot != null) bySlot.set(b.slot, slot);
            slots.push(slot);
          }
        });
        return slots;
      })()
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('ลบโปรโมชั่นนี้?')) return;
    await api.deletePromotion(id);
    load();
  };

  const addBundleItem = () => {
    setForm({ ...form, bundle_items: [...form.bundle_items, { variant_ids: [], required_qty: 1 }] });
  };

  const updateBundleItem = (idx, changes) => {
    const items = [...form.bundle_items];
    items[idx] = { ...items[idx], ...changes };
    setForm({ ...form, bundle_items: items });
  };

  const toggleSlotVariant = (idx, variantId) => {
    const ids = form.bundle_items[idx].variant_ids;
    updateBundleItem(idx, {
      variant_ids: ids.includes(variantId) ? ids.filter((id) => id !== variantId) : [...ids, variantId]
    });
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>กดเลือกได้หลายรายการ ({form.scope_variant_ids.length} เลือกแล้ว)</span>
                  <span className="flex gap-2">
                    <button type="button" className="underline" onClick={() => setForm({ ...form, scope_variant_ids: allVariants.map((v) => v.id) })}>เลือกทั้งหมด</button>
                    <button type="button" className="underline" onClick={() => setForm({ ...form, scope_variant_ids: [] })}>ล้าง</button>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {allVariants.map((v) => {
                    const on = form.scope_variant_ids.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setForm({
                          ...form,
                          scope_variant_ids: on
                            ? form.scope_variant_ids.filter((id) => id !== v.id)
                            : [...form.scope_variant_ids, v.id]
                        })}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                          on ? 'bg-zinc-900 text-white border-black' : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                        }`}
                      >
                        {on ? '✓ ' : ''}{v.productName} - {v.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {form.type === 'bundle' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <label className="text-[11px] font-bold text-zinc-600 space-y-1">
                <span>รูปแบบส่วนลด</span>
                <select
                  value={form.discount_type}
                  onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs border border-zinc-300 rounded-lg bg-white"
                >
                  <option value="fixed_amount">ลดเป็นจำนวนบาท</option>
                  <option value="fixed_price">ตั้งราคารวมคงที่</option>
                </select>
              </label>
              <label className="text-[11px] font-bold text-zinc-600 space-y-1">
                <span>{form.discount_type === 'fixed_price' ? 'ราคารวมของชุด (บาท)' : 'ส่วนลดต่อชุด (บาท)'}</span>
                <input
                  type="number"
                  placeholder="0"
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs border border-zinc-300 rounded-lg bg-white"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-zinc-600">
                สินค้าในชุดโปร — แต่ละช่องกดเลือกได้หลายตัวเลือก (ลูกค้าซื้อตัวไหนก็ได้ในช่องนั้น)
              </div>
              {form.bundle_items.map((slot, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-zinc-200 bg-white space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-zinc-900">ช่องที่ {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center border border-zinc-300 rounded-lg overflow-hidden">
                        <button type="button" onClick={() => updateBundleItem(idx, { required_qty: Math.max(1, slot.required_qty - 1) })} className="w-7 h-7 text-sm font-bold hover:bg-zinc-100">-</button>
                        <span className="w-8 text-center text-xs font-mono font-bold">{slot.required_qty}</span>
                        <button type="button" onClick={() => updateBundleItem(idx, { required_qty: slot.required_qty + 1 })} className="w-7 h-7 text-sm font-bold hover:bg-zinc-100">+</button>
                      </div>
                      <span className="text-[11px] text-zinc-500">ชิ้น</span>
                      <button type="button" onClick={() => removeBundleItem(idx)} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100">✕</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allVariants.map((v) => {
                      const on = slot.variant_ids.includes(v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => toggleSlotVariant(idx, v.id)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                            on ? 'bg-zinc-900 text-white border-black' : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                          }`}
                        >
                          {on ? '✓ ' : ''}{v.productName} - {v.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addBundleItem}
                className="w-full py-2 text-xs font-bold text-zinc-700 border-2 border-dashed border-zinc-300 rounded-xl hover:border-zinc-500 hover:bg-zinc-50"
              >
                + เพิ่มช่องสินค้าในชุดโปร
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
              (form.type === 'bundle' && (form.bundle_items.length < 2 || form.bundle_items.some((sl) => sl.variant_ids.length === 0) || !(Number(form.discount_value) > 0))) ||
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
