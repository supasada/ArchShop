/**
 * Architecture Faculty Student Club - Store Settings (src/config/storeConfig.js)
 */

export const STORE_CONFIG = {
  faculty: {
    nameTh: 'สโมสรนักศึกษาคณะสถาปัตยกรรมศาสตร์',
    nameEn: 'Faculty of Architecture Student Club',
    academicYear: '2026',
    pickupLocation: 'ห้องสโมสรนักศึกษา ชั้น 1 ตึกสถาปัตยกรรมศาสตร์ (ตรงข้ามห้องLA5001)',
    pickupHours: 'ติดตามวันที่ประกาศรับอีกที',
    lineOfficial: '@smoarchcmu',
    instagram: 'smoarchcmu',
    instagramUrl: 'https://www.instagram.com/smoarchcmu/',
    email: 'smoarchcmu@cmu.ac.th',
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
    { size: 'S', chest: '32"', length: '23"', sleeve: '6"', armhole: '14"', shoulder: '13"' },
    { size: 'M', chest: '36"', length: '25"', sleeve: '7"', armhole: '15.5"', shoulder: '15"' },
    { size: 'L', chest: '40"', length: '27"', sleeve: '8"', armhole: '17.5"', shoulder: '17"' },
    { size: 'XL', chest: '44"', length: '29"', sleeve: '9"', armhole: '19"', shoulder: '19"' },
    { size: '2XL', chest: '48"', length: '31"', sleeve: '10"', armhole: '21"', shoulder: '21"' }
  ]
};
