// hooks/useTelemetronApi.ts
import { useCallback } from "react";
import { format } from "date-fns"; // <-- меняем formatISO на format

export const useTelemetronApi = () => {
  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
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
    // Telemetron API ожидает даты в формате "YYYY-MM-DD HH:MM:SS" или "YYYY-MM-DD"
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