// components/simple-refill-test.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Package, DollarSign } from 'lucide-react';

export const SimpleRefillTest = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ [key: string]: any }>({});
  const { testEndpoint } = useTeletmetronApi();

  const testEndpoints = [
    { 
      name: 'refills', 
      endpoint: 'modems/8155/refills',
      description: 'Загрузки модема 8155',
      icon: <Package className="h-4 w-4" />
    },
    { 
      name: 'collections', 
      endpoint: 'modems/8155/collections',
      description: 'Инкассации модема 8155', 
      icon: <DollarSign className="h-4 w-4" />
    },
    { 
      name: 'history', 
      endpoint: 'modems/8155/history',
      description: 'История модема 8155',
      icon: <Package className="h-4 w-4" />
    }
  ];

  const testAll = async () => {
    setLoading(true);
    const newResults: { [key: string]: any } = {};
    
    for (const item of testEndpoints) {
      try {
        console.log(`🧪 Тестируем: ${item.endpoint}`);
        const data = await testEndpoint(item.endpoint);
        newResults[item.name] = { 
          success: true, 
          data: data,
          raw: JSON.stringify(data, null, 2).substring(0, 500) + '...'
        };
        console.log(`✅ Успех: ${item.endpoint}`);
      } catch (error) {
        newResults[item.name] = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        console.error(`❌ Ошибка: ${item.endpoint}`, error);
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    setResults(newResults);
    setLoading(false);
  };

  return (
    <Card className="w-full border-2">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle>Тест эндпоинтов обслуживания</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <Button 
          onClick={testAll} 
          disabled={loading}
          className="w-full"
        >
          {loading ? <Loader2 className="animate-spin mr-2" /> : '🧪'}
          {loading ? 'Тестируем...' : 'Протестировать эндпоинты'}
        </Button>

        <div className="space-y-3">
          {testEndpoints.map((item) => {
            const result = results[item.name];
            
            return (
              <Card key={item.name} className={`border ${result?.success ? 'border-green-200' : result ? 'border-red-200' : 'border-gray-200'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {item.icon}
                    {item.description}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs font-mono text-slate-600 mb-2">
                    {item.endpoint}
                  </div>
                  
                  {!result && (
                    <div className="text-sm text-slate-500">Не тестировалось</div>
                  )}
                  
                  {result?.success && (
                    <div>
                      <div className="text-sm text-green-600 mb-2">✅ Успех!</div>
                      <details>
                        <summary className="text-sm cursor-pointer text-slate-700">
                          Показать данные
                        </summary>
                        <pre className="text-xs bg-slate-50 p-2 mt-2 rounded overflow-x-auto max-h-40">
                          {result.raw}
                        </pre>
                      </details>
                    </div>
                  )}
                  
                  {result?.error && (
                    <div className="text-sm text-red-600">
                      ❌ Ошибка: {result.error}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Выводы */}
        {Object.keys(results).length > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="text-sm font-medium mb-2">🎯 Анализ:</div>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Если эндпоинты возвращают HTML - нужно исправить парсинг</li>
                <li>Если возвращают пустой массив - данных нет</li>
                <li>Если возвращают ошибку - эндпоинт не существует</li>
              </ul>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};