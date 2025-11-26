// components/TokenInitializer.tsx
"use client";

import { useTeletmetronToken } from '@/hooks/useTelemetronToken';

export const TokenInitializer = () => {
  // Просто используем хук - он автоматически выполнится
  useTeletmetronToken();
  
  // Этот компонент ничего не рендерит
  return null;
};