// hooks/useTeletmetronToken.ts
"use client";

import { useCallback, useEffect } from 'react';
import { useTeletmetronAuth } from './useTelemetronAuth';

export const useTeletmetronToken = () => {
  const {
    token,
    loading,
    error,
    getToken,
    getTokenInfo
  } = useTeletmetronAuth();

  // Автоматически получаем токен при инициализации хука, если его еще нет
  useEffect(() => {
    const initializeToken = async () => {
      if (!token) {
        try {
            await getToken();
            console.log('🚀 Teletmetron Token автоматически получен и готов к использованию');
        } catch(e) {
            console.error("Failed to initialize token", e)
        }
      }
    };

    initializeToken();
  }, [getToken, token]);

  const logTokenToConsole = useCallback(() => {
    const tokenInfo = getTokenInfo();
    if (tokenInfo.token) {
      console.log('📝 Token info:', tokenInfo);
    } else {
      console.log('❌ No token available');
    }
  }, [getTokenInfo]);

  return {
    token,
    loading,
    error,
    getToken,
    logTokenToConsole,
    getTokenInfo
  };
};
