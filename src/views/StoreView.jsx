import React from 'react';
import HeroBanner from '../components/HeroBanner';
import ProductCard from '../components/ProductCard';
import { STORE_CONFIG } from '../config/storeConfig';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';

export default function StoreView({ products, loading, onSelectProduct }) {
  const { t, lang } = useLanguage();
  const { promotions } = useCart();
  // De-duplicate by name so repeated promotions don't stack identical banners
  const seen = new Set();
  const promoCards = (promotions || [])
    .filter((p) => p.is_active)
    .filter((p) => (seen.has(p.name) ? false : seen.add(p.name)))
    .map((p) => {
      const money = (v) => Number(v).toLocaleString();
      if (p.type === 'quantity_break' && p.quantity && p.bundle_price) {
        return { ...p, big: `฿${money(p.bundle_price)}`, tag: `ซื้อ ${p.quantity} ชิ้น`, detail: `ซื้อครบ ${p.quantity} ชิ้น ราคาพิเศษ ${money(p.bundle_price)} บาท` };
      }
      if (p.type === 'bundle' && p.discount_value) {
        return p.discount_type === 'fixed_price'
          ? { ...p, big: `฿${money(p.discount_value)}`, tag: 'ซื้อคู่', detail: `ซื้อครบชุด ราคาชุดละ ${money(p.discount_value)} บาท` }
          : { ...p, big: `-฿${money(p.discount_value)}`, tag: 'ซื้อคู่', detail: `ซื้อครบชุด ลดทันที ${money(p.discount_value)} บาท` };
      }
      return { ...p, big: '🎁', tag: 'โปรโมชั่น', detail: '' };
    });

  return (
    <div>
      <HeroBanner />

      {promoCards.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8">
          <div className="flex items-center gap-2 mb-3 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-widest text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            โปรโมชั่นพิเศษ · SPECIAL OFFERS
          </div>
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            {promoCards.map((promo) => (
              <div
                key={promo.id}
                className="flex items-stretch overflow-hidden rounded-2xl bg-zinc-900 text-white shadow-lg border border-zinc-800"
              >
                <div className="shrink-0 w-28 sm:w-36 flex flex-col items-center justify-center px-2 py-4 bg-gradient-to-br from-amber-300 to-amber-500 text-zinc-950">
                  <span className="text-[10px] font-mono font-black uppercase tracking-wide">{promo.tag}</span>
                  <span className="text-2xl sm:text-3xl font-black leading-tight font-mono">{promo.big}</span>
                </div>
                <div className="min-w-0 flex-1 px-4 sm:px-5 py-4 flex flex-col justify-center border-l-2 border-dashed border-zinc-700">
                  <div className="text-base sm:text-xl font-black leading-snug tracking-tight break-words">{promo.name}</div>
                  {promo.detail && <div className="text-xs sm:text-sm font-mono text-amber-300/90 mt-1">{promo.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Catalog Section */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-6 sm:mb-10 pb-4 border-b border-zinc-200">
          <div>
            <div className="text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-wider">
              {t.availableDesigns || 'AVAILABLE DESIGNS'}
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight mt-0.5 sm:mt-1">
              {t.catalogHeaderTitle || 'รายการเสื้อเปิดรับจอง (Pre-Order Products)'}
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            <div className="h-80 sm:h-96 bg-zinc-100 rounded-2xl animate-pulse"></div>
            <div className="h-80 sm:h-96 bg-zinc-100 rounded-2xl animate-pulse"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
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
      <section className="bg-zinc-100/70 border-t border-zinc-200 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <div className="p-4 sm:p-6 bg-white rounded-2xl border border-zinc-200 shadow-xs">
              <h4 className="font-bold text-zinc-900 text-sm">{t.pickupCardTitle || '📍 สถานที่รับเสื้อด้วยตนเอง'}</h4>
              <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                {lang === 'th' ? STORE_CONFIG.faculty.pickupLocation : (t.pickupLocationText || STORE_CONFIG.faculty.pickupLocation)}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                {lang === 'th' ? STORE_CONFIG.faculty.pickupHours : (t.pickupHoursText || STORE_CONFIG.faculty.pickupHours)}
              </p>
            </div>

            <div className="p-4 sm:p-6 bg-white rounded-2xl border border-zinc-200 shadow-xs">
              <h4 className="font-bold text-zinc-900 text-sm">{t.bankCardTitle || '💳 บัญชีทางการสโมสรนักศึกษา'}</h4>
              <p className="text-xs text-zinc-600 mt-2 font-mono">
                <strong>{STORE_CONFIG.payment.bankName}:</strong> {STORE_CONFIG.payment.bankAccountNo}
              </p>
              <p className="text-xs text-zinc-600 font-mono mt-0.5">
                PromptPay: {STORE_CONFIG.payment.promptpayNumber}
              </p>
            </div>

            <div className="p-4 sm:p-6 bg-white rounded-2xl border border-zinc-200 shadow-xs sm:col-span-2 md:col-span-1 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="font-bold text-zinc-900 text-sm flex items-center gap-1.5">
                  <span>{t.inquiryCardTitle || '💬 ติดต่อสอบถาม'}</span>
                  <span className="text-[10px] font-mono text-zinc-400">smoarchcmu</span>
                </h4>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                  {t.inquiryCardDesc || 'หากมีข้อสงสัยเกี่ยวกับสินค้าหรือคำสั่งซื้อ สามารถทักสอบถามทีมงานสโมสรนักศึกษาได้โดยตรง'}
                </p>
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <a
                  href="https://www.instagram.com/smoarchcmu/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-xs active:scale-[0.98] transition-all"
                  title="เปิด Instagram @smoarchcmu"
                >
                  <span>{t.openInstagramBtn || '📸 Instagram: @smoarchcmu'}</span>
                  <span className="text-[11px]">↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
