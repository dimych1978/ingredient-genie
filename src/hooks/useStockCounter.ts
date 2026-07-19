// hooks/useStockCounter.ts

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useScheduleState } from '@/components/context/ScheduleStateContext';

type Counts = Record<string, number>;

const FLUSH_DELAY = 1000;

export const useStockCounter = () => {
  const { stockOnHand, setStockOnHand } = useScheduleState();

  /**
   * Локальное быстрое хранилище.
   * Здесь всегда актуальные значения для UI.
   */
  const countsRef = useRef<Counts>({});

  /**
   * Какие ключи были изменены пользователем
   * и ждут отправки в Context.
   */
  const dirtyRef = useRef<Set<string>>(new Set());

  /**
   * Таймер debounce
   */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Был ли первый импорт из Context
   */
  const initializedRef = useRef(false);

  /**
   * Просто заставляет компонент перечитать ref.
   */
  const [, forceRender] = useReducer(value => value + 1, 0);

  /**
   * Первичная загрузка из Context
   */
  useEffect(() => {
    if (initializedRef.current || Object.keys(stockOnHand).length === 0) return;

    let changed = false;
    Object.entries(stockOnHand).forEach(([key, value]) => {
      if (!dirtyRef.current.has(key)) {
        countsRef.current[key] = Number(value) || 0;
        changed = true;
      }
    });
    initializedRef.current = true;

    if (changed) forceRender();
  }, [stockOnHand]);

  /**
   * Запись накопленных изменений наружу
   */
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (dirtyRef.current.size === 0) {
      return;
    }

    const changedKeys = Array.from(dirtyRef.current);

    setStockOnHand(prev => {
      const next = {
        ...prev,
      };

      changedKeys.forEach(key => {
        next[key] = String(countsRef.current[key] ?? 0);
      });

      return next;
    });

    changedKeys.forEach(key => {
      dirtyRef.current.delete(key);
    });
  }, [setStockOnHand]);

  /**
   * Планирование сохранения
   */
  const scheduleFlush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(flush, FLUSH_DELAY);
  }, [flush]);

  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  /**
   * Изменение одного значения
   */
  const updateValue = useCallback(
    (name: string, value: number) => {
      const nextValue = Math.max(0, value);

      const current = countsRef.current[name] ?? 0;

      if (current === nextValue) {
        return;
      }

      countsRef.current[name] = nextValue;

      dirtyRef.current.add(name);

      forceRender();

      scheduleFlush();
    },
    [scheduleFlush],
  );

  const getValue = useCallback((name: string) => {
    return countsRef.current[name] ?? 0;
  }, []);

  const setValue = useCallback(
    (name: string, value: number) => {
      updateValue(name, value);
    },
    [updateValue],
  );

  const increment = useCallback(
    (name: string) => {
      updateValue(name, (countsRef.current[name] ?? 0) + 1);
    },
    [updateValue],
  );

  const decrement = useCallback(
    (name: string) => {
      updateValue(name, Math.max(0, (countsRef.current[name] ?? 0) - 1));
    },
    [updateValue],
  );

  /**
   * Синхронизация извне
   **/
  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }

    let changed = false;
    Object.entries(stockOnHand).forEach(([key, value]) => {
      if (!dirtyRef.current.has(key)) {
        countsRef.current[key] = Number(value) || 0;
        changed = true;
      }
    });
    if (changed) forceRender();
  }, [stockOnHand]);

  /**
   * Полный сброс локального состояния
   */
  const reset = useCallback(() => {
    countsRef.current = {};

    dirtyRef.current.clear();

    initializedRef.current = false;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    forceRender();
  }, []);

  /**
   * Принудительно сохранить
   */
  const flushNow = useCallback(() => {
    flush();
  }, [flush]);

  /**
   * Очистка
   */
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    getValue,
    setValue,
    increment,
    decrement,
    reset,
    flush: flushNow,
  };
};
