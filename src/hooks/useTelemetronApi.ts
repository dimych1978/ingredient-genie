// hooks/useTelemetronApi.ts (с прокси)
"use client";

import { useCallback } from 'react';
import { useTeletmetronAuth } from './useTelemetronAuth';

// Используем наш прокси вместо прямого вызова
const PROXY_BASE_URL = '/api/telemetron';

export const useTeletmetronApi = () => {
  const { getToken } = useTeletmetronAuth();

  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    // Убираем начальный /api/ если есть, так как прокси уже добавляет его
    const cleanEndpoint = endpoint.startsWith('/api/') ? endpoint.slice(5) : endpoint;
    
    const response = await fetch(`${PROXY_BASE_URL}/${cleanEndpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  }, [getToken]);

  const getSalesByProducts = useCallback((vmId: string, dateFrom: string, dateTo: string) => {
    return apiRequest(
      `reports/sales-by-products?vm_id=${vmId}&sale_type=4&date_from=${dateFrom}&date_to=${dateTo}`
    );
  }, [apiRequest]);

  // Новый метод для тестирования найденного эндпоинта
  const getMachineDetails = useCallback((vmId: string) => {
    return apiRequest(`reports/vending_machines/vms/${vmId}`);
  }, [apiRequest]);

  // Универсальный метод для любых эндпоинтов
  const testEndpoint = useCallback((endpoint: string) => {
    return apiRequest(endpoint);
  }, [apiRequest]);

  return {
    getSalesByProducts,
    getMachineDetails,
    testEndpoint,
    apiRequest
  };
};