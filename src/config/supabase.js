/**
 * Supabase Client Initializer (src/config/supabase.js)
 */

import { createClient } from '@supabase/supabase-js';
import { compressImage } from '../utils/imageCompress';
import { scopeRefsFromPayload, scopeRowsFromRefs } from '../utils/promotionRefs';
import { sanitizeOrderItems, appendPersonalizationNote, isMissingOrderItemsColumn } from '../utils/personalization';
import { FULFILLMENT_STATUSES, chunkIds } from '../utils/fulfillment';
import { ORDER_SELECT, ORDER_FALLBACK_SELECT } from '../utils/orderRealtime';
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
      let items = local ? JSON.parse(local) : MOCK_PRODUCTS;
      if (Array.isArray(items)) {
        items = items.map(p => (p.price === 350 || p.price === 380 ? { ...p, price: 219 } : p));
      }
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
      'image_front_url', 'image_back_url', 'is_active', 'order_deadline',
      'show_promo_badge', 'show_size_chart', 'allow_personalization', 'production_note',
      'size_stock_limits'
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
      product_variant_id: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(orderData.product_variant_id || '')) ? orderData.product_variant_id : null,
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
    // Structured cart lines (incl. jersey name/number). Customer-written: validated and bounded.
    const orderItems = sanitizeOrderItems(orderData.order_items);
    if (orderItems.length > 0) cleanOrder.order_items = orderItems;

    if (isLiveSupabase && supabase) {
      try {
        let { data, error } = await supabase.from('orders').insert([cleanOrder]).select();
        if (!error && data?.[0]) {
          return data[0];
        }
        if (error && cleanOrder.order_items && isMissingOrderItemsColumn(error)) {
          // Migration 0012 not run yet: save without the column, and keep the
          // names/numbers readable in the free-text part of notes so nothing is lost.
          console.warn('Supabase submitOrder notice (orders.order_items missing, retrying without it):', error);
          delete cleanOrder.order_items;
          cleanOrder.notes = appendPersonalizationNote(cleanOrder.notes, orderItems);
          ({ data, error } = await supabase.from('orders').insert([cleanOrder]).select());
          if (!error && data?.[0]) {
            return data[0];
          }
        }
        if (error) {
          console.warn('Supabase submitOrder notice (attempting retry without product_id/product_variant_id):', error);
          // If foreign key constraint or unknown-column failure occurred on product_id
          // and/or product_variant_id (e.g. migration 0002 not yet applied), retry
          // without both so a pre-migration database still gets the order recorded.
          if (cleanOrder.product_id || cleanOrder.product_variant_id) {
            cleanOrder.product_id = null;
            cleanOrder.product_variant_id = null;
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
        // Explicit columns + 3 product fields (was '*, products(*)'). If a column is missing
        // because a migration (0004/0012/0014) has not been run, PostgREST rejects the
        // whole select: retry with '*' (still the light product join) instead of showing nothing.
        let { data, error } = await supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false });
        if (error) {
          console.warn('Supabase getAllOrders notice (retrying with *; run pending migrations):', error);
          ({ data, error } = await supabase.from('orders').select(ORDER_FALLBACK_SELECT).order('created_at', { ascending: false }));
        }
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
      'product_id', 'product_variant_id', 'full_name', 'student_id', 'year_of_study', 'major',
      'phone_number', 'email_or_line_id', 'color', 'size', 'quantity',
      'total_price', 'payment_slip_url', 'delivery_method', 'shipping_address',
      'notes', 'payment_status', 'tracking_number', 'fulfillment_status'
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

  // Set fulfillment_status on many orders: one UPDATE ... WHERE id IN (...) per 200 ids
  // (not one request per order). Returns the number of ids sent.
  async bulkUpdateFulfillment(ids, status) {
    if (!FULFILLMENT_STATUSES.includes(status)) throw new Error('สถานะไม่ถูกต้อง: ' + status);
    const list = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
    if (list.length === 0) return 0;

    if (isLiveSupabase && supabase) {
      for (const chunk of chunkIds(list, 200)) {
        const { error } = await supabase.from('orders').update({ fulfillment_status: status }).in('id', chunk);
        if (error) {
          console.error('Supabase bulkUpdateFulfillment error:', error);
          throw error;
        }
      }
      return list.length;
    }
    const local = localStorage.getItem('archshop_mock_orders');
    let orders = local ? JSON.parse(local) : MOCK_ORDERS;
    const idSet = new Set(list);
    orders = orders.map(o => idSet.has(o.id) ? { ...o, fulfillment_status: status } : o);
    localStorage.setItem('archshop_mock_orders', JSON.stringify(orders));
    return list.length;
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
    file = await compressImage(file);
    const cleanId = String(studentId || 'std').replace(/[^a-zA-Z0-9]/g, '');
    const ext = (file.name || 'slip.jpg').split('.').pop() || 'jpg';
    const name = `slip_${cleanId}_${Date.now()}.${ext}`;

    if (isLiveSupabase && supabase) {
      try {
        const { error } = await supabase.storage.from('payment-slips').upload(name, file, {
          // File name is unique per upload, so the content never changes
          cacheControl: '31536000',
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
    file = await compressImage(file);
    const ext = file.name.split('.').pop();
    const name = `prod_${side}_${Date.now()}.${ext}`;

    if (isLiveSupabase && supabase) {
      const { error } = await supabase.storage.from('product-images').upload(name, file, { cacheControl: '31536000' });
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
  // Handlers get (row, payload): row = payload.new (INSERT/UPDATE) or payload.old (DELETE);
  // payload.errors is set when Realtime could not send the full record.
  subscribeOrders(onInsert, onUpdate, onDelete) {
    if (isLiveSupabase && supabase) {
      const channel = supabase
        .channel('realtime-orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, p => onInsert && onInsert(p.new, p))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, p => onUpdate && onUpdate(p.new, p))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, p => onDelete && onDelete(p.old, p))
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
  },

  // Generic realtime subscription for any table with realtime enabled
  // (promotions, product_variants, product_variant_images, ...).
  subscribeTable(tableName, onChange) {
    if (isLiveSupabase && supabase) {
      const channelName = `realtime-${tableName}-${Math.random().toString(36).slice(2)}`;
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
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
    return { unsubscribe: () => {} };
  },

  // Stock (migration 0015)
  // Aggregated units ordered per (product_id, variant_id, size) over non-rejected orders —
  // counts only, no personal data. One RPC returns every row (tiny payload).
  // Returns null when unavailable (function missing / offline / mock mode): callers then
  // treat everything as unlimited. Enforcement is client-side and NOT transactional
  // (see src/utils/stock.js).
  async getSoldCounts() {
    if (!isLiveSupabase || !supabase) return null;
    try {
      const { data, error } = await supabase.rpc('get_sold_counts');
      if (error) {
        console.warn('Supabase getSoldCounts notice (stock limits not enforced; run migration 0015):', error);
        return null;
      }
      return Array.isArray(data) ? data : null;
    } catch (err) {
      console.warn('getSoldCounts notice:', err);
      return null;
    }
  },

  // Fresh limits for the pre-submit check: one query for products, one for variants.
  // Returns null on any error (the check is then skipped).
  async getStockLimits(productIds, variantIds) {
    if (!isLiveSupabase || !supabase) return null;
    const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const pids = [...new Set((productIds || []).filter((id) => uuid.test(String(id || ''))))];
    const vids = [...new Set((variantIds || []).filter((id) => uuid.test(String(id || ''))))];
    try {
      const [prodRes, varRes] = await Promise.all([
        pids.length > 0
          ? supabase.from('products').select('id, name, size_stock_limits').in('id', pids)
          : Promise.resolve({ data: [], error: null }),
        vids.length > 0
          ? supabase.from('product_variants').select('id, product_id, name, stock_limit, size_stock_limits').in('id', vids)
          : Promise.resolve({ data: [], error: null })
      ]);
      if (prodRes.error || varRes.error) {
        console.warn('Supabase getStockLimits notice:', prodRes.error || varRes.error);
        return null;
      }
      return { products: prodRes.data || [], variants: varRes.data || [] };
    } catch (err) {
      console.warn('getStockLimits notice:', err);
      return null;
    }
  },

  // Product Variants
  async getVariants(productId) {
    if (!productId) return [];
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*, product_variant_images(*)')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });
      if (error) {
        console.warn('Supabase getVariants notice:', error);
        return [];
      }
      return (data || []).map((v) => ({
        ...v,
        images: (v.product_variant_images || []).sort((a, b) => a.sort_order - b.sort_order)
      }));
    }
    return [];
  },

  // Every variant in one query (light columns only), for pickers that list all products
  async getAllVariants() {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, product_id, name, price, is_active, sort_order')
        .order('sort_order', { ascending: true });
      if (error) {
        console.warn('Supabase getAllVariants notice:', error);
        return [];
      }
      return data || [];
    }
    return [];
  },

  async createVariant(variantData) {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('product_variants').insert([variantData]).select();
      if (error) {
        console.error('Supabase createVariant error:', error);
        throw error;
      }
      return data?.[0];
    }
    throw new Error('Variants require a live Supabase connection.');
  },

  async updateVariant(id, updates) {
    const allowedCols = ['name', 'price', 'available_sizes', 'available_colors', 'stock_limit', 'size_stock_limits', 'is_active', 'sort_order'];
    const cleanUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedCols.includes(key)) cleanUpdates[key] = updates[key];
    });
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('product_variants').update(cleanUpdates).eq('id', id).select();
      if (error) {
        console.error('Supabase updateVariant error:', error);
        throw error;
      }
      return data?.[0];
    }
    throw new Error('Variants require a live Supabase connection.');
  },

  async deleteVariant(id) {
    if (isLiveSupabase && supabase) {
      const { error } = await supabase.from('product_variants').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    throw new Error('Variants require a live Supabase connection.');
  },

  async addVariantImage(variantId, imageUrl, sortOrder = 0) {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase
        .from('product_variant_images')
        .insert([{ variant_id: variantId, image_url: imageUrl, sort_order: sortOrder }])
        .select();
      if (error) throw error;
      return data?.[0];
    }
    throw new Error('Variant images require a live Supabase connection.');
  },

  async deleteVariantImage(imageId) {
    if (isLiveSupabase && supabase) {
      const { error } = await supabase.from('product_variant_images').delete().eq('id', imageId);
      if (error) throw error;
      return true;
    }
    throw new Error('Variant images require a live Supabase connection.');
  },

  // Product gallery (extra images after front/back). Fetched only when the product modal opens.
  // Returns [] on error, e.g. before migration 0013 is run.
  async getProductImages(productId) {
    if (!productId) return [];
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase
        .from('product_images')
        .select('id, image_url, sort_order')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });
      if (error) {
        console.warn('Supabase getProductImages notice:', error);
        return [];
      }
      return data || [];
    }
    return [];
  },

  async addProductImage(productId, imageUrl, sortOrder = 0) {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase
        .from('product_images')
        .insert([{ product_id: productId, image_url: imageUrl, sort_order: sortOrder }])
        .select('id, image_url, sort_order');
      if (error) throw error;
      return data?.[0];
    }
    throw new Error('Product images require a live Supabase connection.');
  },

  async deleteProductImage(imageId) {
    if (isLiveSupabase && supabase) {
      const { error } = await supabase.from('product_images').delete().eq('id', imageId);
      if (error) throw error;
      return true;
    }
    throw new Error('Product images require a live Supabase connection.');
  },

  // images: [{id, sort_order}] — writes each row's sort_order
  async reorderProductImages(images) {
    if (isLiveSupabase && supabase) {
      const results = await Promise.all(
        (images || []).map((img) =>
          supabase.from('product_images').update({ sort_order: img.sort_order }).eq('id', img.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;
      return true;
    }
    throw new Error('Product images require a live Supabase connection.');
  },

  // Promotions
  async getPromotions() {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase
        .from('promotions')
        .select('*, promotion_scope_variants(*), promotion_bundle_items(*)')
        .order('priority', { ascending: true });
      if (error) {
        console.warn('Supabase getPromotions notice:', error);
        return [];
      }
      return (data || []).map((p) => ({
        ...p,
        scope_variants: p.promotion_scope_variants || [],
        bundle_items: p.promotion_bundle_items || []
      }));
    }
    return [];
  },

  async createPromotion(promotionData) {
    if (!isLiveSupabase || !supabase) throw new Error('Promotions require a live Supabase connection.');
    const { scope_refs, scope_variant_ids, bundle_items, ...promoFields } = promotionData;
    const scopeRefs = scopeRefsFromPayload({ scope_refs, scope_variant_ids });
    const { data, error } = await supabase.from('promotions').insert([promoFields]).select();
    if (error) {
      console.error('Supabase createPromotion error:', error);
      throw error;
    }
    const promo = data?.[0];
    if (scopeRefs && scopeRefs.length > 0) {
      await supabase.from('promotion_scope_variants').insert(scopeRowsFromRefs(promo.id, scopeRefs));
    }
    if (Array.isArray(bundle_items) && bundle_items.length > 0) {
      await supabase.from('promotion_bundle_items').insert(
        bundle_items.map((bi) => ({
          promotion_id: promo.id,
          variant_id: bi.variant_id || null,
          product_id: bi.product_id || null,
          slot: bi.slot ?? null,
          required_qty: bi.required_qty || 1
        }))
      );
    }
    return promo;
  },

  async updatePromotion(id, updates) {
    if (!isLiveSupabase || !supabase) throw new Error('Promotions require a live Supabase connection.');
    const allowedCols = [
      'name', 'type', 'is_active', 'priority', 'applies_to_all',
      'quantity', 'bundle_price', 'discount_type', 'discount_value'
    ];
    const { scope_refs, scope_variant_ids, bundle_items, ...rest } = updates;
    const scopeRefs = scopeRefsFromPayload({ scope_refs, scope_variant_ids });
    const cleanUpdates = {};
    Object.keys(rest).forEach((key) => {
      if (allowedCols.includes(key)) cleanUpdates[key] = rest[key];
    });
    const { data, error } = await supabase.from('promotions').update(cleanUpdates).eq('id', id).select();
    if (error) {
      console.error('Supabase updatePromotion error:', error);
      throw error;
    }
    if (scopeRefs) {
      await supabase.from('promotion_scope_variants').delete().eq('promotion_id', id);
      if (scopeRefs.length > 0) {
        await supabase.from('promotion_scope_variants').insert(scopeRowsFromRefs(id, scopeRefs));
      }
    }
    if (Array.isArray(bundle_items)) {
      await supabase.from('promotion_bundle_items').delete().eq('promotion_id', id);
      if (bundle_items.length > 0) {
        await supabase.from('promotion_bundle_items').insert(
          bundle_items.map((bi) => ({
            promotion_id: id,
            variant_id: bi.variant_id || null,
            product_id: bi.product_id || null,
            slot: bi.slot ?? null,
            required_qty: bi.required_qty || 1
          }))
        );
      }
    }
    return data?.[0];
  },

  async deletePromotion(id) {
    if (isLiveSupabase && supabase) {
      const { error } = await supabase.from('promotions').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    throw new Error('Promotions require a live Supabase connection.');
  },

  // Per-Variant Size Rows
  async getVariantSizeRows(variantId) {
    if (!variantId) return [];
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase
        .from('variant_size_rows')
        .select('*')
        .eq('variant_id', variantId)
        .order('sort_order', { ascending: true });
      if (error) {
        console.warn('Supabase getVariantSizeRows notice:', error);
        return [];
      }
      return data || [];
    }
    return [];
  },

  // Size rows for several variants in one query (product modal), grouped by variant_id.
  // Every requested id gets an entry ([] when it has no rows or on error).
  async getVariantSizeRowsForVariants(variantIds) {
    const ids = [...new Set((variantIds || []).filter(Boolean))];
    const grouped = Object.fromEntries(ids.map((id) => [id, []]));
    if (ids.length === 0 || !isLiveSupabase || !supabase) return grouped;
    const { data, error } = await supabase
      .from('variant_size_rows')
      .select('*')
      .in('variant_id', ids)
      .order('sort_order', { ascending: true });
    if (error) {
      console.warn('Supabase getVariantSizeRowsForVariants notice:', error);
      return grouped;
    }
    (data || []).forEach((row) => {
      if (grouped[row.variant_id]) grouped[row.variant_id].push(row);
    });
    return grouped;
  },

  async createVariantSizeRow(rowData) {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('variant_size_rows').insert([rowData]).select();
      if (error) {
        console.error('Supabase createVariantSizeRow error:', error);
        throw error;
      }
      return data?.[0];
    }
    throw new Error('Variant size rows require a live Supabase connection.');
  },

  async updateVariantSizeRow(id, updates) {
    const allowedCols = ['size_label', 'attributes', 'sort_order'];
    const cleanUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedCols.includes(key)) cleanUpdates[key] = updates[key];
    });
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('variant_size_rows').update(cleanUpdates).eq('id', id).select();
      if (error) {
        console.error('Supabase updateVariantSizeRow error:', error);
        throw error;
      }
      return data?.[0];
    }
    throw new Error('Variant size rows require a live Supabase connection.');
  },

  async deleteVariantSizeRow(id) {
    if (isLiveSupabase && supabase) {
      const { error } = await supabase.from('variant_size_rows').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    throw new Error('Variant size rows require a live Supabase connection.');
  },

  // Countdown Events
  async getCountdownEvents() {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase
        .from('countdown_events')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) {
        console.warn('Supabase getCountdownEvents notice:', error);
        return [];
      }
      return data || [];
    }
    return [];
  },

  async createCountdownEvent(eventData) {
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('countdown_events').insert([eventData]).select();
      if (error) {
        console.error('Supabase createCountdownEvent error:', error);
        throw error;
      }
      return data?.[0];
    }
    throw new Error('Countdown events require a live Supabase connection.');
  },

  async updateCountdownEvent(id, updates) {
    const allowedCols = ['title', 'target_at', 'is_active', 'sort_order'];
    const cleanUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedCols.includes(key)) cleanUpdates[key] = updates[key];
    });
    if (isLiveSupabase && supabase) {
      const { data, error } = await supabase.from('countdown_events').update(cleanUpdates).eq('id', id).select();
      if (error) {
        console.error('Supabase updateCountdownEvent error:', error);
        throw error;
      }
      return data?.[0];
    }
    throw new Error('Countdown events require a live Supabase connection.');
  },

  async deleteCountdownEvent(id) {
    if (isLiveSupabase && supabase) {
      const { error } = await supabase.from('countdown_events').delete().eq('id', id);
      if (error) throw error;
      return true;
    }
    throw new Error('Countdown events require a live Supabase connection.');
  }
};
