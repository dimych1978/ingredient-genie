// hooks/useTelemetronApi.ts
import { useCallback } from "react";

export const useTelemetronApi = () => {
  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
     const cacheKey = `${endpoint}:${JSON.stringify(options.body || '')}`;
  
  // Проверяем кэш (5 минут)
  const cached = sessionStorage.getItem(cacheKey);
  const cacheTime = sessionStorage.getItem(`${cacheKey}:time`);
  
  if (cached && cacheTime && Date.now() - parseInt(cacheTime) < 5 * 60 * 1000) {
    return JSON.parse(cached);
  }
  
    const response = await fetch(`/api/telemetron/${endpoint}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status}. ${errorText}`);
    }

    return response.json();
  }, []);

  const getMachineOverview = useCallback((vmId: string) => {
    const formData = new FormData();
    formData.append('_method', 'get');
    formData.append('data[id]', vmId);

    return apiRequest(`machines-overview`, {
      method: 'POST',
      body: formData
    });
  }, [apiRequest]);

  const getSalesByProducts = useCallback((vmId: string, dateFrom: string, dateTo: string) => {
    return apiRequest(
      `reports/sales-by-products?vm_id=${vmId}&sale_type=4&date_from=${dateFrom}&date_to=${dateTo}`
    );
  }, [apiRequest]);

return {
    getMachineOverview,
    getSalesByProducts,
    apiRequest, 
  };
};