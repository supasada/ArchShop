import { describe, it, expect } from 'vitest';
import { escapeCSV, escapeExcelText, buildOrdersCSV, buildPrintSheetCSV } from './csvExport';

describe('csv escaping', () => {
  it('quotes and doubles quotes', () => {
    expect(escapeCSV('a "b"')).toBe('"a ""b"""');
    expect(escapeCSV('')).toBe('""');
    expect(escapeCSV(null)).toBe('""');
  });

  it('neutralises formula injection in customer text', () => {
    expect(escapeCSV('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCSV('+1')).toBe(`"'+1"`);
    expect(escapeCSV('-1+2')).toBe(`"'-1+2"`);
    expect(escapeCSV('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(escapeCSV('\tx')).toBe(`"'\tx"`);
    expect(escapeCSV('-')).toBe('"-"');
    expect(escapeCSV('สมชาย')).toBe('"สมชาย"');
  });

  it('text-forced cells cannot break out of the ="..." string', () => {
    expect(escapeExcelText('0812345678')).toBe('"=""0812345678"""');
    // after CSV parsing this cell reads ="1""&HYPERLINK(...)" – still one string literal
    expect(escapeExcelText('1"&HYPERLINK("x")')).toBe('"=""1""""&HYPERLINK(""""x"""")"""');
  });
});

describe('csv builders', () => {
  it('adds a name/number column to the orders export', () => {
    const csv = buildOrdersCSV([{
      id: 'o1', full_name: 'A', payment_status: 'confirmed', notes: '[J [M/-] x1]',
      order_items: [{ product_name: 'J', size: 'M', quantity: 1, personalization: [{ name: '=cmd', number: '07' }] }]
    }]);
    const [header, row] = csv.replace('﻿', '').split('\r\n');
    expect(header.endsWith('ชื่อ/เบอร์บนเสื้อ (Name/Number)')).toBe(true);
    expect(row.endsWith('"ชื่อ/เบอร์บนเสื้อ: J [M]: =cmd #07"')).toBe(true);
  });

  it('exports the fulfillment status (pending when the column is missing)', () => {
    const csv = buildOrdersCSV([
      { id: 'o1', payment_status: 'confirmed', fulfillment_status: 'in_production' },
      { id: 'o2', payment_status: 'pending' }
    ]);
    const [header, r1, r2] = csv.replace('\uFEFF', '').split('\r\n');
    expect(header).toContain('สถานะการผลิต/จัดส่ง (Fulfillment)');
    expect(r1).toContain('"confirmed","ส่งผลิต"');
    expect(r2).toContain('"pending","รอดำเนินการ"');
  });

  it('print sheet keeps leading zeros and guards names', () => {
    const csv = buildPrintSheetCSV([{
      product: 'Jersey', variant: '', size: 'M', color: 'Home', name: '=evil', number: '07',
      order_id: 'o1', customer: 'A', student_id: '650610123', phone: '081', payment_status: 'confirmed'
    }]);
    const row = csv.split('\r\n')[1];
    expect(row).toContain(`"'=evil"`);
    expect(row).toContain('"=""07"""');
  });
});
