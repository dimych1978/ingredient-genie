// hooks/useTelemetronApi.ts
"use client";

import { useCallback } from 'react';
import { useTeletmetronAuth } from './useTelemetronAuth';

// УБИРАЕМ /telemetron из пути
const PROXY_BASE_URL = '/api'; // было '/api/telemetron'

export const useTeletmetronApi = () => {
  const { getToken } = useTeletmetronAuth();

  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    
    // Теперь путь будет: /api/machines-overview
    const response = await fetch(`${PROXY_BASE_URL}/${cleanEndpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  }, [getToken]);

  // Метод для machines-overview
  const getMachineOverview = useCallback((vmId: string) => {
    const formData = new FormData();
    formData.append('_method', 'get');
    formData.append('data[id]', vmId);

    return apiRequest(`machines-overview`, {
      method: 'POST',
      body: formData
    });
  }, [apiRequest]);

  return {
    getMachineOverview,
    apiRequest
  };
};