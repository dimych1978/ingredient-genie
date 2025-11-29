// components/cors-test.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Network } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const CorsTest = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ [key: string]: any }>({});
  const { getMachineDetails, testEndpoint } = useTeletmetronApi();
  const { toast } = useToast();

  const endpointsToTest = [   
     {
      name: 'Работающий запрос',
      endpoint: 'reports/sales-by-products?vm_id=51211&sale_type=4&date_from=2025-11-26T00:00:00.000&date_to=2025-11-29T23:59:59.999',
      description: 'Этот запрос работает'
    },

    {
      name: 'Информация об аппарате',
      endpoint: '/vending_machines/vms/51211',
      description: 'Найденный эндпоинт с CORS ошибкой'
    },
    {
      name: 'Продажи по товарам',
      endpoint: 'reports/sales-by-products?vm_id=51211&sale_type=4&date_from=2025-11-20T00:00:00.000&date_to=2025-11-27T23:59:59.999',
      description: 'Известный рабочий эндпоинт'
    },
    {
      name: 'Список аппаратов',
      endpoint: 'reports/vending_machines/vms',
      description: 'Возможный эндпоинт для списка аппаратов'
    },
    {
      name: 'История загрузок',
      endpoint: 'reports/refill-history?vm_id=51211',
      description: 'Потенциальный эндпоинт истории загрузок'
    },
    {
      name: 'Модемы',
      endpoint: 'modems/51211',
      description: 'Что-то про модемы'
    },
    {
    name: 'Продажи по товарам',
    endpoint: 'reports/sales-by-products?vm_id=51211&sale_type=4&date_from=2025-11-26T00:00:00.000&date_to=2025-11-29T23:59:59.999',
    description: 'Рабочий эндпоинт'
  },
  {
    name: 'Модемы', 
    endpoint: 'modems/51211',
    description: 'Рабочий эндпоинт'
  },

  // Добавляй сюда новые для тестирования:
  {
    name: 'Список аппаратов',
    endpoint: 'vms',
    description: 'Возможный эндпоинт списка аппаратов'
  },
  {
    name: 'Информация об аппарате',
    endpoint: 'vms/51211',
    description: 'Инфа по конкретному аппарату'
  },
  {
    name: 'История загрузок',
    endpoint: 'reports/refill-history',
    description: 'История пополнений'
  },
  {
    name: 'События аппарата', 
    endpoint: 'vms/51211/events',
    description: 'События и уведомления'
  },
  {
    name: 'Остатки товаров',
    endpoint: 'vms/51211/stock',
    description: 'Текущие остатки'
  },
  ];

  const testSingleEndpoint = async (endpoint: { name: string; endpoint: string }) => {
    setLoading(true);
    try {
      const result = await testEndpoint(endpoint.endpoint);
      
      setResults(prev => ({
        ...prev,
        [endpoint.name]: { success: true, data: result }
      }));

      console.log(`✅ ${endpoint.name}:`, result);
      
      toast({
        title: 'Успех через прокси!',
        description: `${endpoint.name} - данные получены`,
      });

    } catch (error) {
      console.error(`❌ ${endpoint.name}:`, error);
      
      setResults(prev => ({
        ...prev,
        [endpoint.name]: { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }));

      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: `${endpoint.name} - не удалось получить данные`,
      });
    } finally {
      setLoading(false);
    }
  };

  const testAllEndpoints = async () => {
    setLoading(true);
    const newResults: { [key: string]: any } = {};
    
    for (const endpoint of endpointsToTest) {
      try {
        const result = await testEndpoint(endpoint.endpoint);
        newResults[endpoint.name] = { success: true, data: result };
        console.log(`✅ ${endpoint.name}`);
      } catch (error) {
        newResults[endpoint.name] = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
        console.log(`❌ ${endpoint.name}`);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    setResults(newResults);
    setLoading(false);
    
    const workingCount = Object.keys(newResults).filter(key => newResults[key].success).length;
    toast({
      title: 'Тестирование завершено',
      description: `Работает: ${workingCount}/${endpointsToTest.length} эндпоинтов`,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Тестирование через прокси (CORS решение)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testAllEndpoints} 
          disabled={loading}
          className="w-full"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Тестировать все эндпоинты'}
          {loading ? 'Тестирование...' : 'Тестировать все эндпоинты'}
        </Button>

        <div className="grid gap-3">
          {endpointsToTest.map((endpoint) => (
            <div key={endpoint.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {results[endpoint.name]?.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : results[endpoint.name] ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : null}
                  {endpoint.name}
                </div>
                <div className="text-sm text-gray-600">{endpoint.description}</div>
                <div className="text-xs text-gray-500 font-mono mt-1">{endpoint.endpoint}</div>
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

        {/* Результаты */}
        {Object.keys(results).length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Результаты через прокси:</h4>
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
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded">
          <div className="font-medium mb-1">Как это работает:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Запросы идут через Next.js API Route (/api/telemetron/...)</li>
            <li>Сервер делает запрос к Telemetron (нет CORS ограничений)</li>
            <li>Данные возвращаются обратно клиенту</li>
            <li>Теперь мы можем тестировать любые эндпоинты!</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};