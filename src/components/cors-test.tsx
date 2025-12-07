// components/cors-test.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Network } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTeletmetronAuth } from '@/hooks/useTelemetronAuth';

export const CorsTest = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ [key: string]: any }>({});
  const { getToken } = useTeletmetronAuth();
  const { toast } = useToast();

  // Тестируем только 2 эндпоинта через универсальный прокси
  const endpointsToTest = [
    {
      name: 'Machines Overview (POST FormData)',
      endpoint: 'machines-overview',
      description: 'POST с FormData для получения информации об аппарате',
      type: 'POST_FORM',
      vmId: '58690'
    },
    {
      name: 'Sales by Products (GET JSON)',
      endpoint: 'reports/sales-by-products',
      query: '?vm_id=58690&sale_type=4&date_from=2025-11-30T00:00:00.000&date_to=2025-12-07T23:59:59.999',
      description: 'GET JSON отчет по продажам за период',
      type: 'GET'
    }
  ];

  const testSingleEndpoint = async (endpoint: { 
    name: string; 
    endpoint: string;
    type: string;
    vmId?: string;
    query?: string;
  }) => {
    setLoading(true);
    try {
      let result;
      const token = await getToken();
      
      if (endpoint.type === 'POST_FORM') {
        // Для machines-overview используем FormData через универсальный прокси
        const formData = new FormData();
        formData.append('_method', 'get');
        formData.append('data[id]', endpoint.vmId || '58690');
        
        const response = await fetch(`/api/telemetron/${endpoint.endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        result = await response.json();
      } else {
        // Для sales-by-products используем GET через универсальный прокси
        const fullPath = `${endpoint.endpoint}${endpoint.query || ''}`;
        const response = await fetch(`/api/telemetron/${fullPath}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        result = await response.json();
      }
      
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
        let result;
        const token = await getToken();
        
        if (endpoint.type === 'POST_FORM') {
          const formData = new FormData();
          formData.append('_method', 'get');
          formData.append('data[id]', endpoint.vmId || '58690');
          
          const response = await fetch(`/api/telemetron/${endpoint.endpoint}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
          });
          
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          result = await response.json();
        } else {
          const fullPath = `${endpoint.endpoint}${endpoint.query || ''}`;
          const response = await fetch(`/api/telemetron/${fullPath}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          });
          
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          result = await response.json();
        }
        
        newResults[endpoint.name] = { success: true, data: result };
        console.log(`✅ ${endpoint.name}`);
      } catch (error) {
        newResults[endpoint.name] = { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
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
          Тестирование через универсальный прокси
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testAllEndpoints} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Тестирование...
            </>
          ) : 'Тестировать оба эндпоинта'}
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
                <div className="text-xs text-gray-500 font-mono mt-1 break-all">
                  {endpoint.type === 'POST_FORM' 
                    ? `POST /api/telemetron/${endpoint.endpoint}` 
                    : `GET /api/telemetron/${endpoint.endpoint}${endpoint.query}`}
                </div>
              </div>
              <Button
                onClick={() => testSingleEndpoint(endpoint)}
                disabled={loading}
                size="sm"
                variant="outline"
              >
                Тест ({endpoint.type === 'POST_FORM' ? 'POST' : 'GET'})
              </Button>
            </div>
          ))}
        </div>

        {/* Результаты */}
        {Object.keys(results).length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Результаты тестирования:</h4>
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
          <div className="font-medium mb-1">Как работает универсальный прокси:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Все запросы идут через <code>/api/telemetron/[...path]</code></li>
            <li>POST запросы с FormData обрабатываются правильно</li>
            <li>GET запросы передают query-параметры</li>
            <li>Один прокси для всех 250+ аппаратов!</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};