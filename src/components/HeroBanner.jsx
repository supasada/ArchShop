import React, { useState, useEffect } from 'react';
import { STORE_CONFIG } from '../config/storeConfig';
import { formatDateThai } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';

export default function HeroBanner({ products }) {
  const { t, lang } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(null);
  const [targetDate, setTargetDate] = useState(null);

  useEffect(() => {
    // Determine the active deadline target
    const computeTarget = () => {
      // 1. Check if user configured a global deadline in localStorage
      const savedDeadline = localStorage.getItem('arch_custom_deadline');
      if (savedDeadline) {
        const d = new Date(savedDeadline);
        if (!isNaN(d.getTime())) return d;
      }

      // 2. Check active products from Supabase
      if (products && products.length > 0) {
        const valid = products
          .filter(p => p.order_deadline)
          .map(p => new Date(p.order_deadline))
          .filter(d => !isNaN(d.getTime()));
        if (valid.length > 0) {
          return new Date(Math.min(...valid));
        }
      }

      // 3. Fallback to store configuration default
      return new Date(STORE_CONFIG.faculty.defaultDeadline || '2026-08-31T23:59:59');
    };

    const target = computeTarget();
    setTargetDate(target);

    const updateCountdown = () => {
      const now = new Date().getTime();
      const targetTime = target.getTime();
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
      clearInterval(interval);
      window.removeEventListener('arch_deadline_updated', handleDeadlineUpdate);
    };
  }, [products]);

  const formattedDate = targetDate ? (
    lang === 'en' 
      ? targetDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : lang === 'zh'
      ? targetDate.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
      : formatDateThai(targetDate, true)
  ) : '';

  return (
    <section className="relative bg-blueprint border-b border-zinc-200 overflow-hidden pt-12 pb-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 text-white rounded-md text-xs font-mono mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>{t.officialMerch}</span>
          </div>

          <h1 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-zinc-950 tracking-tight leading-[1.1]">
            {t.heroTitle1} <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500">{t.heroTitle2}</span>
          </h1>

        </div>

        {/* Countdown Box */}
        <div className="mt-10 p-5 sm:p-6 bg-zinc-900 text-white rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-zinc-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span>{t.countdownTag}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold mt-1 tracking-tight">
              {t.countdownTitle}
            </h3>
            <p className="text-xs text-amber-400/90 mt-1 font-mono">
              {formattedDate ? `${t.deadlinePrefix} ${formattedDate}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 font-mono">
            {timeLeft ? (
              <>
                <div className="flex flex-col items-center bg-zinc-800/80 px-3.5 py-2 rounded-xl border border-zinc-700 min-w-[60px]">
                  <span className="text-xl sm:text-2xl font-bold text-white">{String(timeLeft.days).padStart(2, '0')}</span>
                  <span className="text-[10px] text-zinc-400 uppercase">{t.daysUpper}</span>
                </div>
                <span className="text-zinc-600 text-xl font-bold">:</span>
                <div className="flex flex-col items-center bg-zinc-800/80 px-3.5 py-2 rounded-xl border border-zinc-700 min-w-[60px]">
                  <span className="text-xl sm:text-2xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
                  <span className="text-[10px] text-zinc-400 uppercase">{t.hoursUpper}</span>
                </div>
                <span className="text-zinc-600 text-xl font-bold">:</span>
                <div className="flex flex-col items-center bg-zinc-800/80 px-3.5 py-2 rounded-xl border border-zinc-700 min-w-[60px]">
                  <span className="text-xl sm:text-2xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
                  <span className="text-[10px] text-zinc-400 uppercase">{t.minsUpper}</span>
                </div>
                <span className="text-zinc-600 text-xl font-bold">:</span>
                <div className="flex flex-col items-center bg-zinc-800/80 px-3.5 py-2 rounded-xl border border-zinc-700 min-w-[60px]">
                  <span className="text-xl sm:text-2xl font-bold text-amber-400">{String(timeLeft.seconds).padStart(2, '0')}</span>
                  <span className="text-[10px] text-zinc-400 uppercase">{t.secsUpper}</span>
                </div>
              </>
            ) : (
              <div className="px-4 py-2 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 font-bold text-xs flex items-center gap-2">
                <span>{t.closedNotice}</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
