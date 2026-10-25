import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, REALTIME_DEBOUNCE_MS } from './debounce';

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('collapses a burst into one trailing call with the last args', () => {
    const fn = vi.fn();
    const d = debounce(fn, 1500);
    d(1); d(2); d(3);
    vi.advanceTimersByTime(1499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('restarts the wait on every call', () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d();
    vi.advanceTimersByTime(800);
    d();
    vi.advanceTimersByTime(800);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('maxWait fires during a steady stream', () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000, { maxWait: 3000 });
    for (let i = 0; i < 10; i++) { d(); vi.advanceTimersByTime(500); }
    // 5s of events every 500ms: fires at 3s, then the next burst's maxWait is pending
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel drops the pending call; flush runs it now', () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d();
    expect(d.pending()).toBe(true);
    d.cancel();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    d('x');
    d.flush();
    expect(fn).toHaveBeenCalledWith('x');
    expect(d.pending()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('realtime delay is at least 1.5s', () => {
    expect(REALTIME_DEBOUNCE_MS).toBeGreaterThanOrEqual(1500);
  });
});
