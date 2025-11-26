// hooks/useTeletmetronApi.ts
"use client";

import { useCallback } from 'react';
import { useTeletmetronAuth } from './useTelemetronAuth';

export const useTeletmetronApi = () => {
  const { getToken } = useTeletmetronAuth();

  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    const response = await fetch(`https://my.telemetron.net${endpoint}`, {
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
      `/api/reports/sales-by-products?vm_id=${vmId}&sale_type=4&date_from=${dateFrom}&date_to=${dateTo}`
    );
  }, [apiRequest]);

  const getMachineInfo = useCallback((vmId: string) => {
    return apiRequest(`/api/modems/${vmId}`);
  }, [apiRequest]);

  return {
    getSalesByProducts,
    getMachineInfo,
    apiRequest
  };
};