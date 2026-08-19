import React, { useState } from 'react';
import { STORE_CONFIG } from '../config/storeConfig';
import { formatCurrency, getPromptPayQRUrl } from '../utils/formatters';
import { api } from '../config/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function OrderModal({ product, onClose, onSuccess, onOpenSizeChart }) {
  const { t } = useLanguage();

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

  const isExpired = Boolean(product.order_deadline && new Date(product.order_deadline) < new Date());
  const isClosed = product.is_active === false || isExpired;

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
      alert(t.errImageFormat);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(t.errImageSize);
      return;
    }
    setSlipFile(file);
    setSlipPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isClosed) {
      alert('ขออภัย สินค้ารายการนี้ปิดรับการสั่งจองแล้ว หรือหมดเวลาสั่งจองแล้ว ไม่สามารถส่งคำสั่งซื้อได้');
      return;
    }

    if (!formData.fullName || formData.fullName.length < 2) return alert(t.errFullName);
    if (!formData.studentId || formData.studentId.length < 4) return alert(t.errStudentId);
    if (!formData.yearOfStudy) return alert(t.errYear);
    if (!formData.major) return alert(t.errMajor);
    if (!formData.phone || formData.phone.length < 8) return alert(t.errPhone);
    if (!formData.contact) return alert(t.errContact);
    if (deliveryMethod === 'shipping' && (!formData.address || formData.address.length < 8)) {
      return alert(t.errAddress);
    }
    if (!slipFile) return alert(t.errSlip);

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
      alert('Error: ' + (err.message || err));
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
            <h3 className="font-bold text-zinc-900 text-base">{t.orderFormTitle}</h3>
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
                  className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/80 text-white text-xs font-mono rounded-lg shadow-sm"
                >
                  {showBack ? t.viewFront : t.viewBack}
                </button>
              )}
            </div>

            <div>
              <h4 className="font-bold text-zinc-900 text-base">{product.name}</h4>
              <div className="text-xl font-bold font-mono text-zinc-900 mt-1">{formatCurrency(product.price)}</div>
              <p className="text-xs text-zinc-600 mt-2 leading-relaxed">{product.description}</p>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-600">{t.unsureSize}</span>
              <button type="button" onClick={onOpenSizeChart} className="text-xs font-bold text-zinc-900 underline hover:text-amber-600">
                {t.viewSizeChartBtn}
              </button>
            </div>
          </div>

          {/* Right Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
            
            {/* Options */}
            <div className="space-y-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
              <div>
                <label className="text-xs font-mono font-bold text-zinc-800 block mb-2">{t.step1Size}</label>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`px-4 py-2 rounded-lg border font-mono text-sm font-medium transition-all ${
                        size === s ? 'border-black bg-black text-white shadow-xs' : 'border-zinc-200 bg-white text-zinc-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-zinc-800 block mb-2">{t.step2Color}</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        color === c ? 'border-black bg-zinc-900 text-white shadow-xs' : 'border-zinc-200 bg-white text-zinc-700'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-zinc-800 block mb-2">{t.step3Qty}</label>
                <div className="inline-flex items-center border border-zinc-200 rounded-xl bg-white overflow-hidden shadow-xs">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-zinc-600 hover:bg-zinc-100 font-bold">
                    -
                  </button>
                  <span className="w-12 text-center font-mono font-bold text-sm">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(Math.min(20, quantity + 1))} className="px-3 py-2 text-zinc-600 hover:bg-zinc-100 font-bold">
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="space-y-4">
              <h5 className="text-xs font-mono font-bold text-zinc-900 uppercase pb-1 border-b border-zinc-200">
                {t.customerInfoTitle}
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t.fullNameLabel}</label>
                  <input
                    type="text"
                    required
                    placeholder={t.fullNamePlaceholder}
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t.studentIdLabel}</label>
                  <input
                    type="text"
                    required
                    placeholder={t.studentIdPlaceholder}
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t.yearLabel}</label>
                  <select
                    required
                    value={formData.yearOfStudy}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white"
                  >
                    <option value="">{t.yearPlaceholder}</option>
                    {STORE_CONFIG.years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t.majorLabel}</label>
                  <select
                    required
                    value={formData.major}
                    onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white"
                  >
                    <option value="">{t.majorPlaceholder}</option>
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
                        <optgroup label={t.undergradGroup}>
                          {(STORE_CONFIG.undergraduateMajors || []).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </optgroup>
                        <optgroup label={t.gradGroup}>
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
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t.phoneLabel}</label>
                  <input
                    type="tel"
                    required
                    placeholder={t.phonePlaceholder}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t.contactLabel}</label>
                  <input
                    type="text"
                    required
                    placeholder={t.contactPlaceholder}
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="space-y-3">
              <h5 className="text-xs font-mono font-bold text-zinc-900 uppercase pb-1 border-b border-zinc-200">
                {t.deliveryTitle}
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="cursor-pointer border border-zinc-200 rounded-xl p-3.5 flex items-start gap-3 bg-zinc-50 hover:bg-zinc-100 transition-colors">
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryMethod === 'pickup'}
                    onChange={() => setDeliveryMethod('pickup')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-bold text-xs">{t.pickupOption}</div>
                    <div className="text-[11px] text-zinc-500">{t.pickupDesc}</div>
                  </div>
                </label>

                <label className="cursor-pointer border border-zinc-200 rounded-xl p-3.5 flex items-start gap-3 bg-zinc-50 hover:bg-zinc-100 transition-colors">
                  <input
                    type="radio"
                    name="delivery"
                    checked={deliveryMethod === 'shipping'}
                    onChange={() => setDeliveryMethod('shipping')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-bold text-xs">{t.shippingOption}</div>
                    <div className="text-[11px] text-zinc-500">+{formatCurrency(STORE_CONFIG.faculty.shippingFee)} {t.shippingDesc}</div>
                  </div>
                </label>
              </div>

              {deliveryMethod === 'shipping' && (
                <div className="pt-2">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t.addressLabel}</label>
                  <textarea
                    rows="2"
                    required
                    placeholder={t.addressPlaceholder}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white"
                  ></textarea>
                </div>
              )}
            </div>

            {/* Payment & Slip */}
            <div className="p-4 bg-zinc-900 text-white rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-mono font-bold">{t.paymentTitle}</span>
                <span className="text-xs font-mono font-bold text-amber-400">{t.totalPayLabel} {formatCurrency(grandTotal)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-5 flex flex-col items-center justify-center p-2.5 bg-white rounded-xl shadow-xs">
                  <img 
                    src="/assets/payment_qr.jpg" 
                    alt="Payment QR Code" 
                    className="w-36 h-36 object-contain rounded-lg"
                    onError={(e) => { e.target.src = getPromptPayQRUrl(grandTotal); }}
                  />
                  <span className="text-[10px] text-zinc-700 font-bold font-mono mt-1">{t.scanQRLabel}</span>
                </div>
                <div className="sm:col-span-7 text-xs font-mono space-y-2">
                  <div className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 space-y-1">
                    <span className="text-zinc-400 text-[10.5px]">{t.bankLabel}</span>
                    <div className="font-bold text-emerald-400 text-xs">{STORE_CONFIG.payment.bankName}</div>
                    <div className="text-zinc-400 text-[10.5px] pt-1 border-t border-zinc-700/60">{t.accNoLabel}</div>
                    <div className="font-bold text-white text-base tracking-widest">{STORE_CONFIG.payment.bankAccountNo}</div>
                    <div className="text-zinc-400 text-[10.5px] pt-1 border-t border-zinc-700/60">{t.accNameLabel}</div>
                    <div className="font-bold text-amber-300 text-xs">{STORE_CONFIG.payment.bankAccountName}</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">{t.attachSlipLabel}</label>
                {!slipPreview ? (
                  <label className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-800/50 rounded-xl p-6 block text-center cursor-pointer transition-colors">
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files[0])} className="hidden" />
                    <span className="text-xs text-zinc-200 font-medium">{t.selectSlipFile}</span>
                    <span className="text-[10px] text-zinc-400 block mt-1 font-mono">{t.slipHint}</span>
                  </label>
                ) : (
                  <div className="bg-zinc-800 p-3 rounded-xl flex items-center justify-between border border-zinc-700">
                    <img src={slipPreview} alt="Slip" className="w-12 h-12 object-cover rounded-lg" />
                    <span className="text-xs text-white truncate max-w-[150px]">{slipFile?.name}</span>
                    <button type="button" onClick={() => { setSlipFile(null); setSlipPreview(null); }} className="text-xs text-rose-400 font-bold hover:underline">
                      {t.changeSlip}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Total & Submit */}
            <div className="pt-4 border-t border-zinc-200 space-y-2">
              {isClosed && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold text-center">
                  ⚠️ ขออภัย สินค้ารายการนี้ปิดรับการสั่งจองแล้ว หรือหมดเวลาสั่งจองแล้ว
                </div>
              )}

              <div className="flex justify-between text-base font-bold font-mono">
                <span>{t.grandTotalLabel}</span>
                <span className="text-xl text-emerald-600">{formatCurrency(grandTotal)}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isClosed}
                className={`w-full py-3.5 font-bold text-sm rounded-xl shadow-lg transition-all ${
                  isClosed
                    ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed border border-zinc-400'
                    : 'bg-zinc-900 hover:bg-black text-white disabled:opacity-50'
                }`}
              >
                {isClosed ? '🔴 สินค้านี้ปิดรับจองแล้ว (Closed)' : (isSubmitting ? t.submittingBtn : t.submitOrderBtn)}
              </button>
            </div>

          </form>

        </div>
      </div>
    </div>
  );
}
