import React, { useEffect, useState } from 'react';
import { api } from '../config/supabase';
import { formatDateThai } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';

function useTimeLeft(targetAt) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const target = new Date(targetAt).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetAt]);

  return timeLeft;
}

function CountdownEventCard({ event }) {
  const { t, lang } = useLanguage();
  const timeLeft = useTimeLeft(event.target_at);

  const formattedDate = lang === 'th'
    ? formatDateThai(event.target_at)
    : new Date(event.target_at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
      });

  return (
    <div className="mt-4 p-4 sm:p-6 bg-zinc-900 text-white rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6 border border-zinc-800">
      <div className="flex items-center gap-3 min-w-0">
        {event.image_url && (
          <img src={event.image_url} alt={event.title} className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-zinc-700 shrink-0" />
        )}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className={`w-2 h-2 rounded-full ${timeLeft ? 'bg-rose-500 animate-pulse' : 'bg-zinc-600'}`}></span>
            <span>{t.eventCountdownTag || 'EVENT COUNTDOWN'}</span>
          </div>
          <h3 className="text-base sm:text-xl font-bold tracking-tight truncate">{event.title}</h3>
          <p className="text-xs text-amber-400/90 font-mono">
            {t.eventDeadlinePrefix || '🎯 กำหนด:'} {formattedDate}
          </p>
        </div>
      </div>

      {!timeLeft ? (
        <div className="w-full md:w-auto px-4 py-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
          <span>{t.eventExpiredNotice || '🔴 หมดเวลาแล้ว'}</span>
        </div>
      ) : (
      <div className="w-full md:w-auto font-mono">
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
      </div>
      )}
    </div>
  );
}

export default function CountdownEventsRow() {
  const [events, setEvents] = useState([]);

  const reload = () => {
    api.getCountdownEvents().then((rows) => setEvents(rows.filter((e) => e.is_active))).catch(() => setEvents([]));
  };

  useEffect(() => {
    reload();
    const sub = api.subscribeTable('countdown_events', reload);
    return () => sub.unsubscribe();
  }, []);

  if (events.length === 0) return null;

  return (
    <>
      {events.map((ev) => (
        <CountdownEventCard key={ev.id} event={ev} />
      ))}
    </>
  );
}
