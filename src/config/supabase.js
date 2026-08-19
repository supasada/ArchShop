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
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : null;

// ==========================================
// DATA ACCESS LAYER
// ==========================================

export const api = {
  // Products
  async getProducts(publicOnly = true) {
    if (isLiveSupabase && supabase) {
      let query = supabase.from('products').select('*').order('created_at', { ascending: false });
      if (publicOnly) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
    const local = localStorage.getItem('archshop_mock_products');
    const items = local ? JSON.parse(local) : MOCK_PRODUCTS;
    return publicOnly ? items.filter(p => p.is_active) : items;
  },

  async createProduct(productData) {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('products').insert([productData]).select();
      if (error) {
        console.error('Supabase createProduct error:', error);
        throw error;
      }
      return data?.[0] || productData;
    }
    const local = localStorage.getItem('archshop_mock_products');
    const items = local ? JSON.parse(local) : MOCK_PRODUCTS;
    const newP = { ...productData, id: 'prod-' + Date.now().toString(36), created_at: new Date().toISOString() };
    items.unshift(newP);
    localStorage.setItem('archshop_mock_products', JSON.stringify(items));
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
      return data?.[0] || { id, ...cleanUpdates };
    }
    const local = localStorage.getItem('archshop_mock_products');
    let items = local ? JSON.parse(local) : MOCK_PRODUCTS;
    items = items.map(p => p.id === id ? { ...p, ...cleanUpdates } : p);
    localStorage.setItem('archshop_mock_products', JSON.stringify(items));
    return items.find(p => p.id === id);
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
      return true;
    }
    const local = localStorage.getItem('archshop_mock_products');
    let items = local ? JSON.parse(local) : MOCK_PRODUCTS;
    items = items.filter(p => p.id !== id);
    localStorage.setItem('archshop_mock_products', JSON.stringify(items));
    return true;
  },

  // Orders
  async submitOrder(orderData) {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('orders').insert([orderData]).select();
      if (error) {
        console.error('Supabase submitOrder error:', error);
        throw error;
      }
      return data?.[0] || orderData;
    }
    const local = localStorage.getItem('archshop_mock_orders');
    const orders = local ? JSON.parse(local) : MOCK_ORDERS;
    const newO = {
      ...orderData,
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
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('orders').select('*, products(*)').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    const local = localStorage.getItem('archshop_mock_orders');
    return local ? JSON.parse(local) : MOCK_ORDERS;
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
      o.id?.toLowerCase().includes(lower) ||
      o.student_id?.toLowerCase().includes(lower) ||
      o.phone_number?.includes(cleanTerm) ||
      o.full_name?.toLowerCase().includes(lower) ||
      o.email_or_line_id?.toLowerCase().includes(lower)
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
    const ext = file.name.split('.').pop();
    const name = `slip_${studentId}_${Date.now()}.${ext}`;

    if (isLiveSupabase && supabase) {
      const { error } = await supabase.storage.from('payment-slips').upload(name, file);
      if (!error) {
        const { data } = supabase.storage.from('payment-slips').getPublicUrl(name);
        return data.publicUrl;
      }
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
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
      return supabase
        .channel('realtime-orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, p => onInsert && onInsert(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, p => onUpdate && onUpdate(p.new))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, p => onDelete && onDelete(p.old))
        .subscribe();
    }
    const handler = (e) => onInsert && onInsert(e.detail);
    window.addEventListener('arch_order_created', handler);
    return { unsubscribe: () => window.removeEventListener('arch_order_created', handler) };
  }
};
