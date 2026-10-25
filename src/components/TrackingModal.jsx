import React, { useState } from 'react';
import { api } from '../config/supabase';
import { formatCurrency, formatDateThai } from '../utils/formatters';
import { STORE_CONFIG } from '../config/storeConfig';
import { useLanguage } from '../context/LanguageContext';
import ReceiptModal from './ReceiptModal';
import PersonalizationSummary from './PersonalizationSummary';
import { personalizedItems } from '../utils/personalization';
import { getFulfillmentProgress } from '../utils/fulfillment';
import { buildTrackQuery } from '../utils/security';

export default function TrackingModal({ isOpen, onClose }) {
  const { t, lang } = useLanguage();
  // Exact match only: the full order id, OR student id + phone together (track_orders RPC)
  const [mode, setMode] = useState('student'); // 'student' | 'order'
  const [orderId, setOrderId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState(null);

  if (!isOpen) return null;

  const canSearch = mode === 'order' ? orderId.trim() !== '' : studentId.trim() !== '' && phone.trim() !== '';

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!canSearch) return;
    const query = mode === 'order' ? { orderId } : { studentId, phone };
    const check = buildTrackQuery(query);
    if (!check.ok) {
      setFormError(check.error);
      return;
    }
    setFormError('');
    setLoading(true);
    try {
      const data = await api.trackOrder(query);
      setResults(data);
    } catch (err) {
      setFormError((t.trackingError || 'ค้นหาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง') + (err?.message ? ` (${err.message})` : ''));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setFormError('');
    setResults(null);
  };

  const inputClass = 'w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm sm:text-xs font-mono focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all';

  const stepLabel = (key) => ({
    paid: t.stepPaid || 'ชำระแล้ว',
    in_production: t.stepInProduction || 'ส่งผลิต',
    ready: t.stepReady || 'พร้อมรับ',
    shipped: t.stepShipped || 'จัดส่งแล้ว',
    completed: t.stepCompleted || 'เสร็จสิ้น'
  }[key]);

  const formatOrderDate = (dateStr) => {
    if (!dateStr) return '-';
    if (lang === 'en') return new Date(dateStr).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    if (lang === 'zh') return new Date(dateStr).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
    return formatDateThai(dateStr, true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* Modal Header */}
          <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 animate-pulse"></span>
              <h3 className="font-bold text-zinc-900 text-sm">{t.trackingTitle}</h3>
            </div>
            <button 
              type="button" 
              onClick={onClose} 
              className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center text-xs font-bold transition-all"
            >
              ✕
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            {/* Search Box: student ID + phone, or the full order ID from the receipt */}
            <form onSubmit={handleSearch} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-xl text-[11px] font-bold">
                {[
                  { key: 'student', label: t.trackByStudent || 'รหัสนักศึกษา + เบอร์โทร' },
                  { key: 'order', label: t.trackByOrderId || 'เลขที่ออเดอร์' }
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => switchMode(m.key)}
                    className={`py-1.5 rounded-lg transition-all ${mode === m.key ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500">{t.trackingSearchHelp}</p>
              {mode === 'order' ? (
                <input
                  type="text"
                  autoComplete="off"
                  placeholder={t.trackingOrderIdPlaceholder || 'เลขที่ออเดอร์แบบเต็มจากใบเสร็จ'}
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className={inputClass}
                />
              ) : (
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t.trackingStudentIdPlaceholder || 'รหัสนักศึกษา'}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder={t.trackingPhonePlaceholder || 'เบอร์โทรที่ใช้ตอนสั่งซื้อ'}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}
              {formError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px]">{formError}</div>
              )}
              <button
                type="submit"
                disabled={loading || !canSearch}
                className="w-full px-5 py-2.5 bg-zinc-900 hover:bg-black disabled:bg-zinc-300 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>{loading ? t.searchingBtn : t.searchBtn}</span>
              </button>
            </form>

            {/* Results Section */}
            <div className="space-y-3">
              {results === null && (
                <div className="p-8 bg-zinc-50 rounded-xl border border-zinc-100 text-center space-y-2">
                  <div className="text-2xl">📦</div>
                  <p className="text-xs text-zinc-600 font-medium">{t.searchInitialPrompt}</p>
                  <p className="text-[10.5px] text-zinc-400">{t.searchInitialSub}</p>
                </div>
              )}

              {results !== null && results.length === 0 && (
                <div className="p-8 bg-zinc-50 rounded-xl border border-zinc-200 text-center space-y-2">
                  <div className="text-2xl">🔍</div>
                  <p className="text-xs font-bold text-zinc-800">{t.searchNotFound}</p>
                  <p className="text-[10.5px] text-zinc-500">
                    {t.searchNotFoundSub}
                  </p>
                </div>
              )}

              {results && results.map((order) => {
                const isConfirmed = order.payment_status === 'confirmed';
                const isRejected = order.payment_status === 'rejected';

                return (
                  <div key={order.id} className="p-3.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-zinc-200 shadow-xs space-y-3 text-xs">
                    
                    {/* Header: ID + Status */}
                    <div className="flex justify-between items-center border-b pb-2.5 gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">Order Ref</span>
                        <div className="font-mono font-bold text-zinc-900 text-xs">#{String(order?.id || '').substring(0, 8)}</div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] font-mono ${
                          isConfirmed ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          isRejected ? 'bg-rose-100 text-rose-800 border border-rose-200' : 
                          'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          <span>
                            {isConfirmed 
                              ? t.statusConfirmed 
                              : isRejected 
                                ? t.statusRejected 
                                : t.statusPending}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Fulfillment timeline: ชำระแล้ว → ส่งผลิต → พร้อมรับ / จัดส่งแล้ว → เสร็จสิ้น */}
                    {(() => {
                      const progress = getFulfillmentProgress(order);
                      if (progress.state === 'rejected') {
                        return (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] font-bold flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px]">✕</span>
                            <span>{t.stepRejected || 'การชำระเงินไม่ผ่านการตรวจสอบ'}</span>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          <div className="text-[10px] font-mono text-zinc-400 uppercase">{t.fulfillmentTitle || 'สถานะคำสั่งซื้อ'}</div>
                          {progress.state === 'awaiting_payment' && (
                            <div className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] font-bold">
                              ⏳ {t.stepAwaitingPayment || 'รอตรวจสอบการชำระเงิน'}
                            </div>
                          )}
                          <ol className="grid grid-cols-4 gap-1">
                            {progress.steps.map((step, idx) => (
                              <li key={step.key} className="flex flex-col items-center text-center gap-1">
                                <div className="flex items-center w-full">
                                  <div className={`h-0.5 flex-1 ${idx === 0 ? 'invisible' : step.reached ? 'bg-emerald-500' : 'bg-zinc-200'}`}></div>
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                    step.reached
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
                                  } ${step.current ? 'ring-2 ring-emerald-200' : ''}`}>
                                    {step.reached ? '✓' : idx + 1}
                                  </span>
                                  <div className={`h-0.5 flex-1 ${idx === progress.steps.length - 1 ? 'invisible' : progress.steps[idx + 1].reached ? 'bg-emerald-500' : 'bg-zinc-200'}`}></div>
                                </div>
                                <span className={`text-[10px] leading-tight ${step.current ? 'font-bold text-zinc-900' : step.reached ? 'text-zinc-700' : 'text-zinc-400'}`}>
                                  {stepLabel(step.key)}
                                </span>
                                {step.key === 'shipped' && step.reached && order.tracking_number && (
                                  <span className="text-[9.5px] font-mono font-bold text-emerald-800 break-all">{order.tracking_number}</span>
                                )}
                              </li>
                            ))}
                          </ol>
                        </div>
                      );
                    })()}

                    {/* Order Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                      <div>
                        <span className="text-zinc-500">{t.buyerLabel}</span>
                        <div className="font-bold text-zinc-900">{order.full_name}</div>
                        <div className="text-[10px] font-mono text-zinc-500">{order.student_id} • {order.major} ({order.year_of_study})</div>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-500">{t.dateLabel}</span>
                        <div className="text-zinc-900">{formatOrderDate(order.created_at)}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{order.phone_number || '-'}</div>
                      </div>
                    </div>

                    {/* Product & Total */}
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-zinc-900">{order.products?.name || order.product_name || 'ARCH T-Shirt'}</span>
                        <div className="text-[11px] text-zinc-600 font-mono">
                          {t.sizeColorLabel} <strong>{order.size}</strong> {order.color ? `(${order.color})` : ''} | {t.step3Qty} <strong>{order.quantity}</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500">{t.amountLabel}</span>
                        <div className="font-mono font-bold text-sm text-zinc-950">
                          {formatCurrency(order.total_price)}
                        </div>
                      </div>
                    </div>

                    {/* Jersey names/numbers saved with the order */}
                    {personalizedItems(order.order_items).length > 0 && (
                      <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-100 space-y-1.5 text-[11px]">
                        <div className="font-bold text-zinc-700">👕 ชื่อ/เบอร์บนเสื้อ</div>
                        {personalizedItems(order.order_items).map((it, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <div className="text-zinc-600">{it.product_name} <span className="font-mono">[{it.size}]</span></div>
                            <PersonalizationSummary units={it.personalization} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Delivery & Status Details */}
                    <div className="text-[11px] text-zinc-600 space-y-1 pt-1 border-t">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">การชำระเงิน:</span>
                        <span className="font-bold text-zinc-800">💳 โอนเงิน / QR Code</span>
                      </div>


                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">{t.deliveryMethodLabel}</span>
                        <span className="font-medium text-zinc-800">
                          {order.delivery_method === 'shipping'
                            ? `🚚 ${t.shippingOption}${order.shipping_address ? ` (${order.shipping_address})` : ''}`
                            : `📍 ${STORE_CONFIG.faculty.pickupLocation}`}
                        </span>
                      </div>

                      {isRejected && (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[10.5px]">
                          ⚠️ <strong>Notice:</strong> Slip verification failed. Please contact Student Union committee with proof of transfer.
                        </div>
                      )}

                      {order.tracking_number && (
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-1.5">
                          <span>📦</span>
                          <span className="font-bold">เลขพัสดุ:</span>
                          <span className="font-mono font-bold">{order.tracking_number}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex justify-end items-center pt-2 border-t gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingReceiptOrder(order)}
                        className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-all"
                      >
                        <span>{t.printReceiptBtn}</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Printable Receipt Modal */}
      {viewingReceiptOrder && (
        <ReceiptModal
          order={viewingReceiptOrder}
          product={viewingReceiptOrder.products}
          onClose={() => setViewingReceiptOrder(null)}
        />
      )}
    </>
  );
}
