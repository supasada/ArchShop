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
  const [paymentMethod, setPaymentMethod] = useState('transfer'); // 'transfer' | 'cash'
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

  const handleDeliveryChange = (method) => {
    setDeliveryMethod(method);
    if (method === 'shipping') {
      setPaymentMethod('transfer');
    }
  };

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

    const effectivePaymentMethod = deliveryMethod === 'shipping' ? 'transfer' : paymentMethod;

    if (effectivePaymentMethod === 'transfer' && !slipFile) {
      return alert(t.errSlip);
    }

    setIsSubmitting(true);
    try {
      let slipUrl = null;
      if (effectivePaymentMethod === 'transfer' && slipFile) {
        slipUrl = await api.uploadSlip(slipFile, formData.studentId);
      }

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
        payment_method: effectivePaymentMethod,
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <h3 className="font-bold text-zinc-900 text-sm sm:text-base">{t.orderFormTitle}</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-zinc-200/80 hover:bg-zinc-300 flex items-center justify-center text-zinc-700 text-xs font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 sm:p-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* Left Summary */}
          <div className="lg:col-span-5 space-y-3.5 sm:space-y-4">
            <div className="relative aspect-[4/3] sm:aspect-square bg-zinc-100 rounded-xl sm:rounded-2xl overflow-hidden border border-zinc-200">
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
                  className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-black/80 hover:bg-black text-white text-[11px] sm:text-xs font-mono rounded-lg shadow-sm active:scale-95 transition-all"
                >
                  {showBack ? t.viewFront : t.viewBack}
                </button>
              )}
            </div>

            <div>
              <h4 className="font-bold text-zinc-900 text-sm sm:text-base leading-snug">{product.name}</h4>
              <div className="text-lg sm:text-xl font-bold font-mono text-zinc-900 mt-1">{formatCurrency(product.price)}</div>
              <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed line-clamp-3 sm:line-clamp-none">{product.description}</p>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-zinc-600 truncate">{t.unsureSize}</span>
              <button type="button" onClick={onOpenSizeChart} className="text-xs font-bold text-zinc-900 underline hover:text-amber-600 shrink-0">
                {t.viewSizeChartBtn}
              </button>
            </div>
          </div>

          {/* Right Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-5 sm:space-y-6">
            
            {/* Options */}
            <div className="space-y-3.5 p-3.5 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl border border-zinc-200">
              <div>
                <label className="text-xs font-mono font-bold text-zinc-800 block mb-1.5">{t.step1Size}</label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`min-w-[42px] sm:min-w-[48px] py-2 px-3 rounded-lg sm:rounded-xl border font-mono text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                        size === s ? 'border-black bg-black text-white shadow-xs' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-zinc-800 block mb-1.5">{t.step2Color}</label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`px-3 py-1.5 rounded-lg sm:rounded-xl border text-xs font-medium transition-all active:scale-95 ${
                        color === c ? 'border-black bg-zinc-900 text-white shadow-xs' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-zinc-800 block mb-1.5">{t.step3Qty}</label>
                <div className="inline-flex items-center border border-zinc-200 rounded-xl bg-white overflow-hidden shadow-xs">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-9 sm:w-11 sm:h-10 text-zinc-600 hover:bg-zinc-100 font-bold flex items-center justify-center">
                    -
                  </button>
                  <span className="w-10 sm:w-12 text-center font-mono font-bold text-xs sm:text-sm">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(Math.min(20, quantity + 1))} className="w-10 h-9 sm:w-11 sm:h-10 text-zinc-600 hover:bg-zinc-100 font-bold flex items-center justify-center">
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="space-y-3.5 sm:space-y-4">
              <h5 className="text-xs font-mono font-bold text-zinc-900 uppercase pb-1 border-b border-zinc-200">
                {t.customerInfoTitle}
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t.fullNameLabel}</label>
                  <input
                    type="text"
                    required
                    placeholder={t.fullNamePlaceholder}
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
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
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t.yearLabel}</label>
                  <select
                    required
                    value={formData.yearOfStudy}
                    onChange={(e) => handleYearChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
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
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t.phoneLabel}</label>
                  <input
                    type="tel"
                    required
                    placeholder={t.phonePlaceholder}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
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
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Method */}
            <div className="space-y-3">
              <h5 className="text-xs font-mono font-bold text-zinc-900 uppercase pb-1 border-b border-zinc-200">
                {t.deliveryTitle}
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <label className={`p-3 sm:p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  deliveryMethod === 'pickup' ? 'border-black bg-zinc-50 shadow-xs' : 'border-zinc-200 hover:bg-zinc-50'
                }`}>
                  <input
                    type="radio"
                    name="delivery"
                    value="pickup"
                    checked={deliveryMethod === 'pickup'}
                    onChange={() => handleDeliveryChange('pickup')}
                    className="mt-0.5 accent-black"
                  />
                  <div>
                    <div className="font-bold text-xs text-zinc-900">{t.pickupOption}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 leading-tight">{t.pickupDesc}</div>
                    <div className="text-[10.5px] font-mono text-emerald-600 font-bold mt-1">FREE (0 THB)</div>
                  </div>
                </label>

                <label className={`p-3 sm:p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  deliveryMethod === 'shipping' ? 'border-black bg-zinc-50 shadow-xs' : 'border-zinc-200 hover:bg-zinc-50'
                }`}>
                  <input
                    type="radio"
                    name="delivery"
                    value="shipping"
                    checked={deliveryMethod === 'shipping'}
                    onChange={() => handleDeliveryChange('shipping')}
                    className="mt-0.5 accent-black"
                  />
                  <div>
                    <div className="font-bold text-xs text-zinc-900">{t.shippingOption}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 leading-tight">{t.shippingDesc}</div>
                    <div className="text-[10.5px] font-mono text-zinc-700 font-bold mt-1">+ {formatCurrency(STORE_CONFIG.faculty.shippingFee)}</div>
                  </div>
                </label>
              </div>

              {deliveryMethod === 'shipping' && (
                <div className="pt-1">
                  <label className="block text-xs font-medium text-zinc-700 mb-1">{t.addressLabel}</label>
                  <textarea
                    required
                    rows="3"
                    placeholder={t.addressPlaceholder}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  ></textarea>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">{t.notesLabel}</label>
              <input
                type="text"
                placeholder={t.notesPlaceholder}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            {/* Payment Section */}
            <div className="p-4 sm:p-5 bg-zinc-900 text-white rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <span className="text-xs font-mono font-bold">{t.paymentTitle}</span>
                <span className="text-xs font-mono font-bold text-amber-400">{t.totalPayLabel} {formatCurrency(grandTotal)}</span>
              </div>

              {/* Delivery Shipping Alert */}
              {deliveryMethod === 'shipping' && (
                <div className="p-2.5 bg-zinc-800/90 border border-amber-400/50 rounded-xl text-[11px] text-amber-300 font-mono flex items-center gap-2 shadow-xs">
                  <span className="text-sm">🚚</span>
                  <span>{t.cashOnlyPickupNote || '🔒 การจัดส่งถึงบ้านต้องชำระเงินผ่าน QR Code / โอนเงินเท่านั้น'}</span>
                </div>
              )}

              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-mono font-bold text-zinc-300 block mb-2">{t.paymentMethodLabel || 'เลือกช่องทางการชำระเงิน:'}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                      paymentMethod === 'transfer'
                        ? 'bg-zinc-800 border-amber-400 text-white shadow-xs'
                        : 'bg-zinc-800/40 border-zinc-700 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">💳</span>
                      <span>{t.payMethodTransfer || '💳 โอนเงิน / สแกน QR (PromptPay / Transfer)'}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={deliveryMethod === 'shipping'}
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                      deliveryMethod === 'shipping'
                        ? 'opacity-40 cursor-not-allowed bg-zinc-800/20 border-zinc-800 text-zinc-500'
                        : paymentMethod === 'cash'
                        ? 'bg-zinc-800 border-amber-400 text-white shadow-xs'
                        : 'bg-zinc-800/40 border-zinc-700 text-zinc-400 hover:text-white'
                    }`}
                    title={deliveryMethod === 'shipping' ? (t.cashOnlyPickupNote || 'การจัดส่งถึงบ้านต้องชำระผ่าน QR Code') : ''}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">💵</span>
                        <span>{t.payMethodCash || '💵 ชำระด้วยเงินสด (Cash on Pick-up)'}</span>
                      </div>
                      {deliveryMethod === 'shipping' && (
                        <span className="text-[9.5px] font-mono text-zinc-400 font-normal">
                          {t.pickupOnlyTag || '(เฉพาะรับที่สโมฯ)'}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {paymentMethod === 'transfer' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    <div className="sm:col-span-5 flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-xs">
                      <img 
                        src="/assets/payment_qr.jpg" 
                        alt="Payment QR Code" 
                        className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg"
                        onError={(e) => { e.target.src = getPromptPayQRUrl(grandTotal); }}
                      />
                      <span className="text-[10px] text-zinc-700 font-bold font-mono mt-1">{t.scanQRLabel}</span>
                    </div>
                    <div className="sm:col-span-7 text-xs font-mono space-y-2">
                      <div className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 space-y-1">
                        <span className="text-zinc-400 text-[10.5px]">{t.bankLabel}</span>
                        <div className="font-bold text-emerald-400 text-xs">{STORE_CONFIG.payment.bankName}</div>
                        <div className="text-zinc-400 text-[10.5px] pt-1 border-t border-zinc-700/60">{t.accNoLabel}</div>
                        <div className="font-bold text-white text-sm sm:text-base tracking-widest">{STORE_CONFIG.payment.bankAccountNo}</div>
                        <div className="text-zinc-400 text-[10.5px] pt-1 border-t border-zinc-700/60">{t.accNameLabel}</div>
                        <div className="font-bold text-amber-300 text-xs truncate">{STORE_CONFIG.payment.bankAccountName}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">{t.attachSlipLabel}</label>
                    {!slipPreview ? (
                      <label className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-800/50 rounded-xl p-5 sm:p-6 block text-center cursor-pointer transition-colors">
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
                </>
              ) : (
                <div className="p-4 bg-zinc-800/90 rounded-xl border border-amber-400/40 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs font-mono">
                    <span className="text-base">💵</span>
                    <span>{t.cashNoticeTitle || '💵 ชำระเงินสดตอนมารับเสื้อ'}</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {t.cashNoticeDesc || 'กรุณาเตรียมเงินสดตามยอดชำระ และนำมาชำระ ณ ห้องสโมสรนักศึกษาเมื่อถึงกำหนดวันรับเสื้อ (ไม่ต้องแนบสลิปโอนเงิน)'}
                  </p>
                  <div className="pt-2 border-t border-zinc-700 flex justify-between items-center text-xs font-mono">
                    <span className="text-zinc-400">{t.cashAmountDue || 'ยอดเงินสดที่ต้องชำระ:'}</span>
                    <span className="text-emerald-400 font-bold text-sm">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Total & Submit */}
            <div className="pt-4 border-t border-zinc-200 space-y-2.5">
              {isClosed && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold text-center">
                  ⚠️ ขออภัย สินค้านี้ปิดรับจองแล้ว
                </div>
              )}

              <div className="flex justify-between text-base font-bold font-mono">
                <span>{t.grandTotalLabel}</span>
                <span className="text-xl text-emerald-600">{formatCurrency(grandTotal)}</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isClosed}
                className={`w-full py-3.5 sm:py-4 font-bold text-sm rounded-xl sm:rounded-2xl shadow-lg transition-all active:scale-[0.99] ${
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
