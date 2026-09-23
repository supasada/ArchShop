import React, { useState, useEffect } from 'react';
import { describePromotion } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import CountdownEventsRow from './CountdownEventsRow';

export default function HeroBanner() {
  const { t } = useLanguage();
  const { promotions } = useCart();
  const activePromos = promotions.filter((p) => p.is_active);
  const [promoIndex, setPromoIndex] = useState(0);
  const activePromo = activePromos.length > 0 ? activePromos[promoIndex % activePromos.length] : null;

  // Cycle through every active promotion instead of always showing only the first one
  useEffect(() => {
    setPromoIndex(0);
  }, [promotions]);

  useEffect(() => {
    if (activePromos.length <= 1) return;
    const timer = setInterval(() => {
      setPromoIndex((i) => (i + 1) % activePromos.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [activePromos.length]);

  return (
    <section className="relative overflow-hidden bg-white border-b border-zinc-200 py-12 sm:py-16 md:py-20">
      <div className="absolute inset-0 opacity-40 mix-blend-multiply pointer-events-none bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl">
          
          <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 text-white rounded-md text-xs font-mono shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>{t.officialMerch}</span>
            </div>
            {activePromo && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 rounded-md text-xs font-mono font-black shadow-sm animate-pulse">
                <span key={activePromo.id}>{describePromotion(activePromo)}</span>
              </div>
            )}
          </div>

          <h1 className="font-display font-extrabold text-2xl xs:text-3xl sm:text-5xl lg:text-6xl text-zinc-950 tracking-tight leading-[1.1]">
            {t.heroTitle1} <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500">{t.heroTitle2}</span>
          </h1>

        </div>

        <CountdownEventsRow />

      </div>
    </section>
  );
}

