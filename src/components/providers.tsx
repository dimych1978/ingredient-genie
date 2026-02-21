'use client';

import { ScheduleCacheProvider } from './context/ScheduleCacheContext';
import { ScheduleStateProvider } from './context/ScheduleStateContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ScheduleStateProvider>
      <ScheduleCacheProvider>{children}</ScheduleCacheProvider>
    </ScheduleStateProvider>
  );
}
