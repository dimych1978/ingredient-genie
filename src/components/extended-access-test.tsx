// components/extended-access-test.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, List, BarChart3 } from 'lucide-react';

export const ExtendedAccessTest = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ [key: string]: any }>({});
  const { testEndpoint } = useTeletmetronApi();

  const listEndpoints = [
    {
      name: 'Список всех модемов',
      endpoint: 'modems',
      description: 'GET /modems - все модемы компании',
      icon: <List className="h-4 w-4" />
    },
    {
      name: 'Модемы с лимитом',
      endpoint: 'modems?limit=5',
      description: 'GET /modems?limit=5 - первые 5 модемов',
      icon: <List className="h-4 w-4" />
    },
    {
      name: 'Список аппаратов через reports',
      endpoint: 'reports/vms',
      description: 'GET /reports/vms - аппараты через reports',
      icon: <BarChart3 className="h-4 w-4" />
    },
    {
      name: 'Аппараты с лимитом',
      endpoint: 'reports/vms?limit=5',
      description: 'GET /reports/vms?limit=5',
      icon: <BarChart3 className="h-4 w-4" />
    },
    {
      name: 'Отчеты по разным аппаратам',
      endpoint: 'reports/sales-by-products?vm_id=51212&sale_type=4&date_from=2025-11-26T00:00:00.000&date_to=2025-11-29T23:59:59.999',
      description: 'Продажи для аппарата 51212',
      icon: <BarChart3 className="h-4 w-4" />
    },
    {
      name: 'Еще один аппарат в отчетах',
      endpoint: 'reports/sales-by-products?vm_id=51000&sale_type=4&date_from=2025-11-26T00:00:00.000&date_to=2025-11-29T23:59:59.999',
      description: 'Продажи для аппарата 51000',
      icon: <BarChart3 className="h-4 w-4" />
    }
  ];

  const testLists = async () => {
    setLoading(true);
    const newResults: { [key: string]: any } = {};
    
    for (const endpoint of listEndpoints) {
      try {
        console.log(`📋 Тестируем список: ${endpoint.endpoint}`);
        const data = await testEndpoint(endpoint.endpoint);
        newResults[endpoint.name] = { 
          success: true, 
          data: data,
          count: Array.isArray(data) ? data.length : 
                 data?.data ? (Array.isArray(data.data) ? data.data.length : 'object') : 
                 'unknown'
        };
        console.log(`✅ Успех: ${endpoint.name}`);
      } catch (error) {
        newResults[endpoint.name] = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        console.log(`❌ Ошибка: ${endpoint.name}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    setResults(newResults);
    setLoading(false);
  };

  const working = Object.values(results).filter(r => r.success);
  const total = listEndpoints.length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Тест списков и отчетов</span>
          {Object.keys(results).length > 0 && (
            <span className="text-sm font-normal">
              {working.length}/{total} работают
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testLists} 
          disabled={loading}
          className="w-full"
        >
          {loading ? <Loader2 className="animate-spin" /> : '📋'}
          {loading ? 'Тестируем списки...' : 'Тестировать списки и отчеты'}
        </Button>

        {Object.keys(results).length > 0 && (
          <div className="space-y-3">
            <div className="grid gap-2">
              {listEndpoints.map((endpoint) => {
                const result = results[endpoint.name];
                
                return (
                  <div key={endpoint.name} className={`p-3 border rounded-lg ${
                    result?.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {endpoint.icon}
                      <div className="font-medium">{endpoint.name}</div>
                      {result?.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">{endpoint.description}</div>
                    <div className="text-xs font-mono text-gray-500 mb-2">{endpoint.endpoint}</div>
                    
                    {result?.success && (
                      <div className="text-sm text-green-700">
                        ✅ Успех! {result.count && `Элементов: ${result.count}`}
                      </div>
                    )}
                    {result?.error && (
                      <div className="text-sm text-red-600">
                        ❌ Ошибка: {result.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="font-medium mb-2">🎯 Критически важные выводы:</div>
              
              <div className="space-y-2 text-sm">
                <div><strong>✅ ДОСТУП КО ВСЕМ МОДЕМАМ:</strong> Можно строить полный мониторинг оборудования</div>
                <div><strong>🔍 ДАННЫЕ АППАРАТОВ:</strong> Доступны через reports endpoints, а не прямые /vms/</div>
                <div><strong>📊 АРХИТЕКТУРА ДОСТУПА:</strong> Раздельные права на оборудование vs бизнес-данные</div>
                <div><strong>🚀 ВОЗМОЖНОСТИ:</strong> Полноценный дашборд мониторинга всех модемов компании!</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};