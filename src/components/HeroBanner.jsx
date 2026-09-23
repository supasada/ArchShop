import React, { useState, useEffect, useCallback } from 'react';
import { STORE_CONFIG } from '../config/storeConfig';
import { formatDateThai, describePromotion } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';

export default function HeroBanner({ products }) {
  const { t, lang } = useLanguage();
  const { promotions } = useCart();
  const activePromos = promotions.filter((p) => p.is_active);
  const [promoIndex, setPromoIndex] = useState(0);
  const activePromo = activePromos.length > 0 ? activePromos[promoIndex % activePromos.length] : null;
  const [timeLeft, setTimeLeft] = useState(null);
  const [targetDate, setTargetDate] = useState(null);

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

  // Compute the active target date
  const computeTarget = useCallback(() => {
    // 1. Check if configured in localStorage
    const savedDeadline = localStorage.getItem('arch_custom_deadline');
    if (savedDeadline) {
      const d = new Date(savedDeadline);
      if (!isNaN(d.getTime())) return d;
    }

    // 2. Check active products from Supabase / mock data
    if (products && products.length > 0) {
      const activeProds = products.filter(p => p.is_active !== false);
      if (activeProds.length === 0) {
        // All products explicitly closed
        return new Date(Date.now() - 1000);
      }
      const valid = activeProds
        .filter(p => p.order_deadline)
        .map(p => new Date(p.order_deadline))
        .filter(d => !isNaN(d.getTime()));
      if (valid.length > 0) {
        return new Date(Math.min(...valid));
      }
    }

    // 3. Fallback to store configuration default
    return new Date(STORE_CONFIG.faculty.defaultDeadline || '2026-08-31T23:59:59');
  }, [products]);

  useEffect(() => {
    const target = computeTarget();
    setTargetDate(target);
  }, [computeTarget]);

  // Listen for storage events (e.g. when admin changes deadline in Admin Panel)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'arch_custom_deadline') {
        const target = computeTarget();
        setTargetDate(target);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [computeTarget]);

  // Update countdown timer every second
  useEffect(() => {
    if (!targetDate) return;

    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const formattedDate = targetDate && !isNaN(targetDate.getTime()) 
    ? (lang === 'th' 
        ? formatDateThai(targetDate.toISOString()) 
        : targetDate.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
          }))
    : null;

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

        {/* Countdown Box */}
        <div className="mt-8 sm:mt-10 p-4 sm:p-6 bg-zinc-900 text-white rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6 border border-zinc-800 relative group">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span>{t.countdownTag}</span>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-base sm:text-xl font-bold tracking-tight">
                {t.countdownTitle}
              </h3>
            </div>

            <p className="text-xs text-amber-400/90 font-mono flex items-center gap-1.5 flex-wrap">
              <span>{formattedDate ? `${t.deadlinePrefix} ${formattedDate}` : ''}</span>
            </p>
          </div>

          <div className="w-full md:w-auto font-mono">
            {timeLeft ? (
              <div className="grid grid-cols-4 gap-1.5 xs:gap-2 sm:gap-3 max-w-sm sm:max-w-none">
                <div className="flex flex-col items-center justify-center bg-zinc-800/90 px-2 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-zinc-700">
                  <span className="text-lg xs:text-xl sm:text-2xl font-black text-white leading-none">{String(timeLeft.days).padStart(2, '0')}</span>
                  <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-zinc-400 uppercase mt-1">{t.daysUpper}</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-800/90 px-2 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-zinc-700">
                  <span className="text-lg xs:text-xl sm:text-2xl font-black text-white leading-none">{String(timeLeft.hours).padStart(2, '0')}</span>
                  <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-zinc-400 uppercase mt-1">{t.hoursUpper}</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-800/90 px-2 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-zinc-700">
                  <span className="text-lg xs:text-xl sm:text-2xl font-black text-white leading-none">{String(timeLeft.minutes).padStart(2, '0')}</span>
                  <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-zinc-400 uppercase mt-1">{t.minsUpper}</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-800/90 px-2 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-zinc-700">
                  <span className="text-lg xs:text-xl sm:text-2xl font-black text-amber-400 leading-none">{String(timeLeft.seconds).padStart(2, '0')}</span>
                  <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-zinc-400 uppercase mt-1">{t.secsUpper}</span>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                <span>{t.closedNotice}</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}

