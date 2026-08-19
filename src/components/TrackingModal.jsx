import React, { useState } from 'react';
import { api } from '../config/supabase';
import { formatCurrency, formatDateThai } from '../utils/formatters';
import { STORE_CONFIG } from '../config/storeConfig';
import ReceiptModal from './ReceiptModal';

export default function TrackingModal({ isOpen, onClose }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState(null);
  const [previewSlip, setPreviewSlip] = useState(null);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e?.preventDefault();
    const cleanTerm = term.trim();
    if (!cleanTerm) return;

    setLoading(true);
    try {
      const data = await api.trackOrder(cleanTerm);
      setResults(data);
    } catch (err) {
      alert('ค้นหาไม่สำเร็จ: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTerm('');
    setResults(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* Modal Header */}
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-900"></span>
              <h3 className="font-bold text-zinc-900 text-sm">ตรวจสอบสถานะคำสั่งซื้อ & พิมพ์ใบเสร็จ</h3>
            </div>
            <button 
              type="button" 
              onClick={onClose} 
              className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center text-xs font-bold transition-all"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Search Box */}
            <form onSubmit={handleSearch} className="space-y-2">
              <label className="text-[11px] font-mono text-zinc-500">
                ค้นหาด้วย: รหัสนักศึกษา (11 หลัก), เบอร์โทรศัพท์, ชื่อ-นามสกุล หรือ Order ID
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="เช่น 65010234567 หรือ 0812345678"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full pl-3.5 pr-8 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all"
                  />
                  {term && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || !term.trim()}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-black disabled:bg-zinc-300 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0"
                >
                  {loading ? (
                    <span>กำลังค้นหา...</span>
                  ) : (
                    <span>🔍 ค้นหา</span>
                  )}
                </button>
              </div>
            </form>

            {/* Results Section */}
            <div className="space-y-3">
              {results === null && (
                <div className="p-8 bg-zinc-50 rounded-xl border border-zinc-100 text-center space-y-2">
                  <div className="text-2xl">📦</div>
                  <p className="text-xs text-zinc-600 font-medium">กรอกรหัสนักศึกษาหรือเบอร์โทรศัพท์เพื่อตรวจสอบสถานะ</p>
                  <p className="text-[10.5px] text-zinc-400">ระบบจะค้นหาประวัติการจองเสื้อและสถานะการตรวจสอบสลิปโอนเงิน</p>
                </div>
              )}

              {results !== null && results.length === 0 && (
                <div className="p-8 bg-zinc-50 rounded-xl border border-zinc-200 text-center space-y-2">
                  <div className="text-2xl">🔍</div>
                  <p className="text-xs font-bold text-zinc-800">ไม่พบข้อมูลคำสั่งซื้อสำหรับ "{term}"</p>
                  <p className="text-[10.5px] text-zinc-500">
                    กรุณาตรวจสอบความถูกต้องของรหัสนักศึกษา หรือติดต่อสโมสรนักศึกษา
                  </p>
                </div>
              )}

              {results && results.map((order) => {
                const isConfirmed = order.payment_status === 'confirmed';
                const isRejected = order.payment_status === 'rejected';

                return (
                  <div key={order.id} className="p-4 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-3 text-xs">
                    
                    {/* Header: ID + Status */}
                    <div className="flex justify-between items-center border-b pb-2.5">
                      <div>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">Order Ref</span>
                        <div className="font-mono font-bold text-zinc-900 text-xs">#{order.id.substring(0, 8)}</div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] font-mono ${
                          isConfirmed ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          isRejected ? 'bg-rose-100 text-rose-800 border border-rose-200' : 
                          'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          <span>{isConfirmed ? '✓ ยืนยันยอดแล้ว' : isRejected ? '✕ สลิปไม่ถูกต้อง' : '⏳ รอตรวจสอบสลิป'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Order Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                      <div>
                        <span className="text-zinc-500">ผู้สั่งซื้อ:</span>
                        <div className="font-bold text-zinc-900">{order.full_name}</div>
                        <div className="text-[10px] font-mono text-zinc-500">{order.student_id} • {order.major} ({order.year_of_study})</div>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-500">วันที่ทำรายการ:</span>
                        <div className="text-zinc-900">{formatDateThai(order.created_at, true)}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">โทร: {order.phone_number || '-'}</div>
                      </div>
                    </div>

                    {/* Product & Total */}
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-zinc-900">{order.products?.name || order.product_name || 'เสื้อสโมสรนักศึกษา'}</span>
                        <div className="text-[11px] text-zinc-600 font-mono">
                          ไซส์: <strong>{order.size}</strong> {order.color ? `(${order.color})` : ''} | จำนวน: <strong>{order.quantity} ตัว</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500">ยอดชำระ</span>
                        <div className="font-mono font-bold text-sm text-zinc-950">
                          {formatCurrency(order.total_price)}
                        </div>
                      </div>
                    </div>

                    {/* Delivery & Status Details */}
                    <div className="text-[11px] text-zinc-600 space-y-1 pt-1 border-t">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">การรับสินค้า:</span>
                        <span className="font-medium text-zinc-800">
                          {order.delivery_method === 'shipping' 
                            ? `🚚 จัดส่งพัสดุ (${order.shipping_address || '-'})` 
                            : `📍 ${STORE_CONFIG.faculty.pickupLocation}`}
                        </span>
                      </div>

                      {isRejected && (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[10.5px]">
                          ⚠️ <strong>หมายเหตุจากสโมสร:</strong> สลิปโอนเงินไม่ถูกต้องหรือไม่มียอดเงิน กรุณาติดต่อเพจสโมสรนักศึกษาเพื่อส่งหลักฐานใหม่
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex justify-between items-center pt-2 border-t gap-2">
                      {order.payment_slip_url ? (
                        <button
                          type="button"
                          onClick={() => setPreviewSlip(order.payment_slip_url)}
                          className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-[11px] font-medium transition-all"
                        >
                          👁️ ดูสลิปที่แนบ
                        </button>
                      ) : <span />}

                      <button
                        type="button"
                        onClick={() => setViewingReceiptOrder(order)}
                        className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-all"
                      >
                        <span>🖨️ พิมพ์ใบเสร็จ (1 แผ่น)</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Slip Preview Modal */}
      {previewSlip && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setPreviewSlip(null)}>
          <div className="bg-white max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-bold text-xs text-zinc-900">หลักฐานสลิปโอนเงิน</h4>
              <button type="button" onClick={() => setPreviewSlip(null)} className="text-zinc-400 hover:text-zinc-700 text-xs">✕</button>
            </div>
            <div className="max-h-96 overflow-auto rounded-lg bg-zinc-100 flex items-center justify-center">
              <img src={previewSlip} alt="Payment Slip" className="w-full h-auto object-contain rounded-lg" />
            </div>
            <button
              type="button"
              onClick={() => setPreviewSlip(null)}
              className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-all"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

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
