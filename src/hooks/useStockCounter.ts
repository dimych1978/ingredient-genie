// hooks/useStockCounter.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { useScheduleState } from '@/components/context/ScheduleStateContext';

export const useStockCounter = () => {
  const { stockOnHand, setStockOnHand } = useScheduleState();
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({});
  const pendingUpdates = useRef<Record<string, number>>({});
  const rafId = useRef<number | null>(null);

  // Синхронизация локальных значений с глобальными при изменении извне
  useEffect(() => {
    setLocalCounts(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach(name => {
        const globalVal = parseInt(stockOnHand[name] || '0') || 0;
        if (next[name] !== globalVal) {
          next[name] = globalVal;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [stockOnHand]);

  const getValue = useCallback((name: string) => {
    const local = localCounts[name];
    if (local !== undefined) return local;
    return parseInt(stockOnHand[name] || '0') || 0;
  }, [localCounts, stockOnHand]);

  const setValue = useCallback((name: string, value: number) => {
    const clamped = Math.max(0, value);
    setLocalCounts(prev => {
      const current = prev[name] !== undefined ? prev[name] : parseInt(stockOnHand[name] || '0') || 0;
      if (current === clamped) return prev;
      const next = { ...prev, [name]: clamped };
      return next;
    });
    // Накопление для отправки в контекст
    pendingUpdates.current[name] = clamped;
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        const updates = { ...pendingUpdates.current };
        pendingUpdates.current = {};
        rafId.current = null;
        if (Object.keys(updates).length > 0) {
          setStockOnHand(prev => {
            const next = { ...prev };
            Object.entries(updates).forEach(([key, val]) => {
              next[key] = val.toString();
            });
            return next;
          });
        }
      });
    }
  }, [stockOnHand, setStockOnHand]);

  const increment = useCallback((name: string) => {
    setLocalCounts(prev => {
      const current = prev[name] !== undefined ? prev[name] : parseInt(stockOnHand[name] || '0') || 0;
      const newVal = current + 1;
      pendingUpdates.current[name] = newVal;
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          const updates = { ...pendingUpdates.current };
          pendingUpdates.current = {};
          rafId.current = null;
          if (Object.keys(updates).length > 0) {
            setStockOnHand(prev => {
              const next = { ...prev };
              Object.entries(updates).forEach(([key, val]) => {
                next[key] = val.toString();
              });
              return next;
            });
          }
        });
      }
      return { ...prev, [name]: newVal };
    });
  }, [stockOnHand, setStockOnHand]);

  const decrement = useCallback((name: string) => {
    setLocalCounts(prev => {
      const current = prev[name] !== undefined ? prev[name] : parseInt(stockOnHand[name] || '0') || 0;
      const newVal = Math.max(0, current - 1);
      pendingUpdates.current[name] = newVal;
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          const updates = { ...pendingUpdates.current };
          pendingUpdates.current = {};
          rafId.current = null;
          if (Object.keys(updates).length > 0) {
            setStockOnHand(prev => {
              const next = { ...prev };
              Object.entries(updates).forEach(([key, val]) => {
                next[key] = val.toString();
              });
              return next;
            });
          }
        });
      }
      return { ...prev, [name]: newVal };
    });
  }, [stockOnHand, setStockOnHand]);

  const reset = useCallback(() => {
    setLocalCounts({});
    pendingUpdates.current = {};
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  return {
    getValue,
    setValue,
    increment,
    decrement,
    reset,
  };
};