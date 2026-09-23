import React, { useEffect, useState } from 'react';
import { api } from '../config/supabase';

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
  const timeLeft = useTimeLeft(event.target_at);
  if (!timeLeft) return null;

  return (
    <div className="p-3 bg-zinc-800/90 rounded-xl border border-zinc-700 min-w-[150px]">
      <div className="text-[10px] font-mono text-zinc-400 truncate mb-1">{event.title}</div>
      <div className="flex items-center gap-1 font-mono">
        <span className="text-sm font-black text-white">{String(timeLeft.days).padStart(2, '0')}d</span>
        <span className="text-sm font-black text-amber-400">{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}</span>
      </div>
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
    <div className="mt-4 flex flex-wrap gap-2.5">
      {events.map((ev) => (
        <CountdownEventCard key={ev.id} event={ev} />
      ))}
    </div>
  );
}
