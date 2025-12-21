// hooks/useTelemetronApi.ts

import { useCallback } from "react";

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

  const getSalesByProducts = useCallback((vmId: string, dateFromISO: string, dateToISO: string) => {

    return apiRequest(
      `reports/sales-by-products?vm_id=${vmId}&sale_type=4&date_from=${dateFromISO}&date_to=${dateToISO}`
    );
  }, [apiRequest]);

  return {
    getMachineOverview,
    getSalesByProducts,
    apiRequest
  };
};
