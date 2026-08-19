import React, { useState, useEffect } from 'react';
import { STORE_CONFIG } from '../config/storeConfig';
import { formatCurrency, getPromptPayQRUrl } from '../utils/formatters';
import { api } from '../config/supabase';

export default function OrderModal({ product, onClose, onSuccess, onOpenSizeChart }) {
  const sizes = Array.isArray(product?.available_sizes) ? product.available_sizes : ['S', 'M', 'L', 'XL', '2XL'];
  const colors = Array.isArray(product?.available_colors) ? product.available_colors : ['Deep Black'];

  const [size, setSize] = useState(sizes[0] || 'L');
  const [color, setColor] = useState(colors[0] || 'Deep Black');
  const [quantity, setQuantity] = useState(1);
  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [showBack, setShowBack] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    studentId: '',
    yearOfStudy: '',
    major: '',
    phone: '',
    contact: '',
    address: '',
    notes: ''
  });

  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);

  if (!product) return null;

  const unitPrice = Number(product.price);
  const subtotal = unitPrice * quantity;
  const shippingFee = deliveryMethod === 'shipping' ? STORE_CONFIG.faculty.shippingFee : 0;
  const grandTotal = subtotal + shippingFee;

  const isGraduate = formData.yearOfStudy && (
    formData.yearOfStudy.includes('บัณฑิต') ||
    formData.yearOfStudy.includes('โท') ||
    formData.yearOfStudy.includes('เอก') ||
    formData.yearOfStudy.includes('Graduate')
  );

  const isUndergraduate = formData.yearOfStudy && (
    formData.yearOfStudy.startsWith('ปี') && !formData.yearOfStudy.includes('โท')
  );

  const handleYearChange = (year) => {
    const nextIsGraduate = year.includes('บัณฑิต') || year.includes('โท') || year.includes('เอก') || year.includes('Graduate');
    const nextIsUndergrad = year.startsWith('ปี') && !year.includes('โท');

    let nextMajor = formData.major;
    const gradList = STORE_CONFIG.graduateMajors || [];
    const underList = STORE_CONFIG.undergraduateMajors || [];

    if (nextIsGraduate && !gradList.includes(nextMajor)) {
      nextMajor = '';
    } else if (nextIsUndergrad && !underList.includes(nextMajor)) {
      nextMajor = '';
    }

    setFormData({
      ...formData,
      yearOfStudy: year,
      major: nextMajor
    });
  };

  const handleFileChange = (file) => {
    if (!file) return;
    if (!file.type.match(/^image\//i)) {
      alert('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดไฟล์ต้องไม่เกิน 5 MB');
      return;
    }
    setSlipFile(file);
    setSlipPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.fullName || formData.fullName.length < 3) return alert('กรุณากรอกชื่อ-นามสกุลจริง');
    if (!formData.studentId || formData.studentId.length < 5) return alert('กรุณากรอกรหัสนักศึกษา');
    if (!formData.yearOfStudy) return alert('กรุณาเลือกระดับชั้นปี');
    if (!formData.major) return alert('กรุณาเลือกสาขาวิชา');
    if (!formData.phone || formData.phone.length < 9) return alert('กรุณากรอกเบอร์โทรศัพท์ที่ติดต่อได้');
    if (!formData.contact) return alert('กรุณากรอก LINE ID หรือ อีเมล');
    if (deliveryMethod === 'shipping' && (!formData.address || formData.address.length < 10)) {
      return alert('กรุณากรอกที่อยู่จัดส่งพัสดุให้ครบถ้วน');
    }
    if (!slipFile) return alert('กรุณาแนบสลิปหลักฐานการโอนเงิน');

    setIsSubmitting(true);
    try {
      const slipUrl = await api.uploadSlip(slipFile, formData.studentId);

      const orderPayload = {
        product_id: product.id,
        full_name: formData.fullName,
        student_id: formData.studentId,
        year_of_study: formData.yearOfStudy,
        major: formData.major,
        phone_number: formData.phone,
        email_or_line_id: formData.contact,
        color,
        size,
        quantity,
        total_price: grandTotal,
        payment_slip_url: slipUrl,
        delivery_method: deliveryMethod,
        shipping_address: deliveryMethod === 'shipping' ? formData.address : null,
        notes: formData.notes || null,
        payment_status: 'pending'
      };

      const created = await api.submitOrder(orderPayload);
      onSuccess(created, product);
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <h3 className="font-bold text-zinc-900 text-base">แบบฟอร์มสั่งจองเสื้อ (Pre-Order Form)</h3>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-200/80 hover:bg-zinc-300 flex items-center justify-center text-zinc-700">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Summary */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative aspect-square bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200">
              <img
                src={showBack ? (product.image_back_url || product.image_front_url) : product.image_front_url}
                alt="Shirt Preview"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = '/assets/images/arch_shirt_front.jpg'; }}
              />
              {product.image_back_url && (
                <button
                  type="button"
                  onClick={() => setShowBack(!showBack)}
                  className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/80 text-white text-xs font-mono rounded-lg"
                >
                  {showBack ? 'ดูด้านหน้า' : 'ดูด้านหลัง'}
                </button>
              )}
            </div>

            <div>
              <h4 className="font-bold text-zinc-900 text-base">{product.name}</h4>
              <div className="text-xl font-bold font-mono text-zinc-900 mt-1">{formatCurrency(product.price)}</div>
              <p className="text-xs text-zinc-600 mt-2 leading-relaxed">{product.description}</p>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-600">ไม่แน่ใจขนาดไซส์?</span>
              <button type="button" onClick={onOpenSizeChart} className="text-xs font-bold text-zinc-900 underline hover:text-amber-600">
                ดูตารางไซส์
              </button>
            </div>
          </div>

          {/* Right Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
            
            {/* Options */}
            <div className="space-y-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
              <div>
                <label className="text-xs font-mono font-bold text-zinc-800 block mb-2">1. เลือกไซส์ (SIZE):</label>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`px-4 py-2 rounded-lg border font-mono text-sm font-medium transition-all ${
                        size === s ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-zinc-800 block mb-2">2. เลือกสี (COLOR):</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        color === c ? 'border-black bg-zinc-900 text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-zinc-800 block mb-2">3. จำนวน (QUANTITY):</label>
                <div className="inline-flex items-center border border-zinc-200 rounded-xl bg-white overflow-hidden">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-zinc-600 hover:bg-zinc-100">
                    -
                  </button>
                  <span className="w-12 text-center font-mono font-bold text-sm">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(Math.min(20, quantity + 1))} className="px-3 py-2 text-zinc-600 hover:bg-zinc-100">
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="space-y-4">
              <h5 className="text-xs font-mono font-bold text-zinc-900 uppercase pb-1 border-b border-zinc-200">
                ข้อมูลผู้สั่งซื้อ (Customer Information)
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">ชื่อ-นามสกุลจริง *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น นายปวริศร สถาปัตย์พัฒนา"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">รหัสนักศึกษา *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น 65010234567"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">ระดับชั้นปี *</label>
                  <select
                    required
                    value={formData.yearOfStudy}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                  >
                    <option value="">-- เลือกระดับชั้นปี --</option>
                    {STORE_CONFIG.years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">ภาควิชา / สาขา *</label>
                  <select
                    required
                    value={formData.major}
                    onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                  >
                    <option value="">-- เลือกสาขาวิชา --</option>
                    {isGraduate ? (
                      (STORE_CONFIG.graduateMajors || []).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))
                    ) : isUndergraduate ? (
                      (STORE_CONFIG.undergraduateMajors || []).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))
                    ) : (
                      <>
                        <optgroup label="ระดับปริญญาตรี (Undergraduate)">
                          {(STORE_CONFIG.undergraduateMajors || []).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </optgroup>
                        <optgroup label="ระดับบัณฑิตศึกษา (Graduate)">
                          {(STORE_CONFIG.graduateMajors || []).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </optgroup>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">เบอร์โทรศัพท์ *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0812345678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">LINE ID หรือ อีเมล *</label>
                  <input
                    type="text"
                    required
                    placeholder="line: arch_student"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="space-y-3">
              <h5 className="text-xs font-mono font-bold text-zinc-900 uppercase pb-1 border-b border-zinc-200">
                วิธีการรับสินค้า
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="cursor-pointer border border-zinc-200 rounded-xl p-3.5 flex items-start gap-3 bg-zinc-50">
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryMethod === 'pickup'}
                    onChange={() => setDeliveryMethod('pickup')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-bold text-xs">รับที่ห้องสโมสรนักศึกษา</div>
                    <div className="text-[11px] text-zinc-500">ฟรี ตึกสถาปัตย์ ชั้น 1</div>
                  </div>
                </label>

                <label className="cursor-pointer border border-zinc-200 rounded-xl p-3.5 flex items-start gap-3 bg-zinc-50">
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryMethod === 'shipping'}
                    onChange={() => setDeliveryMethod('shipping')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-bold text-xs">จัดส่งพัสดุถึงที่อยู่</div>
                    <div className="text-[11px] text-zinc-500">+{formatCurrency(STORE_CONFIG.faculty.shippingFee)} ค่าบริการขนส่ง</div>
                  </div>
                </label>
              </div>

              {deliveryMethod === 'shipping' && (
                <div className="pt-2">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">ที่อยู่สำหรับจัดส่งพัสดุ *</label>
                  <textarea
                    rows="2"
                    required
                    placeholder="บ้านเลขที่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                  ></textarea>
                </div>
              )}
            </div>

            {/* Payment & Slip */}
            <div className="p-4 bg-zinc-900 text-white rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-mono font-bold">PromptPay / ธนาคาร</span>
                <span className="text-xs font-mono font-bold text-amber-400">ยอดชำระ: {formatCurrency(grandTotal)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-4 flex flex-col items-center justify-center p-2 bg-white rounded-xl">
                  <img src={getPromptPayQRUrl(grandTotal)} alt="QR Code" className="w-28 h-28 object-contain" />
                  <span className="text-[10px] text-zinc-500 font-mono mt-1">สแกนชำระเงิน</span>
                </div>
                <div className="sm:col-span-8 text-xs font-mono space-y-2">
                  <div className="bg-zinc-800 p-2.5 rounded-xl">
                    <span className="text-zinc-400 text-[10px]">PromptPay:</span>
                    <div className="font-bold text-white mt-0.5">{STORE_CONFIG.payment.promptpayNumber}</div>
                    <div className="text-[10px] text-zinc-400">{STORE_CONFIG.payment.promptpayName}</div>
                  </div>
                  <div className="bg-zinc-800 p-2.5 rounded-xl">
                    <span className="text-zinc-400 text-[10px]">{STORE_CONFIG.payment.bankName}:</span>
                    <div className="font-bold text-white mt-0.5">{STORE_CONFIG.payment.bankAccountNo}</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">แนบภาพสลิปโอนเงิน *</label>
                {!slipPreview ? (
                  <label className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-800/50 rounded-xl p-6 block text-center cursor-pointer">
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files[0])} className="hidden" />
                    <span className="text-xs text-zinc-200">คลิกเพื่อเลือกไฟล์รูปสลิป</span>
                    <span className="text-[10px] text-zinc-400 block mt-1 font-mono">JPG, PNG, WEBP (ไม่เกิน 5MB)</span>
                  </label>
                ) : (
                  <div className="bg-zinc-800 p-3 rounded-xl flex items-center justify-between">
                    <img src={slipPreview} alt="Slip" className="w-12 h-12 object-cover rounded-lg" />
                    <span className="text-xs text-white truncate max-w-[150px]">{slipFile?.name}</span>
                    <button type="button" onClick={() => { setSlipFile(null); setSlipPreview(null); }} className="text-xs text-rose-400">
                      เปลี่ยนรูป
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Total & Submit */}
            <div className="pt-4 border-t border-zinc-200 space-y-2">
              <div className="flex justify-between text-base font-bold font-mono">
                <span>ยอดชำระสุทธิ:</span>
                <span className="text-xl">{formatCurrency(grandTotal)}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-zinc-900 hover:bg-black text-white font-bold text-sm rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ยืนยันการสั่งจองและส่งสลิป (Submit Order)'}
              </button>
            </div>

          </form>

        </div>
      </div>
    </div>
  );
}
