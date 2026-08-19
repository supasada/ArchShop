/**
 * Architecture Faculty Student Club - Store Settings (src/config/storeConfig.js)
 */

export const STORE_CONFIG = {
  faculty: {
    nameTh: 'สโมสรนักศึกษาคณะสถาปัตยกรรมศาสตร์',
    nameEn: 'Faculty of Architecture Student Club',
    academicYear: '2026',
    pickupLocation: 'ห้องสโมสรนักศึกษา ชั้น 1 ตึกสถาปัตยกรรมศาสตร์ (ข้างลานไทร)',
    pickupHours: 'จันทร์ - ศุกร์ เวลา 12:00 - 17:00 น.',
    phone: '089-123-4567',
    lineOfficial: '@arch_studentclub',
    email: 'arch.studentclub@university.ac.th',
    shippingFee: 39,
    defaultDeadline: '2026-08-31T23:59:59'
  },

  payment: {
    promptpayNumber: '147-8-13511-0',
    promptpayName: 'นางสาว พลินีย์ เพิ่มทวี',
    bankName: 'ธนาคารกสิกรไทย (KBANK)',
    bankAccountNo: '147-8-13511-0',
    bankAccountName: 'นางสาว พลินีย์ เพิ่มทวี',
    qrCodeImage: '/assets/payment_qr.jpg'
  },

  undergraduateMajors: [
    'สถบ.5 ปี สถาปัตยกรรม',
    'ภสถ.บ. 5 ปี ภูมิสถาปัตยกรรม',
    'วท.บ. 4 ปี สาขาสถาปัตยกรรม',
    'วท.บ. 4 ปี ออกแบบอุตสาหกรรม',
    'IDEA 4 หลักสูตรนานาชาติ'
  ],

  graduateMajors: [
    'สถ.ม.',
    'สถ.ม. (นานาชาติ)',
    'วท.ม. (สถาปัตยกรรม)',
    'ผ.ม. (บูรณาการผังเมืองและชนบท)',
    'ปร.ด. (นานาชาติ)'
  ],

  majors: [
    'สถบ.5 ปี สถาปัตยกรรม',
    'ภสถ.บ. 5 ปี ภูมิสถาปัตยกรรม',
    'วท.บ. 4 ปี สาขาสถาปัตยกรรม',
    'วท.บ. 4 ปี ออกแบบอุตสาหกรรม',
    'IDEA 4 หลักสูตรนานาชาติ',
    'สถ.ม.',
    'สถ.ม. (นานาชาติ)',
    'วท.ม. (สถาปัตยกรรม)',
    'ผ.ม. (บูรณาการผังเมืองและชนบท)',
    'ปร.ด. (นานาชาติ)'
  ],

  years: [
    'ปี 1 (Freshman)',
    'ปี 2 (Sophomore)',
    'ปี 3 (Junior)',
    'ปี 4 (Senior)',
    'ปี 5 (Thesis Year)',
    'ปริญญาโท / เอก (Graduate)',
    'ศิษย์เก่า / บุคลากร (Alumni / Staff)'
  ],

  sizeChart: [
    { size: 'S', chest: '36"', length: '27"', shoulder: '17"' },
    { size: 'M', chest: '38"', length: '28"', shoulder: '18"' },
    { size: 'L', chest: '42"', length: '29"', shoulder: '19"' },
    { size: 'XL', chest: '46"', length: '30"', shoulder: '20"' },
    { size: '2XL', chest: '50"', length: '31"', shoulder: '21.5"' },
    { size: '3XL', chest: '54"', length: '32"', shoulder: '23"' }
  ]
};
