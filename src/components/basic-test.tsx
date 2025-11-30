// components/basic-test.tsx
'use client';

import { useState } from 'react';

export const BasicTest = () => {
  const [result, setResult] = useState<any>(null);

  const testDirectFetch = async () => {
    try {
      const token = localStorage.getItem('telemetron_token');
      const response = await fetch('/api/telemetron/reports/sales-by-products?vm_id=51211&sale_type=4&date_from=2025-11-26T00:00:00.000&date_to=2025-11-29T23:59:59.999', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      setResult({ status: response.status, data });
    } catch (error) {
      setResult({ error: String(error) });
    }
  };

  return (
    <div className="p-4 border rounded">
      <button onClick={testDirectFetch} className="bg-blue-500 text-white px-4 py-2 rounded">
        Тест прямого fetch
      </button>
      {result && (
        <pre className="mt-4 p-2 bg-gray-100 rounded">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
};