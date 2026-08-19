import React from 'react';
import HeroBanner from '../components/HeroBanner';
import ProductCard from '../components/ProductCard';
import { STORE_CONFIG } from '../config/storeConfig';

export default function StoreView({ products, loading, onSelectProduct, onOpenSizeChart }) {
  return (
    <div>
      <HeroBanner products={products} />

      {/* Catalog Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 pb-4 border-b border-zinc-200">
          <div>
            <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">AVAILABLE DESIGNS</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight mt-1">
              รายการเสื้อเปิดรับจอง (Pre-Order Products)
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenSizeChart}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg shadow-xs"
          >
            <span>ตารางขนาดไซส์ (Size Chart)</span>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="h-96 bg-zinc-100 rounded-2xl animate-pulse"></div>
            <div className="h-96 bg-zinc-100 rounded-2xl animate-pulse"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOrderClick={onSelectProduct}
              />
            ))}
          </div>
        )}
      </section>

      {/* Faculty Info Section */}
      <section className="bg-zinc-100 border-t border-zinc-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-white rounded-xl border border-zinc-200 shadow-xs">
              <h4 className="font-bold text-zinc-900 text-sm">สถานที่รับเสื้อด้วยตนเอง</h4>
              <p className="text-xs text-zinc-600 mt-2 leading-relaxed">{STORE_CONFIG.faculty.pickupLocation}</p>
              <p className="text-[11px] text-zinc-400 mt-1 font-mono">{STORE_CONFIG.faculty.pickupHours}</p>
            </div>

            <div className="p-6 bg-white rounded-xl border border-zinc-200 shadow-xs">
              <h4 className="font-bold text-zinc-900 text-sm">บัญชีทางการสโมสรนักศึกษา</h4>
              <p className="text-xs text-zinc-600 mt-2 font-mono">
                <strong>{STORE_CONFIG.payment.bankName}:</strong> {STORE_CONFIG.payment.bankAccountNo}
              </p>
              <p className="text-xs text-zinc-600 font-mono mt-0.5">
                PromptPay: {STORE_CONFIG.payment.promptpayNumber}
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border border-zinc-200 shadow-xs">
              <h4 className="font-bold text-zinc-900 text-sm">ติดต่อสอบถามฝ่ายกิจกรรม</h4>
              <p className="text-xs text-zinc-600 mt-2 font-mono">LINE: {STORE_CONFIG.faculty.lineOfficial}</p>
              <p className="text-xs text-zinc-600 font-mono mt-0.5">โทรศัพท์: {STORE_CONFIG.faculty.phone}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
