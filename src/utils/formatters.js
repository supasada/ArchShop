import { STORE_CONFIG } from '../config/storeConfig';

export function formatCurrency(amount) {
  return `฿${Number(amount || 0).toLocaleString('th-TH')}`;
}

export function formatDateThai(dateStr, withTime = false) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return date.toLocaleDateString('th-TH', options);
}

export function getPromptPayQRUrl(amount) {
  const number = (STORE_CONFIG.payment.promptpayNumber || '0891234567').replace(/[^0-9]/g, '');
  if (amount && amount > 0) {
    return `https://promptpay.io/${number}/${amount}.png`;
  }
  return `https://promptpay.io/${number}.png`;
}
