// components/simple-proxy-test.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const SimpleProxyTest = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { testEndpoint } = useTeletmetronApi();
  const { toast } = useToast();

  const testProxy = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('🧪 Начинаем тест прокси...');
      
      // Тестируем разные эндпоинты для диагностики
      const testEndpoints = [
        'machines-overview',
        'reports/sales-by-products?vm_id=51211&sale_type=4&date_from=2025-11-26T00:00:00.000&date_to=2025-11-29T23:59:59.999',
        'vms/51211'
      ];
      
      let lastError;
      
      for (const endpoint of testEndpoints) {
        try {
          console.log(`🔄 Тестируем: ${endpoint}`);
          const data = await testEndpoint(endpoint);
          setResult({ success: true, data, testedEndpoint: endpoint });
          toast({
            title: 'Успех!',
            description: `Эндпоинт ${endpoint} работает`,
          });
          return; // Успех, выходим
        } catch (error) {
          console.error(`❌ ${endpoint} failed:`, error);
          lastError = error;
          continue; // Пробуем следующий
        }
      }
      
      // Если все эндпоинты провалились
      throw lastError;
      
    } catch (error) {
      console.error('❌ Все тесты провалены:', error);
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Прокси не работает',
      });
    } finally {
      setLoading(false);
    }
  };

  // Тест прямого fetch к прокси (обход хука)
  const testDirectProxy = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('telemetron_token'); // или откуда вы берете токен
      
      const response = await fetch('/api/telemetron/machines/51211?tab=overview', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      setResult({ success: response.ok, data, status: response.status });
      
    } catch (error) {
      setResult({ success: false, error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Диагностика прокси</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={testProxy} 
            disabled={loading}
            className="flex-1"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Тест через хук
          </Button>
          
          <Button 
            onClick={testDirectProxy} 
            disabled={loading}
            variant="outline"
            className="flex-1"
          >
            Прямой тест
          </Button>
        </div>

        {result && (
          <div>
            <h4 className="font-semibold mb-2">
              {result.success ? '✅ Успех' : '❌ Ошибка'}
              {result.testedEndpoint && ` (${result.testedEndpoint})`}
              {result.status && ` Status: ${result.status}`}
            </h4>
            <pre className="text-xs bg-white border p-2 rounded overflow-x-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded">
          <div className="font-medium mb-1">Проблема может быть в:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Неправильном базовом URL в API route</li>
            <li>Проблемах с токеном авторизации</li>
            <li>Эндпоинте, который не существует</li>
            <li>CORS на стороне Telemetron</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};