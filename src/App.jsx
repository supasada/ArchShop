import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StoreView from './views/StoreView';
import AdminView from './views/AdminView';
import OrderModal from './components/OrderModal';
import ReceiptModal from './components/ReceiptModal';
import TrackingModal from './components/TrackingModal';
import SizeChartModal from './components/SizeChartModal';
import { api } from './config/supabase';
import { LanguageProvider } from './context/LanguageContext';

export default function App() {
  const [isAdminView, setIsAdminView] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false);

  const loadProducts = async () => {
    try {
      // Fetch all products (including status flags) so we can react in real-time
      const data = await api.getProducts(false);
      const safeList = Array.isArray(data) ? data : [];
      setProducts(safeList);

      // Keep active open modal synced with latest product status
      setSelectedProduct(prev => {
        if (!prev) return null;
        const fresh = safeList.find(p => p.id === prev.id);
        return fresh || prev;
      });
    } catch (err) {
      console.warn('loadProducts notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();

    // 1. Real-time WebSocket subscription for product updates & sales closing
    const sub = api.subscribeProducts(() => {
      loadProducts();
    });

    // 2. Fallback polling every 5 seconds to ensure 100% real-time sync across browsers
    const intervalId = setInterval(() => {
      loadProducts();
    }, 5000);

    // 3. Tab visibility / focus sync
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadProducts();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', loadProducts);

    return () => {
      if (sub?.unsubscribe) sub.unsubscribe();
      clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', loadProducts);
    };
  }, []);

  const handleOrderSuccess = (order, product) => {
    setSelectedProduct(null);
    setCompletedOrder(order);
  };

  return (
    <LanguageProvider>
      <div className="min-h-screen flex flex-col bg-[#fafbfc] text-[#0d0e12] font-thai">
        
        {/* Navigation */}
        <Navbar
          isAdminView={isAdminView}
          onToggleAdmin={() => setIsAdminView(!isAdminView)}
          onOpenTracking={() => setIsTrackingOpen(true)}
        />

        {/* Main View */}
        <main className="flex-1">
          {isAdminView ? (
            <AdminView onBackToStore={() => setIsAdminView(false)} />
          ) : (
            <StoreView
              products={products}
              loading={loading}
              onSelectProduct={(p) => setSelectedProduct(p)}
              onOpenSizeChart={() => setIsSizeChartOpen(true)}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-zinc-200 py-6 px-4 text-center text-xs text-zinc-600 font-mono space-y-2">
          <div className="font-bold text-zinc-800 tracking-tight flex items-center justify-center gap-2 flex-wrap">
            <span>smoarchcmu • Faculty of Architecture Chiang Mai University</span>
            <a
              href="https://www.instagram.com/smoarchcmu/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-pink-600 font-bold inline-flex items-center gap-1 transition-colors"
              title="Instagram @smoarchcmu"
            >
              <span>📸 @smoarchcmu</span>
            </a>
          </div>
          <div className="text-[11.5px] text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            📍 Faculty of Architecture Student Union Office, Chiang Mai University, Huay Kaew, Su Thep, Mueang, Chiang Mai, 50200
          </div>
        </footer>

        {/* Modals */}
        {selectedProduct && (
          <OrderModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onSuccess={handleOrderSuccess}
            onOpenSizeChart={() => setIsSizeChartOpen(true)}
          />
        )}

        {completedOrder && (
          <ReceiptModal
            order={completedOrder}
            product={selectedProduct}
            onClose={() => setCompletedOrder(null)}
          />
        )}

        <TrackingModal
          isOpen={isTrackingOpen}
          onClose={() => setIsTrackingOpen(false)}
        />

        <SizeChartModal
          isOpen={isSizeChartOpen}
          onClose={() => setIsSizeChartOpen(false)}
        />

      </div>
    </LanguageProvider>
  );
}
