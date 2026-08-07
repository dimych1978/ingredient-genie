'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { getExpirationDates, saveExpirationDates } from '@/app/actions';

type ScheduleStateContextType = {
  selectedDate: Date;
  setSelectedDate: Dispatch<SetStateAction<Date>>;
  stockOnHand: Record<string, string>;
  setStockOnHand: Dispatch<SetStateAction<Record<string, string>>>;
  expirationDates: Record<string, string>;
  setExpirationDates: Dispatch<SetStateAction<Record<string, string>>>;
  refreshExpirationDates: () => Promise<void>;
  machineItemExpiry: Record<string, string>;
  setMachineItemExpiryDate: (
    machineId: string,
    itemName: string,
    date: Date | null,
  ) => void;
};

const ScheduleStateContext = createContext<
  ScheduleStateContextType | undefined
>(undefined);

const STOCK_STORAGE_KEY = 'telemetron_stock_on_hand';
const EXPIRY_STORAGE_KEY = 'telemetron_expiration_dates';
const MACHINE_ITEM_EXPIRY_KEY = 'machine_item_expiry';

export const ScheduleStateProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [stockOnHand, setStockOnHand] = useState<Record<string, string>>({});
  const [expirationDates, setExpirationDates] = useState<
    Record<string, string>
  >({});
  const [machineItemExpiry, setMachineItemExpiry] = useState<
    Record<string, string>
  >({});
  const [isInitialized, setIsInitialized] = useState(false);

  const refreshExpirationDates = async () => {
    try {
      const cloudDates = await getExpirationDates();
      if (cloudDates && Object.keys(cloudDates).length > 0) {
        setExpirationDates(cloudDates);
        localStorage.setItem(EXPIRY_STORAGE_KEY, JSON.stringify(cloudDates));
      }
    } catch (error) {
      console.error('Ошибка синхронизации с Redis:', error);
    }
  };

  // 1. Загрузка данных при первом запуске (сначала локально, потом облако)
  useEffect(() => {
    const init = async () => {
      // Загружаем остатки
      const savedStock = localStorage.getItem(STOCK_STORAGE_KEY);
      if (savedStock) {
        try {
          setStockOnHand(JSON.parse(savedStock));
        } catch (error) {
          console.error('Ошибка парсинга остатков:', error);
        }
      }

      // Сначала грузим сроки из локалки для скорости
      const savedExpiry = localStorage.getItem(EXPIRY_STORAGE_KEY);
      if (savedExpiry) {
        try {
          setExpirationDates(JSON.parse(savedExpiry));
        } catch (error) {
          console.error('Ошибка парсинга сроков из локалки:', error);
        }
      }

      // Потом обновляем из Redis
      await refreshExpirationDates();
      setIsInitialized(true);
    };

    init();
  }, []);

  // 2. Сохранение остатков в локалку
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(stockOnHand));
    }
  }, [stockOnHand, isInitialized]);

  // 3. Сохранение сроков в Redis и локалку
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(EXPIRY_STORAGE_KEY, JSON.stringify(expirationDates));
      saveExpirationDates(expirationDates);
    }
  }, [expirationDates, isInitialized]);

  // 4. Синхронизация остатков между вкладками
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.newValue) return;

      if (e.key === STOCK_STORAGE_KEY) {
        try {
          const newData = JSON.parse(e.newValue);
          setStockOnHand(prev =>
            JSON.stringify(prev) !== e.newValue ? newData : prev,
          );
        } catch (error) {
          console.error('Storage sync error (stock):', error);
        }
      }

      if (e.key === EXPIRY_STORAGE_KEY) {
        try {
          const newData = JSON.parse(e.newValue);
          setExpirationDates(prev =>
            JSON.stringify(prev) !== e.newValue ? newData : prev,
          );
        } catch (error) {
          console.error('Storage sync error (expiry):', error);
        }
      }

      if (e.key === MACHINE_ITEM_EXPIRY_KEY) {
        try {
          const newData = JSON.parse(e.newValue);
          setMachineItemExpiry(prev =>
            JSON.stringify(prev) !== e.newValue ? newData : prev,
          );
        } catch (error) {
          console.error('Storage sync error (machine expiry):', error);
        }
      }
      console.log('STORAGE EVENT', e.key, e.newValue);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Загрузка при инициализации
  useEffect(() => {
    const saved = localStorage.getItem(MACHINE_ITEM_EXPIRY_KEY);
    if (saved) {
      try {
        setMachineItemExpiry(JSON.parse(saved));
      } catch (e: unknown) {
        {
          console.error(e instanceof Error ? e.message : e);
        }
      }
    }
  }, []);

  // Сохранение при изменении
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(
        MACHINE_ITEM_EXPIRY_KEY,
        JSON.stringify(machineItemExpiry),
      );
    }
  }, [machineItemExpiry, isInitialized]);

  // Функция для установки даты
  const setMachineItemExpiryDate = (
    machineId: string,
    itemName: string,
    date: Date | null,
  ) => {
    setMachineItemExpiry(prev => {
      const next = { ...prev };
      const key = `${machineId}_${itemName}`;
      if (date) {
        next[key] = date.toISOString();
      } else {
        delete next[key];
      }
      return next;
    });
  };

  return (
    <ScheduleStateContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        stockOnHand,
        setStockOnHand,
        expirationDates,
        setExpirationDates,
        refreshExpirationDates,
        machineItemExpiry,
        setMachineItemExpiryDate,
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
      'useScheduleState must be used within a ScheduleStateProvider',
    );
  }
  return context;
};
