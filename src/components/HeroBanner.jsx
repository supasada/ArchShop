import React, { useState, useEffect, useCallback } from 'react';
import { STORE_CONFIG } from '../config/storeConfig';
import { formatDateThai } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';
import DeadlineModal from './DeadlineModal';

export default function HeroBanner({ products }) {
  const { t, lang } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(null);
  const [targetDate, setTargetDate] = useState(null);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);

  // Compute the active target date
  const computeTarget = useCallback(() => {
    // 1. Check if user configured a global deadline in localStorage
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

  // Initialize or re-sync target date when products change
  useEffect(() => {
    const target = computeTarget();
    setTargetDate(target);
  }, [computeTarget]);

  // Listen to global deadline update events
  useEffect(() => {
    const handleDeadlineUpdate = (e) => {
      if (e.detail) {
        const newTarget = new Date(e.detail);
        if (!isNaN(newTarget.getTime())) {
          setTargetDate(newTarget);
        }
      }
    };

    window.addEventListener('arch_deadline_updated', handleDeadlineUpdate);
    return () => {
      window.removeEventListener('arch_deadline_updated', handleDeadlineUpdate);
    };
  }, []);

  // Real-time countdown timer tick
  useEffect(() => {
    if (!targetDate) return;

    const updateCountdown = () => {
      const now = Date.now();
      const targetTime = targetDate.getTime();
      const distance = targetTime - now;

      if (distance <= 0) {
        setTimeLeft(null);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  const formattedDate = targetDate ? (
    lang === 'en' 
      ? targetDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : lang === 'zh'
      ? targetDate.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
      : formatDateThai(targetDate, true)
  ) : '';

  return (
    <section className="relative bg-blueprint border-b border-zinc-200 overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 text-white rounded-md text-xs font-mono mb-4 sm:mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>{t.officialMerch}</span>
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

              {/* Direct Quick Button to Edit Closing Time */}
              <button
                type="button"
                onClick={() => setIsDeadlineModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 hover:text-amber-200 border border-amber-400/40 rounded-lg text-xs font-mono font-bold transition-all active:scale-95 shadow-xs"
                title="คลิกเพื่อเปลี่ยนวันและเวลาปิดรับจอง"
              >
                <span>⏱️ ตั้งเวลาปิดรับจอง</span>
                <span className="text-[10px] opacity-75">✏️</span>
              </button>
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
              <div className="flex items-center gap-2">
                <div className="px-4 py-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                  <span>{t.closedNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeadlineModalOpen(true)}
                  className="px-3 py-3 bg-amber-400 text-zinc-950 hover:bg-amber-300 font-bold text-xs rounded-xl shadow transition-all whitespace-nowrap"
                  title="เปิดรับจองใหม่"
                >
                  ⚡ เปิดรับจองใหม่
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Deadline Setting Modal */}
      <DeadlineModal
        isOpen={isDeadlineModalOpen}
        onClose={() => setIsDeadlineModalOpen(false)}
        products={products}
        onDeadlineSaved={(iso) => setTargetDate(new Date(iso))}
      />
    </section>
  );
}

