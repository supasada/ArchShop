// Pure helpers for the security lockdown (migration 0016): order tracking input,
// phone normalisation / masking, payment-slip storage paths, admin login.

export const SLIP_BUCKET = 'payment-slips';
export const SLIP_SIGNED_URL_SECONDS = 300; // admin slip viewer: 5-minute signed URL
export const TRACK_RESULT_LIMIT = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_RE.test(String(value ?? '').trim());
}

// The short "#1a2b3c4d" ref shown on cards / in admin = the first 8 hex chars of the id
const ORDER_REF_RE = /^[0-9a-f]{8}$/i;

export function isOrderRef(value) {
  return ORDER_REF_RE.test(String(value ?? '').trim());
}

/** Digits only; "+66 81-234-5678" / "66812345678" → "0812345678". Same rule as SQL normalize_phone(). */
export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  return /^66[0-9]{8,9}$/.test(digits) ? '0' + digits.slice(2) : digits;
}

/** "0812345678" → "******5678" (same rule as track_orders()). */
export function maskPhone(value) {
  const d = normalizePhone(value);
  return d.length > 4 ? '*'.repeat(d.length - 4) + d.slice(-4) : '****';
}

export function normalizeStudentId(value) {
  return String(value ?? '').trim().toUpperCase();
}

/**
 * Validate the tracking form. Either the order id (full, or its 8-character ref), or the phone number alone.
 * Student id is not accepted: ids are sequential, so anyone could walk through classmates' orders.
 * → { ok: true, params: { p_order_id, p_student_id, p_phone } } | { ok: false, error }
 */
export function buildTrackQuery({ orderId, phone } = {}) {
  const oid = String(orderId ?? '').trim().replace(/^#/, '');
  if (oid) {
    if (!isUuid(oid) && !isOrderRef(oid)) {
      return { ok: false, error: 'กรุณากรอกเลขที่ออเดอร์ 8 ตัว (เช่น 1a2b3c4d) หรือเลขเต็มจากใบเสร็จ' };
    }
    return { ok: true, params: { p_order_id: oid.toLowerCase(), p_student_id: null, p_phone: null } };
  }
  const ph = normalizePhone(phone);
  if (ph.length < 9) {
    return { ok: false, error: 'กรุณากรอกเบอร์โทรศัพท์ที่ใช้ตอนสั่งซื้อให้ครบ (เช่น 0812345678)' };
  }
  return { ok: true, params: { p_order_id: null, p_student_id: null, p_phone: ph } };
}

/** Same matching rule as track_orders(), for local/mock data and the pre-migration fallback. */
export function matchesTrackQuery(order, params) {
  if (!order || !params) return false;
  if (params.p_order_id) {
    const id = String(order.id || '').toLowerCase();
    return isOrderRef(params.p_order_id) ? id.slice(0, 8) === params.p_order_id : id === params.p_order_id;
  }
  return Boolean(params.p_phone) && normalizePhone(order.phone_number) === params.p_phone;
}

/** Only what the tracking card / receipt shows, phone masked (mirrors track_orders()). */
export function toTrackResult(order) {
  const p = order?.products || null;
  return {
    id: order.id,
    created_at: order.created_at,
    full_name: order.full_name,
    student_id: order.student_id,
    year_of_study: order.year_of_study,
    major: order.major,
    phone_number: maskPhone(order.phone_number),
    color: order.color,
    size: order.size,
    quantity: order.quantity,
    total_price: order.total_price,
    delivery_method: order.delivery_method,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    tracking_number: order.tracking_number || null,
    order_items: order.order_items ?? null,
    products: p ? { name: p.name, price: p.price, production_note: p.production_note ?? null } : null
  };
}

/** track_orders() row → the shape TrackingModal / ReceiptModal read. */
export function fromTrackRow(row) {
  if (!row) return null;
  const { phone_masked, product_name, product_price, product_production_note, ...rest } = row;
  return {
    ...rest,
    phone_number: phone_masked,
    products: product_name != null
      ? { name: product_name, price: product_price, production_note: product_production_note }
      : null
  };
}

/**
 * Where a stored orders.payment_slip_url points:
 *   { kind: 'storage', path }   object in the payment-slips bucket (new rows store the bare path;
 *                               legacy rows store a full public / signed Supabase URL)
 *   { kind: 'inline', url }     data:image/... (upload failed, image saved in the row)
 *   { kind: 'external', url }   any other http(s) URL (e.g. demo data)
 *   { kind: 'none' }
 */
export function resolveSlipSource(stored) {
  const value = String(stored ?? '').trim();
  if (!value) return { kind: 'none' };
  if (/^data:image\//i.test(value)) return { kind: 'inline', url: value };
  if (/^https?:\/\//i.test(value)) {
    const marker = value.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/payment-slips\/([^?#]+)/);
    if (marker) {
      try {
        return { kind: 'storage', path: decodeURIComponent(marker[1]) };
      } catch {
        return { kind: 'storage', path: marker[1] };
      }
    }
    return { kind: 'external', url: value };
  }
  if (/^[a-z]+:/i.test(value)) return { kind: 'none' }; // javascript:, blob:, …: never render
  const path = value.replace(/^\/+/, '').replace(/^payment-slips\//, '');
  return path ? { kind: 'storage', path } : { kind: 'none' };
}

/**
 * Key identifying the slip an order points at: the storage object path (so a legacy public
 * URL, a signed URL and the bare object name of the same file compare equal), otherwise the
 * trimmed stored value. '' when there is no slip.
 */
export function slipKey(stored) {
  const src = resolveSlipSource(stored);
  if (src.kind === 'none') return '';
  return src.kind === 'storage' ? `storage:${src.path}` : `${src.kind}:${src.url}`;
}

/**
 * Slips used by more than one of the given (already loaded) orders. Covers legacy full URLs,
 * which the database unique index (0016) leaves out. → Set of slipKey values.
 */
export function findSharedSlipKeys(orders = []) {
  const seen = new Set();
  const shared = new Set();
  for (const o of orders || []) {
    const key = slipKey(o?.payment_slip_url);
    if (!key) continue;
    if (seen.has(key)) shared.add(key);
    else seen.add(key);
  }
  return shared;
}

/** Postgres unique violation (23505) on the one-order-per-slip index → clear Thai message. */
export function describeOrderInsertError(error) {
  if (!error) return null;
  const code = String(error.code || '');
  const text = `${error.message || ''} ${error.details || ''}`;
  if (code !== '23505' && !/duplicate key value/i.test(text)) return null;
  if (/payment_slip/i.test(text)) {
    return 'สลิปนี้ถูกใช้กับคำสั่งซื้ออื่นไปแล้ว — หนึ่งสลิปใช้ได้กับหนึ่งคำสั่งซื้อเท่านั้น กรุณาแนบสลิปการโอนของคำสั่งซื้อนี้แล้วลองใหม่';
  }
  return 'คำสั่งซื้อนี้ถูกบันทึกไปแล้ว (ส่งซ้ำ) กรุณาตรวจสอบสถานะคำสั่งซื้อก่อนสั่งใหม่';
}

// What slipObjectName() produces. The same pattern is enforced by the database for customer
// inserts (public.slip_object_name_pattern(), migration 0016): keep the two in sync.
export const SLIP_OBJECT_NAME_RE = /^slip_[A-Za-z0-9]{1,20}_[0-9]{1,16}_[0-9a-f]{1,64}\.[a-z0-9]{1,5}$/;

export function isSlipObjectName(value) {
  return typeof value === 'string' && SLIP_OBJECT_NAME_RE.test(value);
}

/** Object name for a new slip: unguessable, no overwrite needed (bucket allows INSERT only). */
export function slipObjectName(studentId, fileName, now = Date.now(), random = randomToken()) {
  const cleanId = String(studentId || 'std').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || 'std';
  const rawExt = String(fileName || '').includes('.') ? String(fileName).split('.').pop() : 'jpg';
  const ext = (rawExt || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  return `slip_${cleanId}_${now}_${random}.${ext}`;
}

export function randomToken() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '');
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/** Order id generated in the browser, so the receipt has it without reading the row back. */
export function newOrderId() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = c?.getRandomValues ? c.getRandomValues(new Uint8Array(16)) : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** PostgREST / Postgres "function does not exist" (migration not run yet). */
export function isMissingFunctionError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || error) + ' ' + String(error.details || '') + ' ' + String(error.hint || '');
  return code === 'PGRST202' || code === '42883' || /could not find the function|function .* does not exist/i.test(msg);
}

/** "smoarchcmu" → "smoarchcmu@cmu.ac.th"; full e-mails unchanged. */
export function adminLoginEmail(input) {
  const v = String(input ?? '').trim();
  return v.includes('@') ? v : `${v}@cmu.ac.th`;
}
