// components/network-explorer.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, Network } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const NetworkExplorer = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ [key: string]: any }>({});
  const { apiRequest } = useTeletmetronApi();
  const { toast } = useToast();

  // Потенциальные эндпоинты из анализа веб-интерфейса
  const potentialEndpoints = [
    // Основные эндпоинты
    '/api/user',
    '/api/profile',
    '/api/machines',
    '/api/vms',
    '/api/devices',
    
    // Отчеты
    '/api/reports/sales',
    '/api/reports/refills',
    '/api/reports/collections',
    '/api/reports/stock',
    '/api/reports/events',
    
    // Данные по аппаратам
    '/api/vms/51211',
    '/api/machines/51211',
    '/api/devices/51211',
    
    // История
    '/api/history/refills',
    '/api/history/collections',
    '/api/history/events',
    
    // Статусы
    '/api/status',
    '/api/health',
    
    // Тестовые варианты
    '/api/data/refills',
    '/api/data/collections',
    '/api/telemetry/refills'
  ];

  const testEndpoint = async (endpoint: string) => {
    setLoading(true);
    try {
      const result = await apiRequest(endpoint);
      
      setResults(prev => ({
        ...prev,
        [endpoint]: result
      }));

      console.log(`✅ ${endpoint}:`, result);
      
      toast({
        title: 'Найден рабочий эндпоинт!',
        description: `${endpoint} - данные получены`,
      });

    } catch (error) {
      console.log(`❌ ${endpoint}:`, error);
      
      setResults(prev => ({
        ...prev,
        [endpoint]: { error: error instanceof Error ? error.message : '404' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const testAllEndpoints = async () => {
    setLoading(true);
    const newResults: { [key: string]: any } = {};
    
    for (const endpoint of potentialEndpoints) {
      try {
        const result = await apiRequest(endpoint);
        newResults[endpoint] = result;
        console.log(`✅ ${endpoint}`);
      } catch (error) {
        newResults[endpoint] = { error: '404' };
        console.log(`❌ ${endpoint}`);
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // Задержка между запросами
    }
    
    setResults(newResults);
    setLoading(false);
    
    const workingEndpoints = Object.keys(newResults).filter(key => !newResults[key].error);
    toast({
      title: 'Сканирование завершено',
      description: `Найдено ${workingEndpoints.length} рабочих эндпоинтов`,
    });
  };

  const workingEndpoints = Object.keys(results).filter(key => !results[key].error);
  const brokenEndpoints = Object.keys(results).filter(key => results[key].error);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Поиск работающих эндпоинтов
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={testAllEndpoints} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            {loading ? 'Сканирование...' : 'Сканировать все эндпоинты'}
          </Button>
        </div>

        {/* Рабочие эндпоинты */}
        {workingEndpoints.length > 0 && (
          <div>
            <h4 className="font-semibold text-green-600 mb-2">
              ✅ Рабочие эндпоинты ({workingEndpoints.length}):
            </h4>
            <div className="space-y-2">
              {workingEndpoints.map(endpoint => (
                <details key={endpoint} className="border border-green-200 rounded">
                  <summary className="p-2 cursor-pointer bg-green-50 font-mono text-sm">
                    {endpoint}
                  </summary>
                  <pre className="text-xs p-2 bg-white overflow-x-auto max-h-40">
                    {JSON.stringify(results[endpoint], null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Не рабочие эндпоинты */}
        {brokenEndpoints.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-600 mb-2">
              ❌ Не рабочие эндпоинты ({brokenEndpoints.length}):
            </h4>
            <div className="flex flex-wrap gap-1">
              {brokenEndpoints.map(endpoint => (
                <span key={endpoint} className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                  {endpoint}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ручной тест */}
        <div>
          <h4 className="font-semibold mb-2">Ручной тест эндпоинта:</h4>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="/api/your-endpoint"
              className="flex-1 border rounded px-3 py-2 font-mono text-sm"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget as HTMLInputElement;
                  testEndpoint(input.value);
                }
              }}
            />
            <Button 
              onClick={() => {
                const input = document.querySelector('input[placeholder="/api/your-endpoint"]') as HTMLInputElement;
                if (input.value) testEndpoint(input.value);
              }}
              disabled={loading}
            >
              Тест
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};