'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { createContext, useContext, useState } from 'react';

type ScheduleStateContextType = {
  selectedDate: Date;
  setSelectedDate: Dispatch<SetStateAction<Date>>;
  stockOnHand: Record<string, string>;
  setStockOnHand: Dispatch<SetStateAction<Record<string, string>>>;
};

const ScheduleStateContext = createContext<ScheduleStateContextType | undefined>(
  undefined
);

export const ScheduleStateProvider = ({ children }: { children: ReactNode }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [stockOnHand, setStockOnHand] = useState<Record<string, string>>({});

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
