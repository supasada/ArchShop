import { formatPersonalizationText, buildPrintSheetRows } from './personalization';
import { FULFILLMENT_LABELS, normalizeFulfillmentStatus } from './fulfillment';

// Most cells hold customer-written text. A cell starting with = + - @ (or tab / CR) is run
// as a formula by Excel / Sheets, so prefix it with a single quote to keep it plain text.
// A lone "-" (our own empty placeholder) cannot be a formula and is left as is.
const FORMULA_START = /^[=+\-@\t\r]/;
const guardFormula = (s) => (FORMULA_START.test(s) && s !== '-' ? `'${s}` : s);

// Helper for normal text escaping
export const escapeCSV = (str) => {
  if (str === null || str === undefined || str === '') return '""';
  return `"${guardFormula(String(str)).replace(/"/g, '""')}"`;
};

// Helper to force Excel to treat numeric strings (Phone, Student ID, Order ID) strictly as TEXT,
// written as ="value". A quote inside is doubled once for the formula string and once more for
// CSV, so a customer-written value cannot close the string and append its own formula.
export const escapeExcelText = (str) => {
  if (str === null || str === undefined || str === '') return '""';
  const cleaned = String(str).replace(/[\r\n]+/g, ' ').replace(/"/g, '""""');
  return `"=""${cleaned}"""`;
};

// UTF-8 BOM so Excel correctly displays Thai characters (ภาษาไทยไม่เป็นภาษาต่างดาว)
const BOM = '﻿';

// Helper to format date cleanly as YYYY-MM-DD HH:mm:ss without causing #### in Excel
const formatDateTime = (dateVal) => {
  if (!dateVal) return '-';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return String(dateVal);
  }
};

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildOrdersCSV(orders, products = []) {
  const headers = [
    'หมายเลขคำสั่งซื้อ (Order ID)',
    'วันเวลาที่สั่งซื้อ (Timestamp)',
    'ชื่อ-นามสกุล (Full Name)',
    'รหัสนักศึกษา (Student ID)',
    'ชั้นปี (Year)',
    'ภาควิชา/สาขา (Major)',
    'เบอร์โทรศัพท์ (Phone)',
    'LINE ID / Email',
    'ชื่อสินค้า (Product)',
    'สี (Color)',
    'ไซส์ (Size)',
    'จำนวน (Qty)',
    'ยอดเงินรวม (Total Price THB)',
    'วิธีรับสินค้า (Delivery Method)',
    'ที่อยู่จัดส่ง (Shipping Address)',
    'ช่องทางการชำระเงิน (Payment Method)',
    'สถานะการชำระเงิน (Payment Status)',
    'สถานะการผลิต/จัดส่ง (Fulfillment)',
    'ไฟล์สลิปโอนเงิน (Slip file — เปิดดูในหน้าแอดมิน)',
    'หมายเหตุ (Notes)',
    'ชื่อ/เบอร์บนเสื้อ (Name/Number)'
  ];

  const rows = orders.map((o) => {
    const prod = o.products || products.find(p => p.id === o.product_id) || {};
    const payMethodText = 'โอนเงิน/QR (PromptPay)';

    return [
      escapeExcelText(o.id),
      escapeExcelText(formatDateTime(o.created_at)),
      escapeCSV(o.full_name),
      escapeExcelText(o.student_id),
      escapeCSV(o.year_of_study),
      escapeCSV(o.major),
      escapeExcelText(o.phone_number),
      escapeCSV(o.email_or_line_id),
      escapeCSV(prod.name || o.product_name || 'เสื้อสโมสรฯ'),
      escapeCSV(o.color),
      escapeCSV(o.size),
      Number(o.quantity) || 1,
      Number(o.total_price) || 0,
      escapeCSV(o.delivery_method === 'shipping' ? 'จัดส่งพัสดุ' : 'รับที่ห้องสโมสร'),
      escapeCSV(o.shipping_address || '-'),
      escapeCSV(payMethodText),
      escapeCSV(o.payment_status),
      escapeCSV(FULFILLMENT_LABELS[normalizeFulfillmentStatus(o.fulfillment_status)]),
      escapeCSV(o.payment_slip_url || '-'),
      escapeCSV(o.notes || '-'),
      escapeCSV(formatPersonalizationText(o.order_items))
    ].join(',');
  });

  return BOM + headers.join(',') + '\r\n' + rows.join('\r\n');
}

/**
 * Export Orders to CSV (Optimized for Microsoft Excel, Google Sheets, & Numbers)
 */
export function exportOrdersToCSV(orders, products = []) {
  if (!orders || orders.length === 0) {
    alert('ไม่มีรายการคำสั่งซื้อที่จะส่งออก');
    return;
  }
  downloadCSV(buildOrdersCSV(orders, products), `ArchClub_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
}

/** Print-shop sheet ("รายการสกรีน"): one row per shirt that has a name or number. */
export function buildPrintSheetCSV(rows) {
  const headers = [
    'สินค้า (Product)',
    'ตัวเลือก (Variant)',
    'ไซส์ (Size)',
    'สี (Color)',
    'ชื่อบนเสื้อ (Name)',
    'เบอร์ (Number)',
    'หมายเลขคำสั่งซื้อ (Order ID)',
    'ผู้สั่งซื้อ (Customer)',
    'รหัสนักศึกษา (Student ID)',
    'เบอร์โทรศัพท์ (Phone)',
    'สถานะการชำระเงิน (Payment Status)'
  ];
  const lines = rows.map((r) => [
    escapeCSV(r.product),
    escapeCSV(r.variant),
    escapeCSV(r.size),
    escapeCSV(r.color),
    escapeCSV(r.name),
    escapeExcelText(r.number), // keep "07" as "07"
    escapeExcelText(r.order_id),
    escapeCSV(r.customer),
    escapeExcelText(r.student_id),
    escapeExcelText(r.phone),
    escapeCSV(r.payment_status)
  ].join(','));
  return BOM + headers.join(',') + '\r\n' + lines.join('\r\n');
}

/** Confirmed orders only unless options.includeUnconfirmed (rejected never). */
export function exportPrintSheetToCSV(orders, products = [], options = {}) {
  const rows = buildPrintSheetRows(orders, products, options);
  if (rows.length === 0) {
    alert(options.includeUnconfirmed
      ? 'ไม่มีรายการชื่อ/เบอร์บนเสื้อในคำสั่งซื้อที่แสดงอยู่'
      : 'ไม่มีรายการชื่อ/เบอร์บนเสื้อในคำสั่งซื้อที่ยืนยันแล้ว');
    return;
  }
  downloadCSV(buildPrintSheetCSV(rows), `ArchClub_PrintSheet_${new Date().toISOString().slice(0, 10)}.csv`);
}
