// hooks/useStockCounter.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { useScheduleState } from '@/components/context/ScheduleStateContext';

export const useStockCounter = () => {
  const { stockOnHand, setStockOnHand } = useScheduleState();
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({});
  const pendingUpdates = useRef<Record<string, number>>({});

   // Синхронизация: при изменении stockOnHand извне (другая вкладка) сбрасываем локальные значения для тех товаров, которые изменились
  useEffect(() => {
    setLocalCounts(prev => {
      const next = { ...prev };
      let hasChanges = false;
      
      // Проверяем каждый локальный товар
      Object.keys(next).forEach(name => {
        const globalValue = parseInt(stockOnHand[name] || '0') || 0;
        // Если глобальное значение отличается от локального — обновляем
        if (next[name] !== globalValue) {
          next[name] = globalValue;
          hasChanges = true;
        }
      });
      
      return hasChanges ? next : prev;
    });
  }, [stockOnHand]);

  // Получить текущее значение (из локального или глобального)
  const getValue = useCallback(
    (name: string) => {
      const localValue = localCounts[name];
      if (localValue !== undefined) return localValue;

      const globalValue = parseInt(stockOnHand[name] || '0');
      return isNaN(globalValue) ? 0 : globalValue;
    },
    [localCounts, stockOnHand],
  );

  // Установить значение (мгновенно UI + отложенная синхронизация)
  const setValue = useCallback(
    (name: string, value: number) => {
      const clampedValue = Math.max(0, value);
      const current = getValue(name);

      if (current === clampedValue) return;

      // 1. Мгновенно обновляем UI
      setLocalCounts(prev => ({ ...prev, [name]: clampedValue }));

      // 2. Накопливаем обновление
      pendingUpdates.current[name] = clampedValue;

      // 3. Отправляем батчем через requestAnimationFrame
      if (!pendingUpdates.current._raf) {
        pendingUpdates.current._raf = requestAnimationFrame(() => {
          const updates = { ...pendingUpdates.current };
          delete updates._raf;

          if (Object.keys(updates).length > 0) {
            setStockOnHand(prev => {
              const next = { ...prev };
              Object.entries(updates).forEach(([key, value]) => {
                next[key] = value.toString();
              });
              return next;
            });
          }

          pendingUpdates.current = {};
        });
      }
    },
    [getValue, setStockOnHand],
  );

  // Инкремент
  const increment = useCallback(
    (name: string) => {
      const current = getValue(name);
      setValue(name, current + 1);
    },
    [getValue, setValue],
  );

  // Декремент
  const decrement = useCallback(
    (name: string) => {
      const current = getValue(name);
      setValue(name, current - 1);
    },
    [getValue, setValue],
  );

  // Сброс локального состояния
  const reset = useCallback(() => {
    setLocalCounts({});
    pendingUpdates.current = {};
  }, []);

  return {
    getValue,
    setValue, 
    increment,
    decrement,
    reset,
  };
};
