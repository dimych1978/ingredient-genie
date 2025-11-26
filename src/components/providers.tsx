"use client";

import { TokenInitializer } from '@/components/TokenInitializer';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TokenInitializer />
      {children}
    </>
  );
}
