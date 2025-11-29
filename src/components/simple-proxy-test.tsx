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
      
      // Сначала тестируем базовый рабочий эндпоинт
      const data = await testEndpoint(
        'reports/sales-by-products?vm_id=51211&sale_type=4&date_from=2025-11-26T00:00:00.000&date_to=2025-11-29T23:59:59.999'
      );
      
      setResult({ success: true, data });
      toast({
        title: 'Успех!',
        description: 'Прокси работает, данные получены',
      });
      
    } catch (error) {
      console.error('❌ Тест провален:', error);
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Простой тест прокси</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testProxy} 
          disabled={loading}
          className="w-full"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          {loading ? 'Тестируем...' : 'Тестировать прокси'}
        </Button>

        {result && (
          <div>
            <h4 className="font-semibold mb-2">
              {result.success ? '✅ Успех' : '❌ Ошибка'}
            </h4>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <div className="font-medium mb-1">Что тестируем:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Работает ли прокси маршрут</li>
            <li>Передается ли токен авторизации</li>
            <li>Получаем ли данные от Telemetron</li>
            <li>Обрабатываются ли ошибки</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};