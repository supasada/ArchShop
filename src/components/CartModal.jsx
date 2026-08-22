import React, { useState } from 'react';
import { STORE_CONFIG } from '../config/storeConfig';
import { formatCurrency, getPromptPayQRUrl } from '../utils/formatters';
import { api } from '../config/supabase';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';

export default function CartModal({ isOpen, onClose, onSuccess, onOpenSizeChart }) {
  const { t } = useLanguage();
  const { cartItems, updateQuantity, removeFromCart, clearCart, subtotal, totalItems } = useCart();

  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
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

  if (!isOpen) return null;

  const shippingFee = deliveryMethod === 'shipping' ? STORE_CONFIG.faculty.shippingFee : 0;
  const grandTotal = subtotal + (cartItems.length > 0 ? shippingFee : 0);

  const handleFileChange = (file) => {
    if (!file) return;
    if (!file.type.match(/^image\//i)) {
      alert(t.errImageFormat || 'กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(t.errImageSize || 'ขนาดไฟล์ต้องไม่เกิน 5 MB');
      return;
    }
    setSlipFile(file);
    setSlipPreview(URL.createObjectURL(file));
  };

  const handleYearChange = (year) => {
    setFormData(prev => ({
      ...prev,
      yearOfStudy: year
    }));
  };

  const handleSubmitOrder = async (e) => {
    e?.preventDefault();

    if (cartItems.length === 0) {
      alert('ไม่มีสินค้าในตะกร้า');
      return;
    }

    const fullName = (formData.fullName || '').trim();
    const studentId = (formData.studentId || '').trim();
    const yearOfStudy = (formData.yearOfStudy || '').trim();
    const major = (formData.major || '').trim();
    const phone = (formData.phone || '').trim();
    const contact = (formData.contact || '').trim();
    const address = (formData.address || '').trim();

    if (!fullName || fullName.length < 2) {
      alert(t.errFullName || 'กรุณากรอกชื่อ-นามสกุลจริง');
      return;
    }
    if (!studentId || studentId.length < 4) {
      alert(t.errStudentId || 'กรุณากรอกรหัสนักศึกษา (เช่น 65010234567)');
      return;
    }
    if (!yearOfStudy) {
      alert(t.errYear || 'กรุณาเลือกระดับชั้นปี');
      return;
    }
    if (!major) {
      alert(t.errMajor || 'กรุณาเลือกสาขาวิชา / ภาควิชา');
      return;
    }
    if (!phone || phone.length < 8) {
      alert(t.errPhone || 'กรุณากรอกเบอร์โทรศัพท์ที่ติดต่อได้');
      return;
    }
    if (!contact) {
      alert(t.errContact || 'กรุณากรอก LINE ID หรือ อีเมล');
      return;
    }
    if (deliveryMethod === 'shipping' && (!address || address.length < 5)) {
      alert(t.errAddress || 'กรุณากรอกที่อยู่จัดส่งพัสดุให้ครบถ้วน');
      return;
    }

    if (!slipFile) {
      alert(t.errSlip || 'กรุณาแนบภาพสลิปหลักฐานการโอนเงิน (PromptPay QR / บัญชีธนาคาร)');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload Slip
      const slipUrl = await api.uploadSlip(slipFile, studentId);

      // 2. Prepare items list and summary
      const itemsSummary = cartItems
        .map((it) => `${it.productName} [${it.size}/${it.color}] x${it.quantity}`)
        .join(' | ');

      const combinedNotes = formData.notes
        ? `[${itemsSummary}] ${formData.notes.trim()}`
        : `[${itemsSummary}]`;

      const primaryItem = cartItems[0];

      const orderPayload = {
        product_id: primaryItem?.productId,
        full_name: fullName,
        student_id: studentId,
        year_of_study: yearOfStudy,
        major: major,
        phone_number: phone,
        email_or_line_id: contact,
        color: cartItems.map((it) => it.color).filter((v, i, a) => a.indexOf(v) === i).join(', '),
        size: cartItems.map((it) => `${it.size}(${it.quantity})`).join(', '),
        quantity: totalItems,
        total_price: grandTotal,
        payment_slip_url: slipUrl,
        delivery_method: deliveryMethod,
        shipping_address: deliveryMethod === 'shipping' ? address : null,
        notes: combinedNotes,
        payment_status: 'pending',
        items: cartItems
      };


      const created = await api.submitOrder(orderPayload);
      
      // Store full items info on created order for printable receipt
      created.items = cartItems;
      created.product_name = cartItems.map(it => it.productName).join(' + ');

      // Clear cart
      clearCart();
      onClose();
      onSuccess(created, primaryItem);
    } catch (err) {
      console.error('Cart checkout error:', err);
      alert('ส่งคำสั่งซื้อไม่สำเร็จ: ' + (err.message || err));
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
            <span className="text-lg sm:text-xl">🛒</span>
            <h3 className="font-bold text-zinc-900 text-sm sm:text-base">
              {t.cartTitle || 'ตะกร้าสินค้า & ชำระเงิน'} ({totalItems})
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-xl bg-zinc-200/80 hover:bg-zinc-300 flex items-center justify-center text-zinc-700 text-xs font-bold transition-all active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        {cartItems.length === 0 ? (
          <div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center text-2xl">
              🛒
            </div>
            <div>
              <h4 className="font-bold text-zinc-800 text-base">{t.cartEmpty || 'ไม่มีสินค้าในตะกร้า'}</h4>
              <p className="text-xs text-zinc-500 mt-1">{t.cartEmptyDesc || 'เลือกเสื้อที่คุณชื่นชอบแล้วกดเพิ่มลงตะกร้าได้เลยครับ'}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95"
            >
              {t.cartBrowseBtn || 'เลือกดูสินค้า (Browse Shirts)'}
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
            
            {/* 1. Items List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-xs font-mono font-bold text-zinc-900 uppercase">
                  {t.cartItemsSection || '1. รายการสินค้าในตะกร้า'} ({cartItems.length})
                </h4>
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[11px] font-mono text-rose-600 hover:underline font-bold"
                >
                  {t.cartClearAll || 'ล้างตะกร้าทั้งหมด'}
                </button>
              </div>


              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden bg-zinc-50/50">
                {cartItems.map((item) => (
                  <div key={item.cartId} className="p-3 sm:p-4 flex items-center justify-between gap-3 bg-white hover:bg-zinc-50/60 transition-colors">
                    
                    {/* Thumbnail & Name */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={item.imageFrontUrl}
                        alt={item.productName}
                        className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-xl border border-zinc-200 shadow-2xs shrink-0"
                        onError={(e) => { e.target.src = '/assets/images/arch_shirt_front.jpg'; }}
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-zinc-900 text-xs sm:text-sm truncate">
                          {item.productName}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="px-2 py-0.5 bg-zinc-100 text-zinc-800 rounded font-mono text-[10.5px] font-bold border border-zinc-200">
                            ไซส์: {item.size}
                          </span>
                          <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded font-mono text-[10.5px] border border-zinc-200">
                            {item.color}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-500 font-bold">
                            @ {formatCurrency(item.price)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity + Item Total + Delete */}
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      
                      {/* Qty Counter */}
                      <div className="inline-flex items-center border border-zinc-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                          className="w-7 h-7 sm:w-8 sm:h-8 text-zinc-600 hover:bg-zinc-100 font-bold flex items-center justify-center text-xs"
                        >
                          -
                        </button>
                        <span className="w-7 sm:w-8 text-center font-mono font-bold text-xs">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                          className="w-7 h-7 sm:w-8 sm:h-8 text-zinc-600 hover:bg-zinc-100 font-bold flex items-center justify-center text-xs"
                        >
                          +
                        </button>
                      </div>

                      {/* Item Total */}
                      <div className="text-right min-w-[65px] sm:min-w-[80px]">
                        <div className="font-mono font-bold text-xs sm:text-sm text-zinc-950">
                          {formatCurrency(item.price * item.quantity)}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.cartId)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700 flex items-center justify-center transition-colors text-xs"
                        title="ลบรายการนี้"
                      >
                        🗑️
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitOrder} noValidate className="space-y-6">
              
              {/* 2. Customer Information */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-mono font-bold text-zinc-900 uppercase pb-1 border-b border-zinc-200">
                  {t.cartCustomerSection || '2. ข้อมูลผู้สั่งจอง'}
                </h4>


                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t.fullNameLabel || 'ชื่อ-นามสกุล *'}</label>
                    <input
                      type="text"
                      required
                      placeholder={t.fullNamePlaceholder || 'เช่น นายปวริศร สถาปัตย์พัฒนา'}
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t.studentIdLabel || 'รหัสนักศึกษา (11 หลัก) *'}</label>
                    <input
                      type="text"
                      required
                      placeholder={t.studentIdPlaceholder || 'เช่น 65010234567'}
                      value={formData.studentId}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t.yearLabel || 'ระดับชั้นปี *'}</label>
                    <select
                      required
                      value={formData.yearOfStudy}
                      onChange={(e) => handleYearChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">{t.yearPlaceholder || '-- เลือกระดับชั้นปี --'}</option>
                      {STORE_CONFIG.years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t.majorLabel || 'ภาควิชา / สาขา *'}</label>
                    <select
                      required
                      value={formData.major}
                      onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    >
                      <option value="">{t.majorPlaceholder || '-- เลือกสาขาวิชา --'}</option>
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
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t.phoneLabel || 'เบอร์โทรศัพท์ *'}</label>
                    <input
                      type="tel"
                      required
                      placeholder={t.phonePlaceholder || '0812345678'}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t.contactLabel || 'LINE ID หรือ อีเมล *'}</label>
                    <input
                      type="text"
                      required
                      placeholder={t.contactPlaceholder || 'line: arch_student หรือ email'}
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Delivery Method */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold text-zinc-900 uppercase pb-1 border-b border-zinc-200">
                  {t.cartDeliverySection || '3. วิธีการรับสินค้า'}
                </h4>


                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    deliveryMethod === 'pickup' ? 'border-black bg-zinc-50 shadow-xs' : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}>
                    <input
                      type="radio"
                      name="cartDeliveryMethod"
                      value="pickup"
                      checked={deliveryMethod === 'pickup'}
                      onChange={() => setDeliveryMethod('pickup')}
                      className="mt-0.5 accent-black"
                    />
                    <div>
                      <div className="font-bold text-xs text-zinc-900">{t.pickupOption || 'รับที่ห้องสโมสรนักศึกษา'}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 leading-tight">{t.pickupDesc || 'ฟรี ตึกสถาปัตย์ ชั้น 1'}</div>
                      <div className="text-[10.5px] font-mono text-emerald-600 font-bold mt-1">ฟรี (Free)</div>
                    </div>
                  </label>

                  <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    deliveryMethod === 'shipping' ? 'border-black bg-zinc-50 shadow-xs' : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}>
                    <input
                      type="radio"
                      name="cartDeliveryMethod"
                      value="shipping"
                      checked={deliveryMethod === 'shipping'}
                      onChange={() => setDeliveryMethod('shipping')}
                      className="mt-0.5 accent-black"
                    />
                    <div>
                      <div className="font-bold text-xs text-zinc-900">{t.shippingOption || 'จัดส่งพัสดุถึงที่อยู่'}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 leading-tight">{t.shippingDesc || '+ ค่าบริการขนส่ง'}</div>
                      <div className="text-[10.5px] font-mono text-zinc-700 font-bold mt-1">+ {formatCurrency(STORE_CONFIG.faculty.shippingFee)}</div>
                    </div>
                  </label>
                </div>


                {deliveryMethod === 'shipping' && (
                  <div className="pt-1">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">{t.addressLabel || 'ที่อยู่สำหรับจัดส่งพัสดุ *'}</label>
                    <textarea
                      required
                      rows="3"
                      placeholder={t.addressPlaceholder || 'บ้านเลขที่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์'}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    ></textarea>
                  </div>
                )}
              </div>

              {/* 4. Notes */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">หมายเหตุเพิ่มเติม (ถ้ามี)</label>
                <input
                  type="text"
                  placeholder="เช่น ฝากไว้ที่ห้องสโมสร หรือข้อความเพิ่มเติม"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              {/* 5. Payment QR Code & Slip */}
              <div className="p-4 sm:p-5 bg-zinc-900 text-white rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                  <span className="text-xs font-mono font-bold">💳 ข้อมูลการชำระเงิน (PromptPay QR)</span>
                  <span className="text-xs font-mono font-bold text-amber-400">ยอดชำระสุทธิ: {formatCurrency(grandTotal)}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  <div className="sm:col-span-5 flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-xs">
                    <img 
                      src="/assets/payment_qr.jpg" 
                      alt="Payment QR Code" 
                      className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg"
                      onError={(e) => { e.target.src = getPromptPayQRUrl(grandTotal); }}
                    />
                    <span className="text-[10px] text-zinc-700 font-bold font-mono mt-1">สแกน QR Code ชำระเงิน</span>
                  </div>
                  <div className="sm:col-span-7 text-xs font-mono space-y-2">
                    <div className="bg-zinc-800 p-3 rounded-xl border border-zinc-700 space-y-1">
                      <span className="text-zinc-400 text-[10.5px]">ธนาคาร:</span>
                      <div className="font-bold text-emerald-400 text-xs">{STORE_CONFIG.payment.bankName}</div>
                      <div className="text-zinc-400 text-[10.5px] pt-1 border-t border-zinc-700/60">เลขที่บัญชี:</div>
                      <div className="font-bold text-white text-sm sm:text-base tracking-widest">{STORE_CONFIG.payment.bankAccountNo}</div>
                      <div className="text-zinc-400 text-[10.5px] pt-1 border-t border-zinc-700/60">ชื่อบัญชี:</div>
                      <div className="font-bold text-amber-300 text-xs truncate">{STORE_CONFIG.payment.bankAccountName}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">แนบภาพสลิปโอนเงิน *</label>
                  {!slipPreview ? (
                    <label className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-800/50 rounded-xl p-5 sm:p-6 block text-center cursor-pointer transition-colors">
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files[0])} className="hidden" />
                      <span className="text-xs text-zinc-200 font-medium">คลิกเพื่อเลือกไฟล์รูปสลิป</span>
                      <span className="text-[10px] text-zinc-400 block mt-1 font-mono">JPG, PNG, WEBP (ไม่เกิน 5MB)</span>
                    </label>
                  ) : (
                    <div className="bg-zinc-800 p-3 rounded-xl flex items-center justify-between border border-zinc-700">
                      <img src={slipPreview} alt="Slip" className="w-12 h-12 object-cover rounded-lg" />
                      <span className="text-xs text-white truncate max-w-[150px]">{slipFile?.name}</span>
                      <button type="button" onClick={() => { setSlipFile(null); setSlipPreview(null); }} className="text-xs text-rose-400 font-bold hover:underline">
                        เปลี่ยนรูป
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Summary & Submit Button */}
              <div className="pt-4 border-t border-zinc-200 space-y-3">
                <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-zinc-600">
                    <span>ยอดรวมสินค้า ({totalItems} ตัว):</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {deliveryMethod === 'shipping' && (
                    <div className="flex justify-between text-zinc-600">
                      <span>ค่าบริการจัดส่งพัสดุ:</span>
                      <span>{formatCurrency(STORE_CONFIG.faculty.shippingFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-zinc-950 pt-1.5 border-t border-zinc-200">
                    <span>ยอดชำระสุทธิ (Grand Total):</span>
                    <span className="text-emerald-600 text-base">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-black text-white font-bold text-sm sm:text-base rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  <span>{isSubmitting ? (t.submittingBtn || 'กำลังบันทึกคำสั่งซื้อ...') : (t.cartConfirmOrderBtn || '✓ ยืนยันการสั่งจองและชำระเงิน')}</span>

                </button>
              </div>

            </form>

          </div>
        )}

      </div>
    </div>
  );
}
