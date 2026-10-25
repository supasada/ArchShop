import { describe, it, expect } from 'vitest';
import {
  isUuid,
  normalizePhone,
  maskPhone,
  normalizeStudentId,
  buildTrackQuery,
  matchesTrackQuery,
  toTrackResult,
  fromTrackRow,
  resolveSlipSource,
  slipObjectName,
  newOrderId,
  isMissingFunctionError,
  adminLoginEmail
} from './security';

const ID = 'cccccccc-0000-4000-8000-000000000001';

describe('normalizePhone', () => {
  it('keeps digits only', () => {
    expect(normalizePhone('081-234 5678')).toBe('0812345678');
    expect(normalizePhone(' (081) 234.5678 ')).toBe('0812345678');
  });
  it('turns the +66 / 66 country code into a leading 0', () => {
    expect(normalizePhone('+66 81 234 5678')).toBe('0812345678');
    expect(normalizePhone('66812345678')).toBe('0812345678');
    expect(normalizePhone('+66 2 123 4567')).toBe('021234567');
  });
  it('leaves other numbers alone and handles empty input', () => {
    expect(normalizePhone('0662345678')).toBe('0662345678');
    expect(normalizePhone('66')).toBe('66');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });
});

describe('maskPhone', () => {
  it('shows only the last 4 digits', () => {
    expect(maskPhone('081-234-5678')).toBe('******5678');
    expect(maskPhone('+66812345678')).toBe('******5678');
  });
  it('fully masks short or empty values', () => {
    expect(maskPhone('1234')).toBe('****');
    expect(maskPhone('')).toBe('****');
  });
});

describe('isUuid / normalizeStudentId', () => {
  it('accepts only a full uuid', () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid(` ${ID.toUpperCase()} `)).toBe(true);
    expect(isUuid('cccccccc')).toBe(false);
    expect(isUuid('%')).toBe(false);
  });
  it('trims and upper-cases student ids', () => {
    expect(normalizeStudentId(' 650610123 ')).toBe('650610123');
    expect(normalizeStudentId('ab12')).toBe('AB12');
  });
});

describe('buildTrackQuery', () => {
  it('uses the order id alone when given', () => {
    expect(buildTrackQuery({ orderId: `#${ID.toUpperCase()}`, studentId: 'x', phone: 'y' })).toEqual({
      ok: true,
      params: { p_order_id: ID, p_student_id: null, p_phone: null }
    });
  });
  it('rejects a partial order id (the 8-character ref is not enough)', () => {
    const r = buildTrackQuery({ orderId: 'cccccccc' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/เลขที่ออเดอร์/);
  });
  it('needs student id AND phone together', () => {
    expect(buildTrackQuery({ studentId: '650610123' }).ok).toBe(false);
    expect(buildTrackQuery({ phone: '0812345678' }).ok).toBe(false);
    expect(buildTrackQuery({ studentId: '65', phone: '0812345678' }).ok).toBe(false);
    expect(buildTrackQuery({ studentId: '650610123', phone: '08123' }).ok).toBe(false);
    expect(buildTrackQuery({}).ok).toBe(false);
    expect(buildTrackQuery({ studentId: ' 650610123 ', phone: '+66 81 234 5678' })).toEqual({
      ok: true,
      params: { p_order_id: null, p_student_id: '650610123', p_phone: '0812345678' }
    });
  });
});

describe('matchesTrackQuery', () => {
  const order = { id: ID, student_id: '650610123', phone_number: '081-234-5678' };
  it('matches the exact order id', () => {
    expect(matchesTrackQuery(order, { p_order_id: ID })).toBe(true);
    expect(matchesTrackQuery(order, { p_order_id: 'cccccccc-0000-4000-8000-000000000002' })).toBe(false);
  });
  it('matches student id + normalised phone exactly, never partially', () => {
    expect(matchesTrackQuery(order, { p_student_id: '650610123', p_phone: '0812345678' })).toBe(true);
    expect(matchesTrackQuery(order, { p_student_id: '65061012', p_phone: '0812345678' })).toBe(false);
    expect(matchesTrackQuery(order, { p_student_id: '650610123', p_phone: '081234567' })).toBe(false);
    expect(matchesTrackQuery(null, { p_order_id: ID })).toBe(false);
  });
});

describe('toTrackResult / fromTrackRow', () => {
  const full = {
    id: ID, created_at: '2026-10-25T00:00:00Z', full_name: 'A', student_id: '650610123', year_of_study: '3',
    major: 'Arch', phone_number: '0812345678', email_or_line_id: 'line:secret', payment_slip_url: 'slip.jpg',
    shipping_address: '99 Secret Rd', notes: 'private', color: 'Black', size: 'M', quantity: 1, total_price: 219,
    delivery_method: 'shipping', payment_status: 'pending', fulfillment_status: 'pending', tracking_number: null,
    order_items: [], products: { name: 'Tee', price: 219, production_note: '3 weeks', image_front_url: 'x' }
  };
  it('drops contact, slip, address and notes and masks the phone', () => {
    const r = toTrackResult(full);
    expect(r.phone_number).toBe('******5678');
    expect(r).not.toHaveProperty('email_or_line_id');
    expect(r).not.toHaveProperty('payment_slip_url');
    expect(r).not.toHaveProperty('shipping_address');
    expect(r).not.toHaveProperty('notes');
    expect(r.products).toEqual({ name: 'Tee', price: 219, production_note: '3 weeks' });
  });
  it('maps the RPC row to the UI shape', () => {
    const r = fromTrackRow({
      id: ID, phone_masked: '******5678', product_name: 'Tee', product_price: 219, product_production_note: null, size: 'M'
    });
    expect(r).toEqual({ id: ID, size: 'M', phone_number: '******5678', products: { name: 'Tee', price: 219, production_note: null } });
    expect(fromTrackRow({ id: ID, phone_masked: '****', product_name: null }).products).toBeNull();
    expect(fromTrackRow(null)).toBeNull();
  });
});

describe('resolveSlipSource', () => {
  const base = 'https://abcd.supabase.co/storage/v1/object';
  it('treats a bare name as a payment-slips object path', () => {
    expect(resolveSlipSource('slip_650610123_1.jpg')).toEqual({ kind: 'storage', path: 'slip_650610123_1.jpg' });
    expect(resolveSlipSource('/payment-slips/a/b.jpg')).toEqual({ kind: 'storage', path: 'a/b.jpg' });
  });
  it('extracts the path from legacy public and signed URLs', () => {
    expect(resolveSlipSource(`${base}/public/payment-slips/slip_1.jpg`)).toEqual({ kind: 'storage', path: 'slip_1.jpg' });
    expect(resolveSlipSource(`${base}/sign/payment-slips/dir/slip%201.jpg?token=abc`)).toEqual({ kind: 'storage', path: 'dir/slip 1.jpg' });
  });
  it('keeps inline images and other URLs, ignores unsafe schemes', () => {
    expect(resolveSlipSource('data:image/png;base64,AAAA')).toEqual({ kind: 'inline', url: 'data:image/png;base64,AAAA' });
    expect(resolveSlipSource('https://images.unsplash.com/x.jpg')).toEqual({ kind: 'external', url: 'https://images.unsplash.com/x.jpg' });
    expect(resolveSlipSource(`${base}/public/product-images/p.jpg`).kind).toBe('external');
    expect(resolveSlipSource('javascript:alert(1)')).toEqual({ kind: 'none' });
    expect(resolveSlipSource('data:text/html,<b>')).toEqual({ kind: 'none' });
    expect(resolveSlipSource('')).toEqual({ kind: 'none' });
    expect(resolveSlipSource(null)).toEqual({ kind: 'none' });
  });
});

describe('slipObjectName / newOrderId', () => {
  it('builds a safe, unique-looking object name', () => {
    expect(slipObjectName('65/06 10123', 'My Slip.PNG', 1000, 'abc')).toBe('slip_650610123_1000_abc.png');
    expect(slipObjectName('', 'noext', 1, 'r')).toBe('slip_std_1_r.jpg');
    expect(slipObjectName('x', '../../evil.ph<p>', 1, 'r')).toBe('slip_x_1_r.php');
    expect(slipObjectName('1', 'a.jpg')).toMatch(/^slip_1_\d+_[0-9a-f]{8,}\.jpg$/);
  });
  it('generates v4 uuids', () => {
    const a = newOrderId();
    expect(isUuid(a)).toBe(true);
    expect(a[14]).toBe('4');
    expect(newOrderId()).not.toBe(a);
  });
});

describe('isMissingFunctionError / adminLoginEmail', () => {
  it('detects a missing RPC', () => {
    expect(isMissingFunctionError({ code: 'PGRST202', message: 'Could not find the function public.is_admin' })).toBe(true);
    expect(isMissingFunctionError({ code: '42883', message: 'function public.track_orders(text) does not exist' })).toBe(true);
    expect(isMissingFunctionError({ code: '42501', message: 'permission denied for function is_admin' })).toBe(false);
    expect(isMissingFunctionError(null)).toBe(false);
  });
  it('adds the default domain to bare usernames', () => {
    expect(adminLoginEmail(' smoarchcmu ')).toBe('smoarchcmu@cmu.ac.th');
    expect(adminLoginEmail('a@b.com')).toBe('a@b.com');
  });
});
