import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StoreView from './views/StoreView';
import AdminView from './views/AdminView';
import OrderModal from './components/OrderModal';
import ReceiptModal from './components/ReceiptModal';
import TrackingModal from './components/TrackingModal';
import SizeChartModal from './components/SizeChartModal';
import { api } from './config/supabase';

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
      setLoading(true);
      const data = await api.getProducts(true);
      setProducts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleOrderSuccess = (order, product) => {
    setSelectedProduct(null);
    setCompletedOrder(order);
  };

  return (
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
      <footer className="bg-white border-t border-zinc-200 py-8 text-center text-xs text-zinc-500 font-mono">
        <p>© 2026 Faculty of Architecture Student Club. Real-time powered by Supabase.</p>
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
  );
}
