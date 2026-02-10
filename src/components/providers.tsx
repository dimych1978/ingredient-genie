"use client";

import { ScheduleCacheProvider } from "./context/ScheduleCacheContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ScheduleCacheProvider>
      {children}
    </ScheduleCacheProvider>
  );
}
