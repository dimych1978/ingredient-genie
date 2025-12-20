// hooks/useTeletmetronToken.ts - ПОЛНАЯ заглушка
"use client";

export const useTeletmetronToken = () => {
  return {
    token: null,
    loading: false,
    error: null,
    getToken: async () => {
      console.log('[STUB] useTeletmetronToken.getToken called');
      return null;
    },
    logTokenToConsole: () => {
      console.log('[STUB] logTokenToConsole called');
    },
    getTokenInfo: () => {
      return { token: null, isValid: false };
    }
  };
};// // hooks/useTelemetronToken.ts
// "use client";

// import { useCallback, useEffect } from 'react';
// import { useTelemetronAuth } from './useTelemetronAuth';

// export const useTelemetronToken = () => {
//   const {
//     token,
//     loading,
//     error,
//     getToken,
//     getTokenInfo
//   } = useTelemetronAuth();

//   // Автоматически получаем токен при инициализации хука, если его еще нет
//   useEffect(() => {
//     const initializeToken = async () => {
//       if (!token) {
//         try {
//             await getToken();
//             console.log('🚀 Telemetron Token автоматически получен и готов к использованию');
//         } catch(e) {
//             console.error("Failed to initialize token", e)
//         }
//       }
//     };

//     initializeToken();
//   }, [getToken, token]);

//   const logTokenToConsole = useCallback(() => {
//     const tokenInfo = getTokenInfo();
//     if (tokenInfo.token) {
//       console.log('📝 Token info:', tokenInfo);
//     } else {
//       console.log('❌ No token available');
//     }
//   }, [getTokenInfo]);

//   return {
//     token,
//     loading,
//     error,
//     getToken,
//     logTokenToConsole,
//     getTokenInfo
//   };
// };
