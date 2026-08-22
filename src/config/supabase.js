/**
 * Supabase Client Initializer (src/config/supabase.js)
 */

import { createClient } from '@supabase/supabase-js';
import { MOCK_PRODUCTS, MOCK_ORDERS } from '../data/mockData';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || localStorage.getItem('archshop_supabase_url') || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem('archshop_supabase_anon_key') || 'your-anon-key-here';

export const isLiveSupabase = supabaseUrl && supabaseAnonKey && 
  !supabaseUrl.includes('your-project') && 
  !supabaseAnonKey.includes('your-anon-key') &&
  supabaseUrl.startsWith('https://');

export const supabase = isLiveSupabase 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } }
    })
  : null;

// ==========================================
// DATA ACCESS LAYER
// ==========================================

export const api = {
  // Products
  async getProducts(publicOnly = true) {
    try {
      if (isLiveSupabase && supabase) {
        let query = supabase.from('products').select('*').order('created_at', { ascending: false });
        if (publicOnly) query = query.eq('is_active', true);
        const { data, error } = await query;
        if (error) {
          console.warn('Supabase getProducts notice (using local fallback):', error);
          const local = localStorage.getItem('archshop_mock_products');
          const items = local ? JSON.parse(local) : MOCK_PRODUCTS;
          return Array.isArray(items) ? (publicOnly ? items.filter(p => p?.is_active) : items) : MOCK_PRODUCTS;
        }
        return Array.isArray(data) ? data : [];
      }
      const local = localStorage.getItem('archshop_mock_products');
      const items = local ? JSON.parse(local) : MOCK_PRODUCTS;
      return Array.isArray(items) ? (publicOnly ? items.filter(p => p?.is_active) : items) : MOCK_PRODUCTS;
    } catch (err) {
      console.warn('getProducts fallback notice:', err);
      return MOCK_PRODUCTS;
    }
  },

  async getProductById(id) {
    if (!id) return null;
    try {
      if (isLiveSupabase && supabase) {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
        if (!error && data) return data;
      }
      const local = localStorage.getItem('archshop_mock_products');
      const items = local ? JSON.parse(local) : MOCK_PRODUCTS;
      return Array.isArray(items) ? (items.find(p => p?.id === id) || null) : null;
    } catch (err) {
      console.warn('getProductById notice:', err);
      return null;
    }
  },

  async createProduct(productData) {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('products').insert([productData]).select();
      if (error) {
        console.error('Supabase createProduct error:', error);
        throw error;
      }
      const created = data?.[0] || productData;
      window.dispatchEvent(new CustomEvent('arch_products_updated', { detail: { type: 'INSERT', product: created } }));
      return created;
    }
    const local = localStorage.getItem('archshop_mock_products');
    const items = local ? JSON.parse(local) : MOCK_PRODUCTS;
    const newP = { ...productData, id: 'prod-' + Date.now().toString(36), created_at: new Date().toISOString() };
    items.unshift(newP);
    localStorage.setItem('archshop_mock_products', JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('arch_products_updated', { detail: { type: 'INSERT', product: newP } }));
    return newP;
  },

  async updateProduct(id, updates) {
    const allowedCols = [
      'name', 'description', 'price', 'available_sizes', 'available_colors',
      'image_front_url', 'image_back_url', 'is_active', 'order_deadline'
    ];
    const cleanUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedCols.includes(key)) {
        cleanUpdates[key] = updates[key];
      }
    });

    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('products').update(cleanUpdates).eq('id', id).select();
      if (error) {
        console.error('Supabase updateProduct error:', error);
        throw error;
      }
      const updated = data?.[0] || { id, ...cleanUpdates };
      window.dispatchEvent(new CustomEvent('arch_products_updated', { detail: { type: 'UPDATE', product: updated } }));
      return updated;
    }
    const local = localStorage.getItem('archshop_mock_products');
    let items = local ? JSON.parse(local) : MOCK_PRODUCTS;
    items = items.map(p => p.id === id ? { ...p, ...cleanUpdates } : p);
    localStorage.setItem('archshop_mock_products', JSON.stringify(items));
    const updated = items.find(p => p.id === id);
    window.dispatchEvent(new CustomEvent('arch_products_updated', { detail: { type: 'UPDATE', product: updated } }));
    return updated;
  },

  async deleteProduct(id) {
    if (isLiveSupabase && supabase) {
      // 1. Unlink orders referencing this product so foreign key constraint is not violated
      try {
        await supabase.from('orders').update({ product_id: null }).eq('product_id', id);
      } catch (unlinkErr) {
        console.warn('Notice unlinking orders before product delete:', unlinkErr);
      }

      // 2. Safely delete the product
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        console.error('Supabase deleteProduct error:', error);
        throw error;
      }
      window.dispatchEvent(new CustomEvent('arch_products_updated', { detail: { type: 'DELETE', id } }));
      return true;
    }
    const local = localStorage.getItem('archshop_mock_products');
    let items = local ? JSON.parse(local) : MOCK_PRODUCTS;
    items = items.filter(p => p.id !== id);
    localStorage.setItem('archshop_mock_products', JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('arch_products_updated', { detail: { type: 'DELETE', id } }));
    return true;
  },

  // Orders
  async submitOrder(orderData) {
    // 1. Check deadline if specified
    if (orderData.product_id) {
      try {
        const prod = await this.getProductById(orderData.product_id);
        if (prod) {
          if (prod.is_active === false) {
            throw new Error('ขออภัย สินค้านี้ปิดรับสั่งจองแล้ว (Sales Closed)');
          }
          const effectiveDeadline = prod.order_deadline || (typeof localStorage !== 'undefined' ? localStorage.getItem('arch_custom_deadline') : null);
          if (effectiveDeadline && new Date(effectiveDeadline) < new Date()) {
            throw new Error('ขออภัย หมดเวลาสั่งจองสินค้านี้แล้ว (Order Deadline Expired)');
          }
        }
      } catch (err) {
        if (err.message && err.message.includes('ขออภัย')) throw err;
      }
    }

    // Check if product_id is a valid UUID
    const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(orderData.product_id || ''));

    // Construct strict clean order matching Postgres schema
    const cleanOrder = {
      product_id: isUUID ? orderData.product_id : null,
      full_name: String(orderData.full_name || '').trim(),
      student_id: String(orderData.student_id || '').trim(),
      year_of_study: String(orderData.year_of_study || '').trim(),
      major: String(orderData.major || '').trim(),
      phone_number: String(orderData.phone_number || '').trim(),
      email_or_line_id: String(orderData.email_or_line_id || '').trim(),
      color: String(orderData.color || 'Deep Black'),
      size: String(orderData.size || 'L'),
      quantity: Math.max(1, parseInt(orderData.quantity, 10) || 1),
      total_price: Number(orderData.total_price) || 0,
      payment_slip_url: orderData.payment_slip_url || null,
      delivery_method: orderData.delivery_method === 'shipping' ? 'shipping' : 'pickup',
      shipping_address: orderData.delivery_method === 'shipping' ? (orderData.shipping_address || null) : null,
      notes: orderData.notes ? String(orderData.notes).trim() : null,
      payment_status: 'pending'
    };

    if (isLiveSupabase && supabase) {
      try {
        const { data, error } = await supabase.from('orders').insert([cleanOrder]).select();
        if (!error && data?.[0]) {
          return data[0];
        }
        if (error) {
          console.warn('Supabase submitOrder notice (attempting retry without product_id):', error);
          // If foreign key constraint failed on product_id, retry without product_id
          if (cleanOrder.product_id) {
            cleanOrder.product_id = null;
            const retry = await supabase.from('orders').insert([cleanOrder]).select();
            if (!retry.error && retry.data?.[0]) {
              return retry.data[0];
            }
          }
          console.warn('Supabase insert failed, saving to local orders storage fallback:', error.message);
        }
      } catch (supaErr) {
        console.warn('Supabase submitOrder caught exception:', supaErr);
      }
    }

    // Safe fallback to localStorage mock orders
    const local = localStorage.getItem('archshop_mock_orders');
    const orders = local ? JSON.parse(local) : MOCK_ORDERS;
    const newO = {
      ...cleanOrder,
      product_id: orderData.product_id,
      id: 'ord-' + Math.floor(100000 + Math.random() * 900000),
      created_at: new Date().toISOString(),
      payment_status: 'pending'
    };
    orders.unshift(newO);
    localStorage.setItem('archshop_mock_orders', JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent('arch_order_created', { detail: newO }));
    return newO;
  },



  async getAllOrders() {
    try {
      if (isLiveSupabase && supabase) {
        const { data, error } = await supabase.from('orders').select('*, products(*)').order('created_at', { ascending: false });
        if (error) {
          console.warn('Supabase getAllOrders notice (using local fallback):', error);
          const local = localStorage.getItem('archshop_mock_orders');
          const items = local ? JSON.parse(local) : MOCK_ORDERS;
          return Array.isArray(items) ? items : MOCK_ORDERS;
        }
        return Array.isArray(data) ? data : [];
      }
      const local = localStorage.getItem('archshop_mock_orders');
      const items = local ? JSON.parse(local) : MOCK_ORDERS;
      return Array.isArray(items) ? items : MOCK_ORDERS;
    } catch (err) {
      console.warn('getAllOrders fallback notice:', err);
      return MOCK_ORDERS;
    }
  },

  async trackOrder(term) {
    if (!term || typeof term !== 'string') return [];
    const cleanTerm = term.trim();
    if (!cleanTerm) return [];

    if (isLiveSupabase && supabase) {
      // Check if cleanTerm matches UUID regex format
      const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanTerm);

      let query = supabase.from('orders').select('*, products(*)');

      if (isUUID) {
        query = query.eq('id', cleanTerm);
      } else {
        // Safe multi-field partial matching across text columns
        query = query.or(
          `student_id.ilike.%${cleanTerm}%,phone_number.ilike.%${cleanTerm}%,full_name.ilike.%${cleanTerm}%,email_or_line_id.ilike.%${cleanTerm}%`
        );
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase trackOrder error:', error);
        throw error;
      }
      return data || [];
    }

    const local = localStorage.getItem('archshop_mock_orders');
    const orders = local ? JSON.parse(local) : MOCK_ORDERS;
    const lower = cleanTerm.toLowerCase();
    return orders.filter(o => 
      String(o.id || '').toLowerCase().includes(lower) ||
      String(o.student_id || '').toLowerCase().includes(lower) ||
      String(o.phone_number || '').includes(cleanTerm) ||
      String(o.full_name || '').toLowerCase().includes(lower) ||
      String(o.email_or_line_id || '').toLowerCase().includes(lower)
    );
  },

  async updateOrder(id, updates) {
    const allowedCols = [
      'product_id', 'full_name', 'student_id', 'year_of_study', 'major',
      'phone_number', 'email_or_line_id', 'color', 'size', 'quantity',
      'total_price', 'payment_slip_url', 'delivery_method', 'shipping_address',
      'notes', 'payment_status'
    ];
    const cleanUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedCols.includes(key)) {
        cleanUpdates[key] = updates[key];
      }
    });

    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('orders').update(cleanUpdates).eq('id', id).select();
      if (error) {
        console.error('Supabase updateOrder error:', error);
        throw error;
      }
      return data?.[0] || { id, ...cleanUpdates };
    }
    const local = localStorage.getItem('archshop_mock_orders');
    let orders = local ? JSON.parse(local) : MOCK_ORDERS;
    orders = orders.map(o => o.id === id ? { ...o, ...cleanUpdates } : o);
    localStorage.setItem('archshop_mock_orders', JSON.stringify(orders));
    return orders.find(o => o.id === id);
  },

  async updateOrderStatus(id, payment_status) {
    return this.updateOrder(id, { payment_status });
  },

  async deleteOrder(id) {
    if (isLiveSupabase && supabase) {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    const local = localStorage.getItem('archshop_mock_orders');
    let orders = local ? JSON.parse(local) : MOCK_ORDERS;
    orders = orders.filter(o => o.id !== id);
    localStorage.setItem('archshop_mock_orders', JSON.stringify(orders));
    return true;
  },

  // Storage
  async uploadSlip(file, studentId) {
    if (!file) return null;
    const cleanId = String(studentId || 'std').replace(/[^a-zA-Z0-9]/g, '');
    const ext = (file.name || 'slip.jpg').split('.').pop() || 'jpg';
    const name = `slip_${cleanId}_${Date.now()}.${ext}`;

    if (isLiveSupabase && supabase) {
      try {
        const { error } = await supabase.storage.from('payment-slips').upload(name, file, {
          cacheControl: '3600',
          upsert: true
        });
        if (!error) {
          const { data } = supabase.storage.from('payment-slips').getPublicUrl(name);
          if (data?.publicUrl) return data.publicUrl;
        } else {
          console.warn('Supabase storage upload notice:', error.message || error);
        }
      } catch (storageErr) {
        console.warn('Supabase storage upload catch:', storageErr);
      }
    }

    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      } catch {
        resolve(null);
      }
    });
  },


  async uploadProductImage(file, side = 'front') {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const name = `prod_${side}_${Date.now()}.${ext}`;

    if (isLiveSupabase && supabase) {
      const { error } = await supabase.storage.from('product-images').upload(name, file);
      if (!error) {
        const { data } = supabase.storage.from('product-images').getPublicUrl(name);
        return data.publicUrl;
      }
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  },

  // Realtime
  subscribeOrders(onInsert, onUpdate, onDelete) {
    if (isLiveSupabase && supabase) {
      const channel = supabase
        .channel('realtime-orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, p => onInsert && onInsert(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, p => onUpdate && onUpdate(p.new))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, p => onDelete && onDelete(p.old))
        .subscribe();

      return {
        unsubscribe: () => {
          try {
            supabase.removeChannel(channel);
          } catch (e) {
            console.warn('removeChannel error:', e);
          }
        }
      };
    }
    const handler = (e) => onInsert && onInsert(e.detail);
    window.addEventListener('arch_order_created', handler);
    return { unsubscribe: () => window.removeEventListener('arch_order_created', handler) };
  },

  subscribeProducts(onChange) {
    if (isLiveSupabase && supabase) {
      const channel = supabase
        .channel('realtime-products')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
          if (onChange) onChange(payload);
        })
        .subscribe();

      return {
        unsubscribe: () => {
          try {
            supabase.removeChannel(channel);
          } catch (e) {
            console.warn('removeChannel error:', e);
          }
        }
      };
    }
    const handler = (e) => onChange && onChange(e.detail);
    window.addEventListener('arch_products_updated', handler);
    return { unsubscribe: () => window.removeEventListener('arch_products_updated', handler) };
  }
};
