// hooks/useTelemetronApi.ts (исправленная версия)
"use client";

import { useCallback } from 'react';
import { useTeletmetronAuth } from './useTelemetronAuth';

const PROXY_BASE_URL = '/api/telemetron';

export const useTeletmetronApi = () => {
  const { getToken } = useTeletmetronAuth();

  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    // Убираем начальный слэш если есть, чтобы избежать двойных слэшей
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    
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

  const getMachineDetails = useCallback((vmId: string) => {
    return apiRequest(`reports/vending_machines/vms/${vmId}`);
  }, [apiRequest]);

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