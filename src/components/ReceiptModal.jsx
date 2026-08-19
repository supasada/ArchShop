import React from 'react';
import { formatCurrency, formatDateThai } from '../utils/formatters';
import { STORE_CONFIG } from '../config/storeConfig';

export default function ReceiptModal({ order, product, onClose }) {
  if (!order) return null;

  const prodName = product?.name || order.products?.name || order.product_name || 'เสื้อสโมสรนักศึกษา 2026';
  const unitPrice = product?.price || (order.quantity > 0 ? (order.total_price / order.quantity) : 350);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div id="printable-receipt" className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden">
        
        {/* On-Screen Success Header */}
        <div className="p-4 bg-zinc-900 text-white text-center no-print">
          <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-1.5 shadow-md font-bold text-base">
            ✓
          </div>
          <h3 className="text-base font-bold">บันทึกคำสั่งจองสำเร็จ!</h3>
          <p className="text-[11px] text-zinc-400">สโมสรนักศึกษาได้รับข้อมูลเรียบร้อยแล้ว</p>
        </div>

        {/* Official Printable Receipt Content */}
        <div className="p-4 space-y-2.5 text-xs font-mono">
          
          {/* Header */}
          <div className="text-center pb-2 border-b-2 border-zinc-900 space-y-0.5">
            <div className="text-xs font-bold text-zinc-900 tracking-wider">
              สโมสรนักศึกษาคณะสถาปัตยกรรมศาสตร์
            </div>
            <div className="text-[10px] text-zinc-500 uppercase">
              FACULTY OF ARCHITECTURE STUDENT UNION
            </div>
            <div className="inline-block px-2.5 py-0.5 mt-0.5 bg-zinc-100 border border-zinc-300 rounded font-bold text-[10px] text-zinc-800">
              ใบเสร็จรับเงิน / คำสั่งจองเสื้อ (PRE-ORDER RECEIPT)
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-1 text-[10px] py-1 border-b border-zinc-200">
            <div>
              <span className="text-zinc-500">เลขที่ออเดอร์:</span>
              <div className="font-bold text-zinc-900">#{order.id}</div>
            </div>
            <div className="text-right">
              <span className="text-zinc-500">วันที่:</span>
              <div className="font-bold text-zinc-900">{formatDateThai(order.created_at || new Date(), true)}</div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-zinc-500">ผู้สั่งซื้อ:</span>
              <span className="font-bold text-zinc-900">{order.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">รหัสนักศึกษา:</span>
              <span className="font-bold text-zinc-900">{order.student_id || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">ภาควิชา/ชั้นปี:</span>
              <span className="text-zinc-900">{order.major} ({order.year_of_study})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">เบอร์โทร:</span>
              <span className="text-zinc-900">{order.phone_number || '-'}</span>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-600 font-bold">
                <th className="py-1">รายการ</th>
                <th className="py-1 text-center">ไซส์/สี</th>
                <th className="py-1 text-center">จำนวน</th>
                <th className="py-1 text-right">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              <tr>
                <td className="py-1.5 font-bold text-zinc-900 truncate max-w-[140px]">
                  {prodName}
                </td>
                <td className="py-1.5 text-center font-bold">
                  {order.size} {order.color ? `(${order.color})` : ''}
                </td>
                <td className="py-1.5 text-center">
                  {order.quantity} ตัว
                </td>
                <td className="py-1.5 text-right font-bold">
                  {formatCurrency(unitPrice * order.quantity)}
                </td>
              </tr>
              {order.delivery_method === 'shipping' && (
                <tr>
                  <td colSpan="3" className="py-1 text-zinc-500">
                    ค่าจัดส่งพัสดุ
                  </td>
                  <td className="py-1 text-right font-bold">
                    {formatCurrency(STORE_CONFIG.faculty.shippingFee)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-900 font-bold text-[11px]">
                <td colSpan="3" className="py-1.5 text-zinc-900">ยอดชำระสุทธิ (Grand Total):</td>
                <td className="py-1.5 text-right text-emerald-600 text-xs">{formatCurrency(order.total_price)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Delivery & Status Box */}
          <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-200 space-y-0.5 text-[10px]">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">วิธีรับสินค้า:</span>
              <span className="font-bold text-zinc-900">
                {order.delivery_method === 'shipping' ? `🚚 พัสดุ (${order.shipping_address})` : `📍 ${STORE_CONFIG.faculty.pickupLocation}`}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t">
              <span className="text-zinc-500">สถานะชำระเงิน:</span>
              <span className="font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px]">
                {order.payment_status === 'confirmed' ? '✓ ชำระเงินเรียบร้อย (PAID)' : '⏳ รอตรวจสอบสลิป'}
              </span>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-4 pt-2 text-center text-[9px] text-zinc-600">
            <div className="space-y-4">
              <div className="border-b border-zinc-300 h-4"></div>
              <div>ลงชื่อ: .......................................<br/>(เจ้าหน้าที่สโมสรผู้รับเงิน)</div>
            </div>
            <div className="space-y-4">
              <div className="border-b border-zinc-300 h-4"></div>
              <div>ลงชื่อ: .......................................<br/>(ผู้สั่งซื้อ / ผู้รับสินค้า)</div>
            </div>
          </div>

          {/* Note Footer */}
          <div className="text-center text-[8.5px] text-zinc-400 pt-1 border-t">
            * กรุณาเก็บใบเสร็จนี้หรือภาพหน้าจอไว้เป็นหลักฐานรับเสื้อที่สโมสรนักศึกษา *
          </div>

        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-2.5 bg-zinc-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <span>🖨️ พิมพ์ใบเสร็จ (1 แผ่น)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold text-xs rounded-xl transition-all"
          >
            ปิด
          </button>
        </div>

      </div>
    </div>
  );
}
