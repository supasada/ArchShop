// Trailing-edge debounce for realtime "something changed, reload" handlers.
// A burst of events (e.g. saving a promotion writes 3-5 rows) becomes one request.

// Delay used for every realtime-triggered refetch (free-tier egress budget).
export const REALTIME_DEBOUNCE_MS = 1500;

// Returns a function that calls fn(...lastArgs) once, `wait` ms after the last call.
// options.maxWait: also fire at most this long after the first call of a burst, so a
// steady stream of events cannot postpone the reload forever.
// The returned function has .cancel() (drop the pending call; use in effect cleanup)
// and .flush() (run the pending call now) and .pending().
export function debounce(fn, wait = REALTIME_DEBOUNCE_MS, options = {}) {
  const maxWait = Number.isFinite(options.maxWait) ? Math.max(options.maxWait, wait) : null;
  let timer = null;
  let firstCallAt = null;
  let lastArgs = [];

  const run = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    firstCallAt = null;
    const args = lastArgs;
    lastArgs = [];
    return fn(...args);
  };

  function debounced(...args) {
    lastArgs = args;
    const now = Date.now();
    if (firstCallAt === null) firstCallAt = now;
    if (timer) clearTimeout(timer);
    let delay = wait;
    if (maxWait !== null) delay = Math.max(0, Math.min(wait, firstCallAt + maxWait - now));
    timer = setTimeout(run, delay);
  }

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    firstCallAt = null;
    lastArgs = [];
  };
  debounced.flush = () => (timer ? run() : undefined);
  debounced.pending = () => timer !== null;
  return debounced;
}
