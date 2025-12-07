import { useCallback } from "react";
import { useTeletmetronAuth } from "./useTelemetronAuth";

// hooks/useTelemetronApi.ts
export const useTeletmetronApi = () => {
  const { getToken } = useTeletmetronAuth();

  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    const response = await fetch(`/api/telemetron/${endpoint}`, {
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
    apiRequest
  };
};