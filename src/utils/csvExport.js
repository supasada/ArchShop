/**
 * Export Orders to CSV (Optimized for Microsoft Excel, Google Sheets, & Numbers)
 */
export function exportOrdersToCSV(orders, products = []) {
  if (!orders || orders.length === 0) {
    alert('ไม่มีรายการคำสั่งซื้อที่จะส่งออก');
    return;
  }

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
    'ลิงก์สลิปโอนเงิน (Slip URL)',
    'หมายเหตุ (Notes)'
  ];

  // Helper for normal text escaping
  const escapeCSV = (str) => {
    if (str === null || str === undefined || str === '') return '""';
    return `"${String(str).replace(/"/g, '""')}"`;
  };

  // Helper to force Excel to treat numeric strings (Phone, Student ID, Order ID) strictly as TEXT
  const escapeExcelText = (str) => {
    if (str === null || str === undefined || str === '') return '""';
    const cleaned = String(str).replace(/"/g, '""');
    return `"=""${cleaned}"""`;
  };

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

  const rows = orders.map((o) => {
    const prod = o.products || products.find(p => p.id === o.product_id) || {};
    const payMethodText = o.payment_method === 'cash' ? 'เงินสด (Cash)' : 'โอนเงิน/QR (Transfer)';
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
      escapeCSV(o.payment_slip_url || '-'),
      escapeCSV(o.notes || '-')
    ].join(',');
  });

  // Include UTF-8 BOM (\uFEFF) so Excel correctly displays Thai characters (ภาษาไทยไม่เป็นภาษาต่างดาว)
  const csvContent = '\uFEFF' + headers.join(',') + '\r\n' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ArchClub_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
