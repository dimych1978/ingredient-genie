'use client';

import { SessionProvider } from 'next-auth/react';
import { ScheduleCacheProvider } from './context/ScheduleCacheContext';
import { ScheduleStateProvider } from './context/ScheduleStateContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ScheduleStateProvider>
        <ScheduleCacheProvider>{children}</ScheduleCacheProvider>
      </ScheduleStateProvider>
    </SessionProvider>
  );
}
