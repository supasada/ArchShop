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

export function formatDateToInputLocal(dateInput) {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (!d || isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseInputLocalToDate(str) {
  if (!str) return null;
  if (typeof str !== 'string') return new Date(str);
  const parts = str.split('T');
  if (parts.length === 2) {
    const [year, month, day] = parts[0].split('-').map(Number);
    const [hours, minutes] = parts[1].split(':').map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hours) && !isNaN(minutes)) {
      return new Date(year, month - 1, day, hours, minutes, 0, 0);
    }
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function getPromptPayQRUrl(amount) {
  const number = (STORE_CONFIG.payment.promptpayNumber || '147-8-13511-0').replace(/[^0-9]/g, '');
  if (amount && amount > 0) {
    return `https://promptpay.io/${number}/${amount}.png`;
  }
  return `https://promptpay.io/${number}.png`;
}


