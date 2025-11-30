// components/working-apis-test.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, BarChart3, Smartphone, Wifi } from 'lucide-react';

export const WorkingApisTest = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ [key: string]: any }>({});
  const { testEndpoint, apiRequest } = useTeletmetronApi();

  const workingEndpoints = [
    {
      name: 'Информация о модеме',
      endpoint: 'modems/46353',
      description: 'Данные о конкретном модеме',
      icon: <Smartphone className="h-4 w-4" />,
      method: 'GET' as const
    },
    {
      name: 'Продажи по товарам',
      endpoint: 'reports/sales-by-products?vm_id=51211&sale_type=4&date_from=2025-11-26T00:00:00.000&date_to=2025-11-29T23:59:59.999',
      description: 'Отчет по продажам',
      icon: <BarChart3 className="h-4 w-4" />,
      method: 'GET' as const
    },
    {
      name: 'WebSocket Channels',
      endpoint: 'ws-channels',
      description: 'Получить каналы для WebSocket',
      icon: <Wifi className="h-4 w-4" />,
      method: 'POST' as const,
      body: {
        client: "ccc6666d-60b1-47a9-998d-5a6e76269e1c",
        channels: ["$c2494"]
      }
    }
  ];

  const testAllEndpoints = async () => {
    setLoading(true);
    const newResults: { [key: string]: any } = {};
    
    for (const endpoint of workingEndpoints) {
      try {
        console.log(`🧪 Тестируем: ${endpoint.method} ${endpoint.endpoint}`);
        
        let data;
        if (endpoint.method === 'POST') {
          // Для POST запросов используем apiRequest напрямую
          data = await apiRequest(endpoint.endpoint, {
            method: 'POST',
            body: JSON.stringify(endpoint.body)
          });
        } else {
          // Для GET используем testEndpoint
          data = await testEndpoint(endpoint.endpoint);
        }
        
        newResults[endpoint.name] = { 
          success: true, 
          data: data
        };
        console.log(`✅ Успех: ${endpoint.name}`);
      } catch (error) {
        newResults[endpoint.name] = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
        console.error(`❌ Ошибка: ${endpoint.name}`, error);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    setResults(newResults);
    setLoading(false);
  };

  const testSingleEndpoint = async (endpoint: typeof workingEndpoints[0]) => {
    setLoading(true);
    try {
      let data;
      if (endpoint.method === 'POST') {
        data = await apiRequest(endpoint.endpoint, {
          method: 'POST',
          body: JSON.stringify(endpoint.body)
        });
      } else {
        data = await testEndpoint(endpoint.endpoint);
      }
      
      setResults(prev => ({
        ...prev,
        [endpoint.name]: { success: true, data }
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [endpoint.name]: { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  const workingCount = Object.values(results).filter(r => r.success).length;
  const totalCount = workingEndpoints.length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Рабочие API Telemetron</span>
          {Object.keys(results).length > 0 && (
            <span className={`text-sm font-normal ${workingCount === totalCount ? 'text-green-600' : 'text-orange-600'}`}>
              {workingCount}/{totalCount} работают
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testAllEndpoints} 
          disabled={loading}
          className="w-full"
        >
          {loading ? <Loader2 className="animate-spin" /> : '🧪'}
          {loading ? 'Тестируем...' : 'Тестировать все API'}
        </Button>

        <div className="grid gap-3">
          {workingEndpoints.map((endpoint) => (
            <div key={endpoint.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {endpoint.icon}
                  {endpoint.name}
                  {results[endpoint.name]?.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : results[endpoint.name] ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : null}
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {endpoint.method}
                  </span>
                </div>
                <div className="text-sm text-gray-600">{endpoint.description}</div>
                <div className="text-xs text-gray-500 font-mono mt-1">{endpoint.endpoint}</div>
                {endpoint.body && (
                  <div className="text-xs text-blue-600 mt-1">
                    Body: {JSON.stringify(endpoint.body)}
                  </div>
                )}
              </div>
              <Button
                onClick={() => testSingleEndpoint(endpoint)}
                disabled={loading}
                size="sm"
                variant="outline"
              >
                Тест
              </Button>
            </div>
          ))}
        </div>

        {Object.keys(results).length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Результаты:</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {Object.entries(results).map(([name, result]) => (
                <details key={name} className="border rounded">
                  <summary className={`p-2 cursor-pointer font-medium flex items-center gap-2 ${
                    result.success ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
                  }`}>
                    {name} 
                    {result.success ? '✅' : '❌'}
                  </summary>
                  <pre className="text-xs p-2 bg-white overflow-x-auto max-h-40">
                    {JSON.stringify(result.data || result.error, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600 p-3 bg-green-50 rounded">
          <div className="font-medium mb-1">📊 Статус API:</div>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>GET /modems/{'{id}'}</strong> - работает ✅</li>
            <li><strong>GET /reports/sales-by-products</strong> - работает ✅</li>
            <li><strong>POST /ws-channels</strong> - тестируется 🔄</li>
            <li><strong>GET /modems</strong> - 403 (нет прав) ❌</li>
            <li><strong>GET /vms/{'{id}'}</strong> - 404 (не найден) ❌</li>
          </ul>
          
          <div className="mt-3 font-medium">🎯 Выводы:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>API работает через прокси ✅</li>
            <li>Токен авторизации валиден ✅</li>
            <li>Есть доступ к данным конкретных устройств ✅</li>
            <li>Нет прав на список всех устройств (нормально для безопасности)</li>
            <li>WebSocket channels требует POST запросы</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};