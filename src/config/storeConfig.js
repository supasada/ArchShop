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

  promotion: {
    enabled: true,
    bundleQty: 2,
    bundlePrice: 399,
    descriptionTh: 'ซื้อ 2 ตัว เหลือเพียง 399 บาท',
    descriptionEn: 'Buy 2 shirts for only 399 THB',
    descriptionZh: '买2件短袖仅需 399 泰铢'
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
    'B.Arch.',
    'B.Interior',
    'B.L.A.',
    'B.S. (Architecture)',
    'BS. (Industrial Design)',
    'IDEA 4 YEAR (International)'
  ],

  graduateMajors: [
    'M.Arch',
    'JOINT DEGREE (International)',
    'M.S. (Architecture)',
    'M.U.R.P. (Urban And Rural Integrative Planning)',
    'Ph.D. (International)'
  ],

  otherMajors: [
    'ศิษย์เก่าคณะสถาปัตย์ (Arch Alumni)',
    'นักศึกษาต่างคณะ มช. (Other CMU Faculty)',
    'นักศึกษาต่างมหาวิทยาลัย (Other University)',
    'อาจารย์ / บุคลากร (Faculty Staff)',
    'บุคคลภายนอกทั่วไป (General Public)'
  ],

  majors: [
    'B.Arch.',
    'B.Interior',
    'B.L.A.',
    'B.S. (Architecture)',
    'BS. (Industrial Design)',
    'IDEA 4 YEAR (International)',
    'M.Arch',
    'JOINT DEGREE (International)',
    'M.S. (Architecture)',
    'M.U.R.P. (Urban And Rural Integrative Planning)',
    'Ph.D. (International)',
    'ศิษย์เก่าคณะสถาปัตย์ (Arch Alumni)',
    'นักศึกษาต่างคณะ มช. (Other CMU Faculty)',
    'นักศึกษาต่างมหาวิทยาลัย (Other University)',
    'อาจารย์ / บุคลากร (Faculty Staff)',
    'บุคคลภายนอกทั่วไป (General Public)',
    'สถบ.5 ปี สถาปัตยกรรม',
    'สถ.บ. สถาปัตยกรรมภายใน',
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
    'ปริญญาโท / เอก (Postgraduate)',
    'ศิษย์เก่าคณะสถาปัตย์ (Alumni)',
    'นักศึกษานอกคณะ (CMU Student - Other Faculty)',
    'นักศึกษานอกมหาลัย (Non-CMU Student)',
    'อาจารย์ / บุคลากร (Faculty / Staff)',
    'บุคคลภายนอกทั่วไป (General Public)'
  ],

  sizeChart: [
    { size: 'S', chest: '32"', length: '23"', sleeve: '6"', armhole: '14"', shoulder: '13"' },
    { size: 'M', chest: '36"', length: '25"', sleeve: '7"', armhole: '15.5"', shoulder: '15"' },
    { size: 'L', chest: '40"', length: '27"', sleeve: '8"', armhole: '17.5"', shoulder: '17"' },
    { size: 'XL', chest: '44"', length: '29"', sleeve: '9"', armhole: '19"', shoulder: '19"' },
    { size: '2XL', chest: '48"', length: '31"', sleeve: '10"', armhole: '21"', shoulder: '21"' }
  ]
};
