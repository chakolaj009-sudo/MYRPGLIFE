import { useCallback, useEffect, useRef, useState } from 'react';
import { load, prepareDay, save, STORAGE_KEY } from '../domain/model.js';
import { todayKey } from '../domain/dates.js';

// localStorage can throw (private mode, blocked storage). Fall back to memory
// so the app still works for the session.
function getStorage() {
  try {
    const s = window.localStorage;
    const probe = '__myday_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
}

/**
 * Single source of truth. `commit(fn)` computes the next state synchronously
 * from the latest committed state (never a stale closure) and persists it
 * before React re-renders, so a refresh at any moment keeps the change.
 */
export function useStore() {
  const storage = useRef(null);
  const ref = useRef(null);
  const todayRef = useRef(null);
  if (!ref.current) {
    storage.current = getStorage();
    todayRef.current = todayKey();
    const { state } = prepareDay(load(storage.current, todayRef.current), todayRef.current);
    save(storage.current, state);
    ref.current = state;
  }
  const [state, setState] = useState(ref.current);
  const [today, setToday] = useState(todayRef.current);

  const commit = useCallback((fn) => {
    // A tap just after midnight must count for the new day even if the
    // rollover timer has not fired yet.
    const k = todayKey();
    let base = ref.current;
    if (k !== todayRef.current) {
      todayRef.current = k;
      base = prepareDay(base, k).state;
      setToday(k);
    }
    const next = fn(base, k) || base;
    if (next === ref.current) return next;
    ref.current = next;
    save(storage.current, next);
    setState(next);
    return next;
  }, []);

  // Local-date rollover: while open past midnight, when returning from the
  // background, or when the device clock/timezone changes.
  useEffect(() => {
    const check = () => {
      if (todayKey() !== todayRef.current) commit((s) => s); // commit() performs the rollover
    };
    const id = setInterval(check, 20000);
    const onVis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
    };
  }, [commit]);

  // Another tab/window changed the data.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      const next = prepareDay(load(storage.current, todayRef.current), todayRef.current).state;
      ref.current = next;
      setState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { state, today, commit };
}
