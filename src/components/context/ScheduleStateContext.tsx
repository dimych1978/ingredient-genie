'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

type ScheduleStateContextType = {
  selectedDate: Date;
  setSelectedDate: Dispatch<SetStateAction<Date>>;
  stockOnHand: Record<string, string>;
  setStockOnHand: Dispatch<SetStateAction<Record<string, string>>>;
};

const ScheduleStateContext = createContext<ScheduleStateContextType | undefined>(
  undefined
);

const STORAGE_KEY = 'telemetron_stock_on_hand';

export const ScheduleStateProvider = ({ children }: { children: ReactNode }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [stockOnHand, setStockOnHand] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // 1. Загрузка данных из localStorage при первом запуске (только на клиенте)
  useEffect(() => {
    const savedStock = localStorage.getItem(STORAGE_KEY);
    if (savedStock) {
      try {
        setStockOnHand(JSON.parse(savedStock));
      } catch (error) {
        console.error('Ошибка парсинга остатков из localStorage:', error);
      }
    }
    setIsInitialized(true);
  }, []);

  // 2. Сохранение данных в localStorage при каждом изменении stockOnHand
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stockOnHand));
    }
  }, [stockOnHand, isInitialized]);

  return (
    <ScheduleStateContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        stockOnHand,
        setStockOnHand,
      }}
    >
      {children}
    </ScheduleStateContext.Provider>
  );
};

export const useScheduleState = () => {
  const context = useContext(ScheduleStateContext);
  if (context === undefined) {
    throw new Error(
      'useScheduleState must be used within a ScheduleStateProvider'
    );
  }
  return context;
};
