import React, { createContext, useContext, useState, useEffect } from 'react';

export const translations = {
  th: {
    // Brand & Header
    brandTitle: 'smoarchcmu',
    brandSubtitle: 'STUDENT UNION FACULTY OF ARCHITECTURE CHIANG MAI UNIVERSITY',
    trackOrder: 'เช็คสถานะคำสั่งซื้อ',
    adminPortal: 'Admin Portal',
    storeFront: 'หน้าร้านค้า',

    // Hero Banner
    officialMerch: 'OFFICIAL MERCHANDISE // ARCH 2026',
    heroTitle1: 'ARCHITECTURE',
    heroTitle2: 'FACULTY T-SHIRT',
    countdownTag: 'PRE-ORDER COUNTDOWN (REAL-TIME)',
    countdownTitle: 'นับถอยหลังปิดรับจองเสื้อ',
    deadlinePrefix: '🎯 กำหนดปิดรับจอง:',
    days: 'วัน',
    hours: 'ชั่วโมง',
    mins: 'นาที',
    secs: 'วินาที',
    daysUpper: 'DAYS',
    hoursUpper: 'HOURS',
    minsUpper: 'MINS',
    secsUpper: 'SECS',
    closedNotice: '🔴 ปิดรับการสั่งจองเสื้อรอบนี้แล้ว',

    // Product Section
    preorderBadge: 'เปิดรับจองล่วงหน้า (Pre-Order)',
    selectSizeLabel: 'เลือกไซส์',
    selectColorLabel: 'เลือกสี',
    viewSizeChartBtn: 'ตารางเทียบไซส์เสื้อ',
    orderNowBtn: 'สั่งจองเสื้อทันที',
    viewFront: 'ดูด้านหน้า',
    viewBack: 'ดูด้านหลัง',
    unsureSize: 'ไม่แน่ใจขนาดไซส์?',

    // Order Modal
    orderFormTitle: 'แบบฟอร์มสั่งจองเสื้อ (Pre-Order Form)',
    step1Size: '1. เลือกไซส์ (SIZE):',
    step2Color: '2. เลือกสี (COLOR):',
    step3Qty: '3. จำนวน (QUANTITY):',
    customerInfoTitle: 'ข้อมูลผู้สั่งซื้อ (Customer Information)',
    fullNameLabel: 'ชื่อ-นามสกุลจริง *',
    fullNamePlaceholder: 'เช่น นายปวริศร สถาปัตย์พัฒนา',
    studentIdLabel: 'รหัสนักศึกษา *',
    studentIdPlaceholder: 'เช่น 65010234567',
    yearLabel: 'ระดับชั้นปี *',
    yearPlaceholder: '-- เลือกระดับชั้นปี --',
    majorLabel: 'ภาควิชา / สาขา *',
    majorPlaceholder: '-- เลือกสาขาวิชา --',
    undergradGroup: 'ระดับปริญญาตรี (Undergraduate)',
    gradGroup: 'ระดับบัณฑิตศึกษา (Graduate)',
    phoneLabel: 'เบอร์โทรศัพท์ *',
    phonePlaceholder: '0812345678',
    contactLabel: 'LINE ID หรือ อีเมล *',
    contactPlaceholder: 'line: arch_student หรือ email',
    deliveryTitle: 'วิธีการรับสินค้า',
    pickupOption: 'รับที่ห้องสโมสรนักศึกษา',
    pickupDesc: 'ฟรี ตึกสถาปัตย์ ชั้น 1',
    shippingOption: 'จัดส่งพัสดุถึงที่อยู่',
    shippingDesc: '+ ค่าบริการขนส่ง',
    addressLabel: 'ที่อยู่สำหรับจัดส่งพัสดุ *',
    addressPlaceholder: 'บ้านเลขที่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์',
    paymentTitle: '💳 ข้อมูลการชำระเงิน',
    totalPayLabel: 'ยอดชำระ:',
    scanQRLabel: 'สแกน QR Code ชำระเงิน',
    bankLabel: 'ธนาคาร:',
    accNoLabel: 'เลขที่บัญชี:',
    accNameLabel: 'ชื่อบัญชี:',
    attachSlipLabel: 'แนบภาพสลิปโอนเงิน *',
    selectSlipFile: 'คลิกเพื่อเลือกไฟล์รูปสลิป',
    slipHint: 'JPG, PNG, WEBP (ไม่เกิน 5MB)',
    changeSlip: 'เปลี่ยนรูป',
    grandTotalLabel: 'ยอดชำระสุทธิ:',
    submitOrderBtn: 'ยืนยันการสั่งจองและส่งสลิป (Submit Order)',
    submittingBtn: 'กำลังส่งข้อมูล...',

    // Tracking Modal
    trackingTitle: 'ตรวจสอบสถานะคำสั่งซื้อ & พิมพ์ใบเสร็จ',
    trackingSearchHelp: 'ค้นหาด้วย: รหัสนักศึกษา (11 หลัก), เบอร์โทรศัพท์, ชื่อ-นามสกุล หรือ Order ID',
    trackingInputPlaceholder: 'เช่น 65010234567 หรือ 0812345678',
    searchBtn: '🔍 ค้นหา',
    searchingBtn: 'กำลังค้นหา...',
    searchInitialPrompt: 'กรอกรหัสนักศึกษาหรือเบอร์โทรศัพท์เพื่อตรวจสอบสถานะ',
    searchInitialSub: 'ระบบจะค้นหาประวัติการจองเสื้อและสถานะการตรวจสอบสลิปโอนเงิน',
    searchNotFound: 'ไม่พบข้อมูลคำสั่งซื้อสำหรับ',
    searchNotFoundSub: 'กรุณาตรวจสอบความถูกต้องของรหัสนักศึกษา หรือติดต่อสโมสรนักศึกษา',
    statusConfirmed: '✓ ยืนยันยอดแล้ว',
    statusPending: '⏳ รอตรวจสอบสลิป',
    statusRejected: '✕ สลิปไม่ถูกต้อง',
    buyerLabel: 'ผู้สั่งซื้อ:',
    dateLabel: 'วันที่ทำรายการ:',
    itemLabel: 'สินค้า:',
    sizeColorLabel: 'ไซส์/สี:',
    amountLabel: 'ยอดชำระ:',
    deliveryMethodLabel: 'การรับสินค้า:',
    viewSlipBtn: '👁️ ดูสลิปที่แนบ',
    printReceiptBtn: '🖨️ พิมพ์ใบเสร็จ (1 แผ่น)',
    slipProofTitle: 'หลักฐานสลิปโอนเงิน',
    closeBtn: 'ปิด',

    // Size Chart Modal
    sizeChartTitle: 'ตารางเทียบไซส์เสื้อ (SIZE CHART)',
    sizeCol: 'ไซส์ (Size)',
    chestCol: 'รอบอก (นิ้ว)',
    lengthCol: 'ความยาว (นิ้ว)',
    shoulderCol: 'ไหล่กว้าง (นิ้ว)',
    sizeUnitNote: '* ขนาดทั้งหมดมีหน่วยวัดเป็นนิ้ว (Inches) เนื้อผ้า Cotton Comb 100% สวมใส่สบายทรงสวย',

    // Alerts
    errFullName: 'กรุณากรอกชื่อ-นามสกุลจริง',
    errStudentId: 'กรุณากรอกรหัสนักศึกษา',
    errYear: 'กรุณาเลือกระดับชั้นปี',
    errMajor: 'กรุณาเลือกสาขาวิชา',
    errPhone: 'กรุณากรอกเบอร์โทรศัพท์ที่ติดต่อได้',
    errContact: 'กรุณากรอก LINE ID หรือ อีเมล',
    errAddress: 'กรุณากรอกที่อยู่จัดส่งพัสดุให้ครบถ้วน',
    errSlip: 'กรุณาแนบสลิปหลักฐานการโอนเงิน',
    errImageFormat: 'กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WEBP)',
    errImageSize: 'ขนาดไฟล์ต้องไม่เกิน 5 MB'
  },

  en: {
    // Brand & Header
    brandTitle: 'smoarchcmu',
    brandSubtitle: 'STUDENT UNION FACULTY OF ARCHITECTURE CHIANG MAI UNIVERSITY',
    trackOrder: 'Track Order',
    adminPortal: 'Admin Portal',
    storeFront: 'Storefront',

    // Hero Banner
    officialMerch: 'OFFICIAL MERCHANDISE // ARCH 2026',
    heroTitle1: 'ARCHITECTURE',
    heroTitle2: 'FACULTY T-SHIRT',
    countdownTag: 'PRE-ORDER COUNTDOWN (REAL-TIME)',
    countdownTitle: 'Pre-Order Countdown',
    deadlinePrefix: '🎯 Pre-Order Deadline:',
    days: 'Days',
    hours: 'Hours',
    mins: 'Mins',
    secs: 'Secs',
    daysUpper: 'DAYS',
    hoursUpper: 'HOURS',
    minsUpper: 'MINS',
    secsUpper: 'SECS',
    closedNotice: '🔴 Pre-Order is now closed',

    // Product Section
    preorderBadge: 'Open for Pre-Order',
    selectSizeLabel: 'Select Size',
    selectColorLabel: 'Select Color',
    viewSizeChartBtn: 'View Size Chart',
    orderNowBtn: 'Pre-Order Now',
    viewFront: 'View Front',
    viewBack: 'View Back',
    unsureSize: 'Need sizing help?',

    // Order Modal
    orderFormTitle: 'Faculty T-Shirt Pre-Order Form',
    step1Size: '1. Select Size (SIZE):',
    step2Color: '2. Select Color (COLOR):',
    step3Qty: '3. Quantity (QUANTITY):',
    customerInfoTitle: 'Customer Information',
    fullNameLabel: 'Full Name *',
    fullNamePlaceholder: 'e.g. John Doe',
    studentIdLabel: 'Student ID *',
    studentIdPlaceholder: 'e.g. 65010234567',
    yearLabel: 'Year of Study *',
    yearPlaceholder: '-- Select Year of Study --',
    majorLabel: 'Major / Department *',
    majorPlaceholder: '-- Select Major --',
    undergradGroup: 'Undergraduate Degrees',
    gradGroup: 'Graduate Degrees (Master / PhD)',
    phoneLabel: 'Phone Number *',
    phonePlaceholder: '0812345678',
    contactLabel: 'LINE ID or Email *',
    contactPlaceholder: 'line_id or email address',
    deliveryTitle: 'Delivery / Pick Up Method',
    pickupOption: 'Pick up at Student Union Room',
    pickupDesc: 'Free • Architecture Building 1st Fl.',
    shippingOption: 'Parcel Delivery to Address',
    shippingDesc: '+ Shipping fee included',
    addressLabel: 'Shipping Delivery Address *',
    addressPlaceholder: 'Address, Street, District, Province, Postal Code',
    paymentTitle: '💳 Payment Information',
    totalPayLabel: 'Total Amount:',
    scanQRLabel: 'Scan QR Code to Pay',
    bankLabel: 'Bank:',
    accNoLabel: 'Account Number:',
    accNameLabel: 'Account Name:',
    attachSlipLabel: 'Attach Payment Slip *',
    selectSlipFile: 'Click to upload payment slip screenshot',
    slipHint: 'JPG, PNG, WEBP (Max 5MB)',
    changeSlip: 'Change Slip',
    grandTotalLabel: 'Grand Total:',
    submitOrderBtn: 'Confirm & Submit Order',
    submittingBtn: 'Submitting Order...',

    // Tracking Modal
    trackingTitle: 'Order Tracking & e-Receipt',
    trackingSearchHelp: 'Search by: Student ID (11 digits), Phone Number, Full Name, or Order ID',
    trackingInputPlaceholder: 'e.g. 65010234567 or 0812345678',
    searchBtn: '🔍 Search',
    searchingBtn: 'Searching...',
    searchInitialPrompt: 'Enter your Student ID or Phone Number to track status',
    searchInitialSub: 'Search your pre-order records and payment slip verification status',
    searchNotFound: 'No order found matching',
    searchNotFoundSub: 'Please check your Student ID or contact the Student Union committee',
    statusConfirmed: '✓ Confirmed & Paid',
    statusPending: '⏳ Pending Verification',
    statusRejected: '✕ Invalid Slip',
    buyerLabel: 'Buyer:',
    dateLabel: 'Order Date:',
    itemLabel: 'Item:',
    sizeColorLabel: 'Size/Color:',
    amountLabel: 'Total:',
    deliveryMethodLabel: 'Delivery:',
    viewSlipBtn: '👁️ View Slip',
    printReceiptBtn: '🖨️ Print Receipt (1 Page)',
    slipProofTitle: 'Payment Slip Proof',
    closeBtn: 'Close',

    // Size Chart Modal
    sizeChartTitle: 'Size Measurement Chart (Inches)',
    sizeCol: 'Size',
    chestCol: 'Chest (Inches)',
    lengthCol: 'Length (Inches)',
    shoulderCol: 'Shoulder (Inches)',
    sizeUnitNote: '* All measurements are in inches. Premium 100% Cotton Comb fabric, comfortable fit.',

    // Alerts
    errFullName: 'Please enter your full name',
    errStudentId: 'Please enter your student ID',
    errYear: 'Please select your year of study',
    errMajor: 'Please select your major',
    errPhone: 'Please enter a valid phone number',
    errContact: 'Please enter your LINE ID or Email',
    errAddress: 'Please provide a complete shipping address',
    errSlip: 'Please attach your payment slip screenshot',
    errImageFormat: 'Please select a valid image file (JPG, PNG, WEBP)',
    errImageSize: 'File size must not exceed 5 MB'
  },

  zh: {
    // Brand & Header
    brandTitle: 'smoarchcmu',
    brandSubtitle: '清迈大学建筑学院学生会 STUDENT UNION FACULTY OF ARCHITECTURE CMU',
    trackOrder: '查询订单状态',
    adminPortal: '管理员后台',
    storeFront: '返回商城',

    // Hero Banner
    officialMerch: '官方预售纪念品 // 建筑学院 2026',
    heroTitle1: 'ARCHITECTURE',
    heroTitle2: 'FACULTY T-SHIRT',
    countdownTag: '实时预定倒计时 (REAL-TIME)',
    countdownTitle: '官方T恤预定倒计时',
    deadlinePrefix: '🎯 预订截止时间：',
    days: '天',
    hours: '小时',
    mins: '分钟',
    secs: '秒',
    daysUpper: '天 (DAYS)',
    hoursUpper: '时 (HOURS)',
    minsUpper: '分 (MINS)',
    secsUpper: '秒 (SECS)',
    closedNotice: '🔴 本轮预定已正式截止',

    // Product Section
    preorderBadge: '火热预定中 (Pre-Order)',
    selectSizeLabel: '选择尺码',
    selectColorLabel: '选择颜色',
    viewSizeChartBtn: '查看尺码对照表',
    orderNowBtn: '立即提交预订',
    viewFront: '查看正面',
    viewBack: '查看背面',
    unsureSize: '不确定尺码？',

    // Order Modal
    orderFormTitle: '学院T恤预订表格 (Pre-Order Form)',
    step1Size: '1. 选择尺码 (SIZE):',
    step2Color: '2. 选择颜色 (COLOR):',
    step3Qty: '3. 订购数量 (QUANTITY):',
    customerInfoTitle: '订购人基本信息 (Customer Information)',
    fullNameLabel: '真实姓名 (英文或泰文) *',
    fullNamePlaceholder: '例如：Zhang San 或 John Doe',
    studentIdLabel: '学生学号 (11位) *',
    studentIdPlaceholder: '例如：65010234567',
    yearLabel: '就读年级 *',
    yearPlaceholder: '-- 请选择就读年级 --',
    majorLabel: '所属专业 / 系所 *',
    majorPlaceholder: '-- 请选择专业 --',
    undergradGroup: '本科学位课程 (Undergraduate)',
    gradGroup: '研究生学位课程 (Master / PhD)',
    phoneLabel: '联系电话 *',
    phonePlaceholder: '0812345678',
    contactLabel: '微信号 / LINE ID / 邮箱 *',
    contactPlaceholder: 'WeChat, LINE 或 邮箱',
    deliveryTitle: '取货 / 配送方式',
    pickupOption: '在建筑学院学生会办公室自取',
    pickupDesc: '免费 • 建筑学院大楼 1楼',
    shippingOption: '快递配送到家',
    shippingDesc: '+ 快递运费',
    addressLabel: '快递收件详细地址 *',
    addressPlaceholder: '门牌号、街道、区县、府/省份、邮政编码',
    paymentTitle: '💳 付款账户与扫码',
    totalPayLabel: '应付金额：',
    scanQRLabel: '扫描二维码支付 (PromptPay/网银)',
    bankLabel: '收款银行：',
    accNoLabel: '银行账号：',
    accNameLabel: '账户姓名：',
    attachSlipLabel: '上传转账凭证/水单截图 *',
    selectSlipFile: '点击上传支付成功截图凭证',
    slipHint: '支持 JPG, PNG, WEBP (不超过 5MB)',
    changeSlip: '更换截图',
    grandTotalLabel: '应付实付总额：',
    submitOrderBtn: '确认提交订单并上传凭证 (Submit Order)',
    submittingBtn: '正在提交订单中...',

    // Tracking Modal
    trackingTitle: '订单进度查询 & 打印电子收据',
    trackingSearchHelp: '支持查询方式：学生学号 (11位)、手机号、姓名或订单编号',
    trackingInputPlaceholder: '例如：65010234567 或 0812345678',
    searchBtn: '🔍 立即查询',
    searchingBtn: '正在查询...',
    searchInitialPrompt: '请输入学号或手机号以查询预定状态',
    searchInitialSub: '系统将查询预定历史以及转账凭证审核进度',
    searchNotFound: '未查找到相关订单：',
    searchNotFoundSub: '请检查输入的学号是否准确，或联系学生会管理员协助核实',
    statusConfirmed: '✓ 已核对收款 (已确认)',
    statusPending: '⏳ 等待核对转账凭证',
    statusRejected: '✕ 凭证有误 (请重新核对)',
    buyerLabel: '订购人：',
    dateLabel: '下单时间：',
    itemLabel: '商品：',
    sizeColorLabel: '尺码/颜色：',
    amountLabel: '支付金额：',
    deliveryMethodLabel: '取货方式：',
    viewSlipBtn: '👁️ 查看已传凭证',
    printReceiptBtn: '🖨️ 打印单页电子收据 (1 Page)',
    slipProofTitle: '转账凭证预览',
    closeBtn: '关闭',

    // Size Chart Modal
    sizeChartTitle: '衣服尺码详细对照表 (SIZE CHART)',
    sizeCol: '尺码 (Size)',
    chestCol: '胸围 (英寸)',
    lengthCol: '衣长 (英寸)',
    shoulderCol: '肩宽 (英寸)',
    sizeUnitNote: '* 所有尺寸单位均为英寸 (Inches)。100% 精梳纯棉 (Cotton Comb)，舒适透气。',

    // Alerts
    errFullName: '请输入订购人姓名',
    errStudentId: '请输入学生学号',
    errYear: '请选择就读年级',
    errMajor: '请选择专业',
    errPhone: '请输入联系电话',
    errContact: '请输入微信号/LINE/邮箱',
    errAddress: '请输入完整的收货地址',
    errSlip: '请上传转账凭证截图',
    errImageFormat: '请选择图片文件 (JPG, PNG, WEBP)',
    errImageSize: '图片大小不能超过 5MB'
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('arch_language');
    return saved === 'en' || saved === 'zh' ? saved : 'th';
  });

  const changeLanguage = (newLang) => {
    if (newLang === 'th' || newLang === 'en' || newLang === 'zh') {
      setLang(newLang);
      localStorage.setItem('arch_language', newLang);
    }
  };

  const t = translations[lang] || translations.th;

  return (
    <LanguageContext.Provider value={{ lang, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: 'th',
      setLanguage: () => {},
      t: translations.th
    };
  }
  return ctx;
}
