'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type ScheduleCacheContextType = {
  scheduleCache: Record<string, string[] | null>;
  setScheduleCache: React.Dispatch<React.SetStateAction<Record<string, string[] | null>>>;
};

const ScheduleCacheContext = createContext<ScheduleCacheContextType | undefined>(undefined);

export const ScheduleCacheProvider = ({ children }: { children: ReactNode }) => {
  const [scheduleCache, setScheduleCache] = useState<Record<string, string[] | null>>({});
  return (
    <ScheduleCacheContext.Provider value={{ scheduleCache, setScheduleCache }}>
      {children}
    </ScheduleCacheContext.Provider>
  );
};

export const useScheduleCache = () => {
  const context = useContext(ScheduleCacheContext);
  if (context === undefined) {
    throw new Error('useScheduleCache must be used within a ScheduleCacheProvider');
  }
  return context;
};
