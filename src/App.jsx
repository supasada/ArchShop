import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StoreView from './views/StoreView';
import AdminView from './views/AdminView';
import ProductSelectModal from './components/ProductSelectModal';
import CartModal from './components/CartModal';
import ReceiptModal from './components/ReceiptModal';
import TrackingModal from './components/TrackingModal';
import SizeChartModal from './components/SizeChartModal';
import { api } from './config/supabase';
import { LanguageProvider } from './context/LanguageContext';
import { CartProvider, useCart } from './context/CartContext';

function ToastNotifier({ onOpenCart }) {
  const { toastMessage, setToastMessage } = useCart();
  const { t } = useLanguage();
  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-5 right-4 sm:right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-zinc-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-zinc-700 flex items-center gap-3 text-xs sm:text-sm font-bold">
        <span>{toastMessage}</span>
        <button
          type="button"
          onClick={() => {
            setToastMessage(null);
            onOpenCart();
          }}
          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-mono font-bold rounded-lg transition-colors shrink-0"
        >
          {t.viewCartBtn || 'ดูตะกร้า ↗'}
        </button>
      </div>
    </div>
  );
}


function MainApp() {
  const [isAdminView, setIsAdminView] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false);

  const loadProducts = async () => {
    try {
      const data = await api.getProducts(false);
      const safeList = Array.isArray(data) ? data : [];
      setProducts(safeList);

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

    const sub = api.subscribeProducts(() => {
      loadProducts();
    });

    const intervalId = setInterval(() => {
      loadProducts();
    }, 5000);

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
    setIsCartOpen(false);
    setCompletedOrder(order);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbfc] text-[#0d0e12] font-thai">
      
      {/* Navigation */}
      <Navbar
        isAdminView={isAdminView}
        onToggleAdmin={() => setIsAdminView(!isAdminView)}
        onOpenTracking={() => setIsTrackingOpen(true)}
        onOpenCart={() => setIsCartOpen(true)}
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

      {/* Toast Notification */}
      <ToastNotifier onOpenCart={() => setIsCartOpen(true)} />

      {/* Product Options Modal (Add to Cart / Buy Now) */}
      {selectedProduct && (
        <ProductSelectModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onOpenSizeChart={() => setIsSizeChartOpen(true)}
          onOpenCart={() => setIsCartOpen(true)}
        />
      )}

      {/* Shopping Cart & Checkout Modal */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onSuccess={handleOrderSuccess}
        onOpenSizeChart={() => setIsSizeChartOpen(true)}
      />

      {/* Official Printable Receipt Modal */}
      {completedOrder && (
        <ReceiptModal
          order={completedOrder}
          product={selectedProduct}
          onClose={() => setCompletedOrder(null)}
        />
      )}

      {/* Tracking Modal */}
      <TrackingModal
        isOpen={isTrackingOpen}
        onClose={() => setIsTrackingOpen(false)}
      />

      {/* Size Chart Modal */}
      <SizeChartModal
        isOpen={isSizeChartOpen}
        onClose={() => setIsSizeChartOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <CartProvider>
        <MainApp />
      </CartProvider>
    </LanguageProvider>
  );
}

