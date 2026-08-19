import React, { useState, useEffect } from 'react';
import { api, supabase, isLiveSupabase } from '../config/supabase';
import { formatCurrency, formatDateThai } from '../utils/formatters';
import { exportOrdersToCSV } from '../utils/csvExport';
import { STORE_CONFIG } from '../config/storeConfig';

export default function AdminView({ onBackToStore }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'products' | 'sizing'

  // Order filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState('all');

  // Slip Inspector state
  const [selectedSlipOrder, setSelectedSlipOrder] = useState(null);
  const [slipZoom, setSlipZoom] = useState(1);
  const [slipRotation, setSlipRotation] = useState(0);

  // Product CRUD state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productFormData, setProductFormData] = useState({
    name: '',
    description: '',
    price: 350,
    available_sizes: ['S', 'M', 'L', 'XL', '2XL'],
    available_colors: 'Deep Black, Chalk White',
    image_front_url: '',
    image_back_url: '',
    is_active: true,
    order_deadline: ''
  });
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);

  // Order Edit CRUD state
  const [isOrderEditModalOpen, setIsOrderEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderFormData, setOrderFormData] = useState({
    full_name: '',
    student_id: '',
    year_of_study: '',
    major: '',
    phone_number: '',
    email_or_line_id: '',
    product_id: '',
    size: 'L',
    color: '',
    quantity: 1,
    total_price: 0,
    delivery_method: 'pickup',
    shipping_address: '',
    notes: '',
    payment_status: 'pending'
  });

  // Quick Receipt Modal for any order
  const [receiptOrder, setReceiptOrder] = useState(null);

  // Deadline Settings Modal
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState(() => {
    const saved = localStorage.getItem('arch_custom_deadline');
    if (saved) {
      const d = new Date(saved);
      if (!isNaN(d.getTime())) {
        // Format to YYYY-MM-DDTHH:mm local time
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
    return '2026-08-31T23:59';
  });

  const handleSaveDeadline = async (e) => {
    e?.preventDefault();
    if (!deadlineInput) return alert('กรุณาระบุวันและเวลาที่ถูกต้อง');
    const targetDate = new Date(deadlineInput);
    if (isNaN(targetDate.getTime())) return alert('รูปแบบวันเวลาไม่ถูกต้อง');

    const isoDate = targetDate.toISOString();
    localStorage.setItem('arch_custom_deadline', isoDate);
    window.dispatchEvent(new CustomEvent('arch_deadline_updated', { detail: isoDate }));

    // Also update order_deadline for active products in Supabase
    if (products && products.length > 0) {
      for (const p of products) {
        try {
          await api.updateProduct(p.id, { order_deadline: isoDate });
        } catch (err) {
          console.warn('Notice updating product deadline:', err);
        }
      }
    }

    setIsDeadlineModalOpen(false);
    alert('✅ บันทึกวันและเวลาปิดรับจองเรียบร้อยแล้ว!\nระบบนับถอยหลังหน้าเว็บจะอัปเดตตามเวลาจริงทันที');
  };

  // Check auth session
  useEffect(() => {
    async function checkAuth() {
      localStorage.removeItem('archshop_admin_lockout');
      if (isLiveSupabase && supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session) setSession(data.session);
      } else {
        const local = localStorage.getItem('archshop_mock_admin_auth');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
              localStorage.removeItem('archshop_mock_admin_auth');
              setSession(null);
            } else {
              setSession(parsed);
            }
          } catch {
            localStorage.removeItem('archshop_mock_admin_auth');
          }
        }
      }
    }
    checkAuth();
  }, []);

  // Fetch data
  const fetchData = async () => {
    try {
      const [ordList, prodList] = await Promise.all([
        api.getAllOrders(),
        api.getProducts(false)
      ]);
      setOrders(ordList || []);
      setProducts(prodList || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();
      const sub = api.subscribeOrders(
        () => fetchData(),
        () => fetchData(),
        () => fetchData()
      );
      return () => sub?.unsubscribe && sub.unsubscribe();
    }
  }, [session]);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const inputUser = (email || '').trim().toLowerCase();
    const inputPass = (password || '').trim();

    try {
      const isMasterAdmin = 
        (inputUser === 'smoarchcmu' || 
         inputUser.startsWith('smoarchcmu@') || 
         inputUser === 'admin' || 
         inputUser.startsWith('admin@')) && 
        (inputPass === 'archcmu-2026' || inputPass === 'smocmu-2026');

      if (isMasterAdmin) {
        if (isLiveSupabase && supabase) {
          const fullEmail = email.includes('@') ? email.trim() : `${email.trim()}@cmu.ac.th`;
          try {
            const { data, error } = await supabase.auth.signInWithPassword({ email: fullEmail, password: inputPass });
            if (!error && data?.session) {
              setSession(data.session);
              return;
            }
          } catch (supaErr) {
            console.warn('Supabase auth notice:', supaErr);
          }
        }

        const mockSession = {
          user: { 
            email: email.includes('@') ? email.trim() : `${email.trim()}@cmu.ac.th`, 
            id: 'smoarchcmu-admin' 
          },
          expiresAt: Date.now() + 24 * 60 * 60 * 1000
        };
        localStorage.setItem('archshop_mock_admin_auth', JSON.stringify(mockSession));
        setSession(mockSession);
        return;
      }

      if (isLiveSupabase && supabase) {
        const fullEmail = email.includes('@') ? email.trim() : `${email.trim()}@cmu.ac.th`;
        const { data, error } = await supabase.auth.signInWithPassword({ email: fullEmail, password: inputPass });
        if (error) throw error;
        setSession(data.session);
        return;
      }

      throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    } catch (err) {
      alert('เข้าสู่ระบบไม่สำเร็จ: ' + (err.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isLiveSupabase && supabase) await supabase.auth.signOut();
    localStorage.removeItem('archshop_mock_admin_auth');
    setSession(null);
  };

  // ----------------------------------------------------
  // Simple 1-Click Order Status Update (Confirm / Reject / Pending)
  // ----------------------------------------------------
  const handleQuickUpdateStatus = async (orderId, newStatus) => {
    setActionLoadingId(orderId);
    // 1. Optimistic update in UI immediately
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: newStatus } : o));
    if (selectedSlipOrder?.id === orderId) {
      setSelectedSlipOrder(prev => ({ ...prev, payment_status: newStatus }));
    }

    try {
      await api.updateOrderStatus(orderId, newStatus);
    } catch (err) {
      console.error('Update status in Supabase error:', err);
      alert('อัปเดตสถานะใน Supabase ไม่สำเร็จ: ' + err.message);
      fetchData();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm('⚠️ ยืนยันการลบคำสั่งซื้อนี้ใน Supabase อย่างถาวร?')) return;
    setActionLoadingId(orderId);
    try {
      await api.deleteOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      fetchData();
    } catch (err) {
      alert('ลบคำสั่งซื้อไม่สำเร็จ: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenEditOrder = (order) => {
    setEditingOrder(order);
    setOrderFormData({
      full_name: order.full_name || '',
      student_id: order.student_id || '',
      year_of_study: order.year_of_study || '',
      major: order.major || '',
      phone_number: order.phone_number || '',
      email_or_line_id: order.email_or_line_id || '',
      product_id: order.product_id || '',
      size: order.size || 'L',
      color: order.color || '',
      quantity: order.quantity || 1,
      total_price: order.total_price || 0,
      delivery_method: order.delivery_method || 'pickup',
      shipping_address: order.shipping_address || '',
      notes: order.notes || '',
      payment_status: order.payment_status || 'pending'
    });
    setIsOrderEditModalOpen(true);
  };

  const handleSaveOrderEdit = async (e) => {
    e.preventDefault();
    if (!editingOrder) return;
    setLoading(true);
    try {
      await api.updateOrder(editingOrder.id, orderFormData);
      alert('✅ บันทึกการแก้ไขลง Supabase เรียบร้อยแล้ว');
      setIsOrderEditModalOpen(false);
      fetchData();
    } catch (err) {
      alert('บันทึกคำสั่งซื้อไม่สำเร็จ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // Product Operations (CRUD in Supabase)
  // ----------------------------------------------------
  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setProductFormData({
      name: '',
      description: '',
      price: 350,
      available_sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      available_colors: 'Deep Black, Chalk White',
      image_front_url: '',
      image_back_url: '',
      is_active: true,
      order_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (p) => {
    setEditingProduct(p);
    setProductFormData({
      name: p.name || '',
      description: p.description || '',
      price: p.price || 0,
      available_sizes: Array.isArray(p.available_sizes) ? p.available_sizes : ['S', 'M', 'L', 'XL', '2XL'],
      available_colors: Array.isArray(p.available_colors) ? p.available_colors.join(', ') : (p.available_colors || 'Deep Black'),
      image_front_url: p.image_front_url || '',
      image_back_url: p.image_back_url || '',
      is_active: p.is_active ?? true,
      order_deadline: p.order_deadline ? new Date(p.order_deadline).toISOString().slice(0, 16) : ''
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productFormData.name) return alert('กรุณาระบุชื่อสินค้า');
    if (!productFormData.price || Number(productFormData.price) <= 0) return alert('กรุณาระบุราคาที่ถูกต้อง');

    const colorsArray = typeof productFormData.available_colors === 'string'
      ? productFormData.available_colors.split(',').map(c => c.trim()).filter(Boolean)
      : productFormData.available_colors;

    const payload = {
      name: productFormData.name,
      description: productFormData.description,
      price: Number(productFormData.price),
      available_sizes: productFormData.available_sizes,
      available_colors: colorsArray.length > 0 ? colorsArray : ['Standard'],
      image_front_url: productFormData.image_front_url || '/assets/images/arch_shirt_front.jpg',
      image_back_url: productFormData.image_back_url || '',
      is_active: Boolean(productFormData.is_active),
      order_deadline: productFormData.order_deadline ? new Date(productFormData.order_deadline).toISOString() : null
    };

    setLoading(true);
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
        alert('✅ แก้ไขข้อมูลสินค้าใน Supabase สำเร็จ');
      } else {
        await api.createProduct(payload);
        alert('✅ เพิ่มสินค้าใหม่ใน Supabase สำเร็จ');
      }
      setIsProductModalOpen(false);
      fetchData();
    } catch (err) {
      alert('บันทึกสินค้าไม่สำเร็จ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (!confirm(`⚠️ ยืนยันการลบสินค้า "${productName}" ใน Supabase อย่างถาวร?`)) return;
    try {
      await api.deleteProduct(productId);
      alert('ลบสินค้าเรียบร้อย');
      fetchData();
    } catch (err) {
      alert('ลบสินค้าไม่สำเร็จ: ' + err.message);
    }
  };

  const handleUploadImage = async (file, side) => {
    if (!file) return;
    if (side === 'front') setUploadingFront(true);
    else setUploadingBack(true);

    try {
      const url = await api.uploadProductImage(file, side);
      if (side === 'front') {
        setProductFormData(prev => ({ ...prev, image_front_url: url }));
      } else {
        setProductFormData(prev => ({ ...prev, image_back_url: url }));
      }
    } catch (err) {
      alert('อัปโหลดรูปภาพไม่สำเร็จ: ' + err.message);
    } finally {
      if (side === 'front') setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.payment_status !== statusFilter) return false;
    if (productFilter !== 'all' && o.product_id !== productFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        o.full_name?.toLowerCase().includes(q) ||
        o.student_id?.toLowerCase().includes(q) ||
        o.phone_number?.includes(q) ||
        o.major?.toLowerCase().includes(q) ||
        o.id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Analytics Calculation
  const totalRevenue = orders.filter(o => o.payment_status === 'confirmed').reduce((s, o) => s + Number(o.total_price || 0), 0);
  const totalConfirmedShirts = orders.filter(o => o.payment_status === 'confirmed').reduce((s, o) => s + Number(o.quantity || 0), 0);
  const totalShirts = orders.reduce((s, o) => s + Number(o.quantity || 0), 0);
  const pendingCount = orders.filter(o => o.payment_status === 'pending').length;

  const sizeCounts = { S: 0, M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0 };
  orders.forEach((o) => {
    const s = o.size || 'L';
    if (sizeCounts[s] !== undefined) sizeCounts[s] += Number(o.quantity || 1);
  });

  // ----------------------------------------------------
  // Login Screen
  // ----------------------------------------------------
  if (!session) {
    return (
      <div className="max-w-md mx-auto py-16 px-4">
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">SECURE CONTROL PANEL</span>
          </div>
          <h2 className="text-xl font-bold text-center mb-1 text-zinc-900">Admin Authentication</h2>
          <p className="text-xs text-zinc-500 text-center mb-6">ระบบจัดการคำสั่งซื้อ สโมสรนักศึกษา</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-medium text-zinc-700 mb-1">USERNAME / EMAIL</label>
              <input
                type="text"
                required
                placeholder="ชื่อผู้ใช้งาน หรือ อีเมล"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-mono font-medium text-zinc-700 mb-1">PASSWORD</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-zinc-900 hover:bg-black text-white font-medium rounded-xl text-sm transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ Admin'}
            </button>
          </form>

          <div className="mt-4 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center">
            <span className="text-[10px] text-zinc-500 font-mono flex items-center justify-center gap-1">
              🔒 เข้ารหัสปลอดภัยด้วย SHA-256
            </span>
          </div>

          <div className="mt-6 pt-4 border-t text-center">
            <button type="button" onClick={onBackToStore} className="text-xs text-zinc-500 hover:text-zinc-900">
              ← กลับสู่หน้าร้านค้า
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Admin Dashboard Screen
  // ----------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 p-1 flex items-center justify-center shadow-xs overflow-hidden">
            <img src="/assets/logo.png" alt="Arch Club Logo" className="w-full h-full object-contain" onError={(e)=>{e.target.src='/assets/logo.svg'}} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 leading-tight">smoarchcmu Admin Center</h2>
            <p className="text-xs text-zinc-500 font-mono">
              ผู้ดูแลระบบ: <span className="text-zinc-800 font-bold">{session?.user?.email || 'smoarchcmu'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            type="button" 
            onClick={() => setIsDeadlineModalOpen(true)} 
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span>⏱️ ตั้งเวลาปิดรับจอง</span>
          </button>
          <button type="button" onClick={onBackToStore} className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium rounded-xl transition-all">
            หน้าร้านค้า
          </button>
          <button type="button" onClick={handleLogout} className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-xl transition-all">
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
          <div className="text-xs text-zinc-500 font-mono">ยอดขายที่ยืนยันแล้ว</div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-2">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
          <div className="text-xs text-zinc-500 font-mono">จำนวนคำสั่งซื้อทั้งหมด</div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-2">{orders.length} <span className="text-xs font-normal text-zinc-400">รายการ</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
          <div className="text-xs text-zinc-500 font-mono">จำนวนเสื้อ (ยืนยัน/ทั้งหมด)</div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-2">{totalConfirmedShirts} <span className="text-zinc-400 text-base">/ {totalShirts}</span> <span className="text-xs font-normal text-zinc-400">ตัว</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
          <div className="text-xs text-zinc-500 font-mono">รอตรวจสอบสลิป</div>
          <div className="text-2xl font-bold font-mono text-amber-600 mt-2 flex items-center justify-between">
            <span>{pendingCount}</span>
            {pendingCount > 0 && <span className="text-xs font-sans px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold animate-pulse">ต้องตรวจ</span>}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-zinc-200 bg-white px-3 pt-2 rounded-2xl shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'orders' ? 'border-zinc-900 text-zinc-900 bg-zinc-50 rounded-t-xl' : 'border-transparent text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <span>📋 รายการคำสั่งซื้อทั้งหมด ({orders.length})</span>
          {pendingCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'products' ? 'border-zinc-900 text-zinc-900 bg-zinc-50 rounded-t-xl' : 'border-transparent text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <span>👕 จัดการสินค้า ({products.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('sizing')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'sizing' ? 'border-zinc-900 text-zinc-900 bg-zinc-50 rounded-t-xl' : 'border-transparent text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <span>📏 สรุปยอดผลิต & ไซส์</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: ORDERS STREAM & QUICK 1-CLICK ACTIONS */}
      {/* ==================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 flex flex-col sm:flex-row gap-3 justify-between shadow-xs">
            <input
              type="text"
              placeholder="🔍 ค้นหาชื่อ, รหัสนักศึกษา, สาขา, เบอร์โทร, Order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs flex-1 max-w-md font-mono focus:bg-white focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold"
              >
                <option value="all">สถานะทั้งหมด</option>
                <option value="pending">⏳ รอตรวจสอบ (Pending)</option>
                <option value="confirmed">✓ ยืนยันแล้ว (Confirmed)</option>
                <option value="rejected">✕ ปฏิเสธ (Rejected)</option>
              </select>

              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono max-w-[180px] truncate"
              >
                <option value="all">ทุกลายเสื้อ</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <button
                type="button"
                onClick={() => exportOrdersToCSV(filteredOrders, products)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
              >
                <span>📊 Export CSV</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 font-mono text-zinc-500 uppercase">
                    <th className="py-3.5 px-4">Order ID / วันที่</th>
                    <th className="py-3.5 px-4">ผู้สั่งซื้อ & สาขาวิชา</th>
                    <th className="py-3.5 px-4">สินค้า & ไซส์</th>
                    <th className="py-3.5 px-4">ยอดชำระ</th>
                    <th className="py-3.5 px-4 text-center">สลิป</th>
                    <th className="py-3.5 px-4">สถานะ</th>
                    <th className="py-3.5 px-4 text-right">ปุ่มยืนยัน & จัดการ (1-Click)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-zinc-400">
                        ไม่พบข้อมูลคำสั่งซื้อที่ตรงกับเงื่อนไข
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const prod = order.products || products.find(p => p.id === order.product_id);
                      const isOrderBusy = actionLoadingId === order.id;

                      return (
                        <tr key={order.id} className="hover:bg-zinc-50/80 transition-colors">
                          
                          {/* 1. Order ID & Date */}
                          <td className="py-3.5 px-4 font-mono">
                            <div className="font-bold text-zinc-900">#{order.id.substring(0, 8)}</div>
                            <div className="text-[11px] text-zinc-400">{formatDateThai(order.created_at, true)}</div>
                            <div className="text-[10px] text-zinc-400 mt-0.5">
                              {order.delivery_method === 'shipping' ? '🚚 ส่งพัสดุ' : '📍 รับที่สโม'}
                            </div>
                          </td>

                          {/* 2. Customer Info */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-zinc-900">{order.full_name}</div>
                            <div className="font-mono text-zinc-500 text-[11px]">
                              {order.student_id} • {order.year_of_study}
                            </div>
                            <div className="text-zinc-600 text-[11px] truncate max-w-[200px]">{order.major}</div>
                            <div className="text-zinc-400 text-[10px] font-mono">{order.phone_number}</div>
                          </td>

                          {/* 3. Product & Sizing */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-zinc-900">{prod?.name || order.product_name || 'เสื้อสโมสร'}</div>
                            <div className="font-mono text-zinc-600 font-bold text-xs mt-0.5">
                              ไซส์: <span className="text-black bg-zinc-100 px-1.5 py-0.5 rounded">{order.size}</span> ({order.color}) × {order.quantity}
                            </div>
                            {order.notes && (
                              <div className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-1 max-w-[220px] truncate">
                                💬 {order.notes}
                              </div>
                            )}
                          </td>

                          {/* 4. Total Price */}
                          <td className="py-3.5 px-4 font-mono font-bold text-sm text-zinc-900">
                            {formatCurrency(order.total_price)}
                          </td>

                          {/* 5. Slip Thumbnail / Payment Mode */}
                          <td className="py-3.5 px-4 text-center">
                            {order.payment_slip_url ? (
                              <button
                                type="button"
                                onClick={() => setSelectedSlipOrder(order)}
                                className="inline-flex flex-col items-center p-1 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-all hover:scale-105"
                                title="คลิกเพื่อตรวจสลิป"
                              >
                                <img src={order.payment_slip_url} alt="Slip" className="w-9 h-9 object-cover rounded shadow-xs" />
                                <span className="text-[9px] text-zinc-500 mt-0.5">ตรวจสลิป</span>
                              </button>
                            ) : order.payment_method === 'cash' ? (
                              <div className="inline-flex flex-col items-center px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg" title="ชำระเงินสดตอนรับเสื้อ">
                                <span className="text-sm">💵</span>
                                <span className="text-[9px] font-bold text-amber-800 font-mono">เงินสด</span>
                              </div>
                            ) : (
                              <span className="text-zinc-400 font-mono text-[11px]">- ไม่มีสลิป -</span>
                            )}
                          </td>

                          {/* 6. Current Status Badge */}
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono inline-flex items-center gap-1 ${
                              order.payment_status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.payment_status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800 animate-pulse'
                            }`}>
                              <span>{order.payment_status === 'confirmed' ? '✓' : order.payment_status === 'rejected' ? '✕' : '⏳'}</span>
                              <span>{order.payment_status}</span>
                            </span>
                          </td>

                          {/* 7. Quick 1-Click Action Buttons */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              
                              {/* Simple 1-Click Confirm Button */}
                              {order.payment_status !== 'confirmed' && (
                                <button
                                  type="button"
                                  disabled={isOrderBusy}
                                  onClick={() => handleQuickUpdateStatus(order.id, 'confirmed')}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-1"
                                  title="กดยืนยันออเดอร์ทันที"
                                >
                                  <span>✓ ยืนยันยอด</span>
                                </button>
                              )}

                              {/* Simple 1-Click Reject Button */}
                              {order.payment_status !== 'rejected' && (
                                <button
                                  type="button"
                                  disabled={isOrderBusy}
                                  onClick={() => handleQuickUpdateStatus(order.id, 'rejected')}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition-all active:scale-[0.98] disabled:opacity-50"
                                  title="ปฏิเสธสลิป"
                                >
                                  <span>✕ ปฏิเสธ</span>
                                </button>
                              )}

                              {/* Toggle back to pending if already confirmed/rejected */}
                              {order.payment_status !== 'pending' && (
                                <button
                                  type="button"
                                  disabled={isOrderBusy}
                                  onClick={() => handleQuickUpdateStatus(order.id, 'pending')}
                                  className="px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[11px] rounded-lg"
                                  title="รีเซ็ตเป็นรอตรวจสอบ"
                                >
                                  ⏳
                                </button>
                              )}

                              {/* Edit Modal Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditOrder(order)}
                                className="px-2.5 py-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-xs"
                                title="แก้ไขข้อมูลออเดอร์"
                              >
                                แก้ไข
                              </button>

                              {/* Print Receipt */}
                              <button
                                type="button"
                                onClick={() => setReceiptOrder(order)}
                                className="px-2 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs rounded-lg"
                                title="พิมพ์ใบเสร็จ"
                              >
                                🖨️
                              </button>

                              {/* Delete Order Button */}
                              <button
                                type="button"
                                disabled={isOrderBusy}
                                onClick={() => handleDeleteOrder(order.id)}
                                className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs rounded-lg"
                                title="ลบคำสั่งซื้อ"
                              >
                                🗑️
                              </button>

                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: PRODUCTS CRUD IN SUPABASE */}
      {/* ==================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
            <div>
              <h3 className="font-bold text-zinc-900">จัดการข้อมูลสินค้าใน Supabase (Product Catalog CRUD)</h3>
              <p className="text-xs text-zinc-500">เพิ่มสินค้าใหม่ แก้ไขราคา ปรับไซส์ และอัปโหลดรูปภาพจริง</p>
            </div>
            <button
              type="button"
              onClick={handleOpenNewProduct}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span>+ เพิ่มสินค้าใหม่ (New Product)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map((p) => {
              const sizes = Array.isArray(p.available_sizes) ? p.available_sizes : [];
              const colors = Array.isArray(p.available_colors) ? p.available_colors : [p.available_colors];
              return (
                <div key={p.id} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-zinc-100 rounded-xl overflow-hidden border shrink-0">
                      <img
                        src={p.image_front_url || '/assets/images/arch_shirt_front.jpg'}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-zinc-900 leading-snug">{p.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                          p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-600'
                        }`}>
                          {p.is_active ? 'เปิดขาย' : 'ปิดการขาย'}
                        </span>
                      </div>
                      <div className="text-base font-bold font-mono text-zinc-900">{formatCurrency(p.price)}</div>
                      <p className="text-xs text-zinc-500 line-clamp-2">{p.description}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 space-y-2 text-xs font-mono">
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-zinc-400 text-[11px]">ไซส์:</span>
                      {sizes.map(s => <span key={s} className="px-1.5 py-0.5 bg-zinc-100 rounded text-[11px]">{s}</span>)}
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-zinc-400 text-[11px]">สี:</span>
                      {colors.map(c => <span key={c} className="px-1.5 py-0.5 bg-zinc-100 rounded text-[11px]">{c}</span>)}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => handleOpenEditProduct(p)}
                      className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-all"
                    >
                      ✏️ แก้ไขข้อมูลสินค้า
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id, p.name)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition-all"
                    >
                      🗑️ ลบ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: SIZING BREAKDOWN */}
      {/* ==================================================== */}
      {activeTab === 'sizing' && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-6">
          <div>
            <h3 className="font-bold text-base text-zinc-900">สรุปจำนวนยอดจองตามขนาดไซส์ (Production Sizing)</h3>
            <p className="text-xs text-zinc-500">ตัวเลขสรุปยอดสำหรับนำไปสั่งตัดและสกรีนเสื้อกับโรงงานผลิต</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(sizeCounts).map(([sz, count]) => (
              <div key={sz} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 text-center">
                <div className="text-xs font-mono font-bold text-zinc-400">SIZE</div>
                <div className="text-2xl font-black font-mono text-zinc-900 mt-1">{sz}</div>
                <div className="text-base font-bold font-mono text-emerald-600 mt-2">{count} ตัว</div>
              </div>
            ))}
          </div>

          {/* Breakdown per Product */}
          <div className="pt-4 border-t border-zinc-100">
            <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-700 font-mono mb-3">
              ยอดแยกตามรุ่นสินค้า:
            </h4>
            <div className="space-y-3">
              {products.map(p => {
                const prodOrders = orders.filter(o => o.product_id === p.id && o.payment_status === 'confirmed');
                const prodTotalShirts = prodOrders.reduce((s, o) => s + Number(o.quantity || 0), 0);
                return (
                  <div key={p.id} className="p-4 bg-zinc-50 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <div className="font-bold text-sm text-zinc-900">{p.name}</div>
                      <div className="text-xs text-zinc-500 font-mono">ยอดคำสั่งซื้อที่ยืนยัน: {prodOrders.length} รายการ</div>
                    </div>
                    <div className="text-lg font-bold font-mono text-zinc-900">
                      {prodTotalShirts} <span className="text-xs font-normal text-zinc-500">ตัว</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: SLIP INSPECTOR WITH 1-CLICK CONFIRM */}
      {/* ==================================================== */}
      {selectedSlipOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white max-w-3xl w-full rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <h3 className="font-bold text-sm font-mono">ตรวจสลิปโอนเงิน — Order #{selectedSlipOrder.id.substring(0, 8)}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlipOrder(null)}
                className="text-zinc-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              
              {/* Left: Slip Viewer */}
              <div className="flex flex-col items-center space-y-3">
                <div className="relative w-full h-80 bg-zinc-950 rounded-2xl overflow-hidden flex items-center justify-center border border-zinc-800">
                  <img
                    src={selectedSlipOrder.payment_slip_url}
                    alt="Slip"
                    style={{
                      transform: `scale(${slipZoom}) rotate(${slipRotation}deg)`,
                      transition: 'transform 0.2s ease'
                    }}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                
                {/* Controls */}
                <div className="flex items-center gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setSlipZoom(Math.max(0.5, slipZoom - 0.25))}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 rounded-lg"
                  >
                    🔍 ซูมออก
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlipZoom(Math.min(3, slipZoom + 0.25))}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 rounded-lg"
                  >
                    🔍 ซูมเข้า
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlipRotation((slipRotation + 90) % 360)}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 rounded-lg"
                  >
                    🔄 หมุน
                  </button>
                  <a
                    href={selectedSlipOrder.payment_slip_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-zinc-900 text-white rounded-lg"
                  >
                    ↗️ เต็มจอ
                  </a>
                </div>
              </div>

              {/* Right: Info & 1-Click Confirm Buttons */}
              <div className="space-y-4 flex flex-col justify-between">
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-zinc-500 font-mono">ยอดที่ต้องชำระ:</span>
                    <span className="text-lg font-bold font-mono text-emerald-600">
                      {formatCurrency(selectedSlipOrder.total_price)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="font-bold text-zinc-900">{selectedSlipOrder.full_name}</div>
                    <div className="text-zinc-600 font-mono">{selectedSlipOrder.student_id} • {selectedSlipOrder.year_of_study}</div>
                    <div className="text-zinc-600">{selectedSlipOrder.major}</div>
                    <div className="text-zinc-400 font-mono text-[11px] pt-1">
                      เวลาสั่งซื้อ: {formatDateThai(selectedSlipOrder.created_at, true)}
                    </div>
                  </div>

                  <div className="pt-2 border-t text-[11px] text-zinc-500">
                    <div>บัญชีรับเงิน: {STORE_CONFIG.payment.bankAccountName}</div>
                    <div>{STORE_CONFIG.payment.bankName}: {STORE_CONFIG.payment.bankAccountNo}</div>
                  </div>
                </div>

                {/* Big Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleQuickUpdateStatus(selectedSlipOrder.id, 'confirmed')}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <span>✓ สลิปถูกต้อง — กดยืนยันออเดอร์ทันที</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickUpdateStatus(selectedSlipOrder.id, 'rejected')}
                      className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-200"
                    >
                      ✕ ปฏิเสธสลิป
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickUpdateStatus(selectedSlipOrder.id, 'pending')}
                      className="py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs border border-amber-200"
                    >
                      ⏳ ตั้งเป็นรอตรวจสอบ
                    </button>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: PRODUCT CRUD (ADD / EDIT) */}
      {/* ==================================================== */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]">
            
            <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm font-mono">
                {editingProduct ? '✏️ แก้ไขสินค้าใน Supabase' : '✨ เพิ่มสินค้าใหม่ลง Supabase'}
              </h3>
              <button type="button" onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-zinc-700 mb-1">ชื่อสินค้า (Product Name) *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ARCH 2026 : STRUCTURE & VOID"
                  value={productFormData.name}
                  onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-zinc-50 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">ราคา (THB) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="350"
                    value={productFormData.price}
                    onChange={(e) => setProductFormData({ ...productFormData, price: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 border rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">วันปิดรับจอง (Deadline)</label>
                  <input
                    type="datetime-local"
                    value={productFormData.order_deadline}
                    onChange={(e) => setProductFormData({ ...productFormData, order_deadline: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">คำอธิบายสินค้า (Description)</label>
                <textarea
                  rows="3"
                  placeholder="รายละเอียดเนื้อผ้า ลวดลาย และขนาด..."
                  value={productFormData.description}
                  onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-zinc-50 border rounded-xl"
                ></textarea>
              </div>

              {/* Sizes Selector */}
              <div>
                <label className="block font-bold text-zinc-700 mb-1.5">ไซส์ที่เปิดให้เลือก (Available Sizes):</label>
                <div className="flex flex-wrap gap-2">
                  {['S', 'M', 'L', 'XL', '2XL', '3XL'].map((s) => {
                    const checked = productFormData.available_sizes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          const updated = checked
                            ? productFormData.available_sizes.filter(sz => sz !== s)
                            : [...productFormData.available_sizes, s];
                          setProductFormData({ ...productFormData, available_sizes: updated });
                        }}
                        className={`px-3 py-1.5 rounded-lg border font-mono font-bold text-xs transition-all ${
                          checked ? 'bg-zinc-900 text-white border-black' : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                        }`}
                      >
                        {checked ? `✓ ${s}` : s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Colors */}
              <div>
                <label className="block font-bold text-zinc-700 mb-1">สีที่มีให้เลือก (คั่นด้วยจุลภาค):</label>
                <input
                  type="text"
                  placeholder="Deep Black, Chalk White, Slate Charcoal"
                  value={productFormData.available_colors}
                  onChange={(e) => setProductFormData({ ...productFormData, available_colors: e.target.value })}
                  className="w-full px-3.5 py-2 bg-zinc-50 border rounded-xl"
                />
              </div>

              {/* Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-zinc-50 rounded-xl border space-y-2">
                  <label className="block font-bold text-zinc-700">รูปภาพด้านหน้า (Front Image):</label>
                  {productFormData.image_front_url && (
                    <img src={productFormData.image_front_url} alt="Front" className="w-full h-32 object-contain bg-white rounded-lg border" />
                  )}
                  <input
                    type="text"
                    placeholder="URL รูปภาพด้านหน้า..."
                    value={productFormData.image_front_url}
                    onChange={(e) => setProductFormData({ ...productFormData, image_front_url: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border rounded-lg font-mono text-[11px]"
                  />
                  <label className="block text-center px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 rounded-lg cursor-pointer text-[11px]">
                    <input type="file" accept="image/*" onChange={(e) => handleUploadImage(e.target.files[0], 'front')} className="hidden" />
                    {uploadingFront ? 'กำลังอัปโหลด...' : '📁 อัปโหลดไฟล์รูปด้านหน้า'}
                  </label>
                </div>

                <div className="p-3 bg-zinc-50 rounded-xl border space-y-2">
                  <label className="block font-bold text-zinc-700">รูปภาพด้านหลัง (Back Image):</label>
                  {productFormData.image_back_url && (
                    <img src={productFormData.image_back_url} alt="Back" className="w-full h-32 object-contain bg-white rounded-lg border" />
                  )}
                  <input
                    type="text"
                    placeholder="URL รูปภาพด้านหลัง..."
                    value={productFormData.image_back_url}
                    onChange={(e) => setProductFormData({ ...productFormData, image_back_url: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border rounded-lg font-mono text-[11px]"
                  />
                  <label className="block text-center px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 rounded-lg cursor-pointer text-[11px]">
                    <input type="file" accept="image/*" onChange={(e) => handleUploadImage(e.target.files[0], 'back')} className="hidden" />
                    {uploadingBack ? 'กำลังอัปโหลด...' : '📁 อัปโหลดไฟล์รูปด้านหลัง'}
                  </label>
                </div>
              </div>

              {/* Order Deadline */}
              <div className="p-3 bg-zinc-50 rounded-xl border space-y-1.5">
                <label className="block font-bold text-zinc-900">⏱️ วันและเวลาปิดรับสั่งจองสินค้านี้ (Deadline):</label>
                <input
                  type="datetime-local"
                  value={productFormData.order_deadline}
                  onChange={(e) => setProductFormData({ ...productFormData, order_deadline: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl font-mono text-xs"
                />
                <p className="text-[10.5px] text-zinc-500">
                  ระบบนับถอยหลังหน้าเว็บจะคำนวณและนับตามวันเวลานี้แบบเรียลไทม์
                </p>
              </div>

              {/* Status Toggle */}
              <div className="p-3 bg-zinc-50 rounded-xl border flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-900">เปิดรับจองสินค้านี้บนหน้าเว็บ</div>
                  <div className="text-[11px] text-zinc-500">หากปิด สินค้าจะไม่แสดงให้บุคคลทั่วไปสั่งซื้อ</div>
                </div>
                <input
                  type="checkbox"
                  checked={productFormData.is_active}
                  onChange={(e) => setProductFormData({ ...productFormData, is_active: e.target.checked })}
                  className="w-5 h-5 accent-zinc-900"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-black text-white font-bold rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
                >
                  {loading ? 'กำลังบันทึก...' : (editingProduct ? 'บันทึกการแก้ไขลง Supabase' : 'สร้างสินค้าใหม่ลง Supabase')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs"
                >
                  ยกเลิก
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: ORDER EDIT CRUD IN SUPABASE */}
      {/* ==================================================== */}
      {isOrderEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white max-w-xl w-full rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]">
            
            <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm font-mono">
                ✏️ แก้ไขคำสั่งซื้อ #{editingOrder?.id?.substring(0, 8)}
              </h3>
              <button type="button" onClick={() => setIsOrderEditModalOpen(false)} className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOrderEdit} className="p-6 overflow-y-auto space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">ชื่อ-นามสกุล *</label>
                  <input
                    type="text"
                    required
                    value={orderFormData.full_name}
                    onChange={(e) => setOrderFormData({ ...orderFormData, full_name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">รหัสนักศึกษา *</label>
                  <input
                    type="text"
                    required
                    value={orderFormData.student_id}
                    onChange={(e) => setOrderFormData({ ...orderFormData, student_id: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">ระดับชั้นปี *</label>
                  <select
                    value={orderFormData.year_of_study}
                    onChange={(e) => setOrderFormData({ ...orderFormData, year_of_study: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border rounded-xl"
                  >
                    {STORE_CONFIG.years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">ภาควิชา / สาขา *</label>
                  <select
                    value={orderFormData.major}
                    onChange={(e) => setOrderFormData({ ...orderFormData, major: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border rounded-xl"
                  >
                    {STORE_CONFIG.majors.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">ไซส์เสื้อ *</label>
                  <select
                    value={orderFormData.size}
                    onChange={(e) => setOrderFormData({ ...orderFormData, size: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border rounded-xl font-mono font-bold"
                  >
                    {['S', 'M', 'L', 'XL', '2XL', '3XL'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">สีเสื้อ</label>
                  <input
                    type="text"
                    value={orderFormData.color}
                    onChange={(e) => setOrderFormData({ ...orderFormData, color: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">จำนวน (ตัว) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={orderFormData.quantity}
                    onChange={(e) => setOrderFormData({ ...orderFormData, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-zinc-50 border rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">ยอดเงินรวม (THB) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={orderFormData.total_price}
                    onChange={(e) => setOrderFormData({ ...orderFormData, total_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-zinc-50 border rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">สถานะคำสั่งซื้อ *</label>
                  <select
                    value={orderFormData.payment_status}
                    onChange={(e) => setOrderFormData({ ...orderFormData, payment_status: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border rounded-xl font-bold font-mono"
                  >
                    <option value="pending">pending (รอตรวจสอบ)</option>
                    <option value="confirmed">confirmed (ยืนยันแล้ว)</option>
                    <option value="rejected">rejected (ปฏิเสธ)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">หมายเหตุ (Notes)</label>
                <input
                  type="text"
                  value={orderFormData.notes}
                  onChange={(e) => setOrderFormData({ ...orderFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border rounded-xl"
                />
              </div>

              <div className="pt-3 border-t flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-black text-white font-bold rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
                >
                  {loading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไขลง Supabase'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOrderEditModalOpen(false)}
                  className="px-4 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs"
                >
                  ยกเลิก
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 4: OFFICIAL PRINTABLE RECEIPT (1-PAGE) */}
      {/* ==================================================== */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div id="printable-receipt" className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden">
            
            <div className="p-4 space-y-2.5 text-xs font-mono">
              {/* Header */}
              <div className="text-center pb-2 border-b-2 border-zinc-900 space-y-0.5">
                <div className="text-xs font-bold text-zinc-900 tracking-wider">
                  สโมสรนักศึกษาคณะสถาปัตยกรรมศาสตร์
                </div>
                <div className="text-[10px] text-zinc-500 uppercase">
                  FACULTY OF ARCHITECTURE STUDENT UNION
                </div>
                <div className="inline-block px-2.5 py-0.5 mt-0.5 bg-zinc-100 border border-zinc-300 rounded font-bold text-[10px] text-zinc-800">
                  ใบเสร็จรับเงิน / คำสั่งจองเสื้อ (PRE-ORDER RECEIPT)
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-1 text-[10px] py-1 border-b border-zinc-200">
                <div>
                  <span className="text-zinc-500">เลขที่ออเดอร์:</span>
                  <div className="font-bold text-zinc-900">#{receiptOrder.id}</div>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500">วันที่:</span>
                  <div className="font-bold text-zinc-900">{formatDateThai(receiptOrder.created_at, true)}</div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">ผู้สั่งซื้อ:</span>
                  <span className="font-bold text-zinc-900">{receiptOrder.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">รหัสนักศึกษา:</span>
                  <span className="font-bold text-zinc-900">{receiptOrder.student_id || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">ภาควิชา/ชั้นปี:</span>
                  <span className="text-zinc-900">{receiptOrder.major} ({receiptOrder.year_of_study})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">เบอร์โทร:</span>
                  <span className="text-zinc-900">{receiptOrder.phone_number || '-'}</span>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-zinc-300 text-zinc-600 font-bold">
                    <th className="py-1">รายการ</th>
                    <th className="py-1 text-center">ไซส์/สี</th>
                    <th className="py-1 text-center">จำนวน</th>
                    <th className="py-1 text-right">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr>
                    <td className="py-1.5 font-bold text-zinc-900 truncate max-w-[140px]">
                      {receiptOrder.products?.name || receiptOrder.product_name || 'เสื้อสโมสรนักศึกษา 2026'}
                    </td>
                    <td className="py-1.5 text-center font-bold">
                      {receiptOrder.size} {receiptOrder.color ? `(${receiptOrder.color})` : ''}
                    </td>
                    <td className="py-1.5 text-center">
                      {receiptOrder.quantity} ตัว
                    </td>
                    <td className="py-1.5 text-right font-bold">
                      {formatCurrency(receiptOrder.total_price - (receiptOrder.delivery_method === 'shipping' ? STORE_CONFIG.faculty.shippingFee : 0))}
                    </td>
                  </tr>
                  {receiptOrder.delivery_method === 'shipping' && (
                    <tr>
                      <td colSpan="3" className="py-1 text-zinc-500">
                        ค่าจัดส่งพัสดุ
                      </td>
                      <td className="py-1 text-right font-bold">
                        {formatCurrency(STORE_CONFIG.faculty.shippingFee)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-900 font-bold text-[11px]">
                    <td colSpan="3" className="py-1.5 text-zinc-900">ยอดชำระสุทธิ (Grand Total):</td>
                    <td className="py-1.5 text-right text-emerald-600 text-xs">{formatCurrency(receiptOrder.total_price)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Delivery & Status Box */}
              <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-200 space-y-0.5 text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">วิธีรับสินค้า:</span>
                  <span className="font-bold text-zinc-900">
                    {receiptOrder.delivery_method === 'shipping' ? `🚚 พัสดุ (${receiptOrder.shipping_address})` : `📍 ${STORE_CONFIG.faculty.pickupLocation}`}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t">
                  <span className="text-zinc-500">สถานะชำระเงิน:</span>
                  <span className={`font-bold px-1.5 py-0.2 rounded text-[9px] ${
                    receiptOrder.payment_status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {receiptOrder.payment_status === 'confirmed' ? '✓ ชำระเงินเรียบร้อย (PAID)' : '⏳ รอตรวจสอบสลิป'}
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-4 pt-2 text-center text-[9px] text-zinc-600">
                <div className="space-y-4">
                  <div className="border-b border-zinc-300 h-4"></div>
                  <div>ลงชื่อ: .......................................<br/>(เจ้าหน้าที่สโมสรผู้รับเงิน)</div>
                </div>
                <div className="space-y-4">
                  <div className="border-b border-zinc-300 h-4"></div>
                  <div>ลงชื่อ: .......................................<br/>(ผู้สั่งซื้อ / ผู้รับสินค้า)</div>
                </div>
              </div>

              {/* Note Footer */}
              <div className="text-center text-[8.5px] text-zinc-400 pt-1 border-t">
                * กรุณาเก็บใบเสร็จนี้หรือภาพหน้าจอไว้เป็นหลักฐานรับเสื้อที่สโมสรนักศึกษา *
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-zinc-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <span>🖨️ พิมพ์ใบเสร็จ (1 แผ่น)</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="px-5 py-2.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold text-xs rounded-xl transition-all"
              >
                ปิด
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 5: COUNTDOWN DEADLINE SETTINGS */}
      {/* ==================================================== */}
      {isDeadlineModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden">
            
            <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">⏱️</span>
                <h3 className="font-bold text-sm">กำหนดวันและเวลาปิดรับสั่งจอง</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsDeadlineModalOpen(false)} 
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDeadline} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-zinc-800">
                  เลือกวันและเวลาปิดรับจอง (Target Date & Time):
                </label>
                <input
                  type="datetime-local"
                  required
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl font-mono text-xs focus:bg-white focus:border-zinc-900"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-mono text-zinc-500">เลือกตั้งค่าด่วน (Quick Presets):</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                      const pad = (n) => String(n).padStart(2, '0');
                      setDeadlineInput(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T23:59`);
                    }}
                    className="py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-800 font-medium text-[11px] transition-all"
                  >
                    +7 วัน (23:59)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
                      const pad = (n) => String(n).padStart(2, '0');
                      setDeadlineInput(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T23:59`);
                    }}
                    className="py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-800 font-medium text-[11px] transition-all"
                  >
                    +14 วัน (23:59)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      const pad = (n) => String(n).padStart(2, '0');
                      setDeadlineInput(`${lastDay.getFullYear()}-${pad(lastDay.getMonth()+1)}-${pad(lastDay.getDate())}T23:59`);
                    }}
                    className="py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-800 font-medium text-[11px] transition-all"
                  >
                    สิ้นเดือนนี้
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <div className="font-bold">⚡ ระบบนับถอยหลังตามเวลาจริง (Real-Time):</div>
                <p className="leading-relaxed">
                  เมื่อกดบันทึก ตัวเลขนับถอยหลัง (วัน : ชั่วโมง : นาที : วินาที) ที่หน้าแรกจะนับถอยหลังไปยังเวลาที่คุณกำหนดแบบวินาทีต่อวินาทีโดยอัตโนมัติ
                </p>
              </div>

              <div className="pt-3 border-t flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-zinc-900 hover:bg-black text-white font-bold rounded-xl text-xs shadow-md transition-all"
                >
                  💾 บันทึกเวลาปิดรับจอง
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeadlineModalOpen(false)}
                  className="px-5 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs"
                >
                  ยกเลิก
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
