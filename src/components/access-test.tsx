// components/access-test.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export const AccessTest = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ [key: string]: any }>({});
  const { testEndpoint } = useTeletmetronApi();

  const testCases = [
    // Модемы - разные ID
    { type: 'modem', id: '46353', description: 'Текущий рабочий модем' },
    { type: 'modem', id: '46354', description: 'Следующий ID' },
    { type: 'modem', id: '46000', description: 'Другой возможный ID' },
    { type: 'modem', id: '47000', description: 'Еще один ID' },
    
    // Аппараты - разные ID  
    { type: 'vm', id: '51211', description: 'ID из отчетов' },
    { type: 'vm', id: '51212', description: 'Следующий ID аппарата' },
    { type: 'vm', id: '51000', description: 'Другой ID аппарата' },
    { type: 'vm', id: '50000', description: 'Еще ID аппарата' },
  ];

  const testAccess = async () => {
    setLoading(true);
    const newResults: { [key: string]: any } = {};
    
    for (const testCase of testCases) {
      const endpoint = testCase.type === 'modem' 
        ? `modems/${testCase.id}`
        : `vms/${testCase.id}`;
      
      const testName = `${testCase.type.toUpperCase()} ${testCase.id}`;
      
      try {
        console.log(`🔍 Тестируем доступ: ${testName}`);
        const data = await testEndpoint(endpoint);
        newResults[testName] = { 
          success: true, 
          data: data,
          description: testCase.description
        };
        console.log(`✅ Доступ есть: ${testName}`);
      } catch (error) {
        newResults[testName] = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          description: testCase.description
        };
        console.log(`❌ Нет доступа: ${testName}`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setResults(newResults);
    setLoading(false);
  };

  const working = Object.values(results).filter(r => r.success);
  const total = testCases.length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Тест прав доступа</span>
          {Object.keys(results).length > 0 && (
            <span className="text-sm font-normal">
              {working.length}/{total} доступны
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testAccess} 
          disabled={loading}
          className="w-full"
        >
          {loading ? <Loader2 className="animate-spin" /> : '🔐'}
          {loading ? 'Проверяем доступ...' : 'Проверить права доступа'}
        </Button>

        {Object.keys(results).length > 0 && (
          <div className="space-y-3">
            <div className="grid gap-2">
              {testCases.map((testCase) => {
                const key = `${testCase.type.toUpperCase()} ${testCase.id}`;
                const result = results[key];
                
                return (
                  <div key={key} className={`p-3 border rounded-lg ${
                    result?.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {result?.success ? '✅' : '❌'} {key}
                        </div>
                        <div className="text-sm text-gray-600">{testCase.description}</div>
                      </div>
                      <div className="text-sm">
                        {result?.success ? 'Доступ есть' : 'Нет доступа'}
                      </div>
                    </div>
                    {result?.error && (
                      <div className="text-xs text-red-600 mt-1">
                        Ошибка: {result.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="font-medium mb-2">📊 Анализ прав доступа:</div>
              
              {working.length === total ? (
                <div className="text-green-700">
                  ✅ Полный доступ ко всем тестируемым ресурсам
                </div>
              ) : working.length > 0 ? (
                <div className="text-orange-700">
                  🔸 Ограниченный доступ: только к {working.length} из {total} ресурсов
                </div>
              ) : (
                <div className="text-red-700">
                  ❌ Доступ только к конкретным известным ресурсам
                </div>
              )}

              <div className="mt-2 text-sm">
                <strong>Вывод:</strong> Токен предоставляет доступ только к определенным 
                ресурсам, к которым у пользователя есть права.
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <div className="font-medium mb-1">Что тестируем:</div>
          <ul className="list-disc list-inside space-y-1">
            <li>Доступ к разным ID модемов</li>
            <li>Доступ к разным ID аппаратов</li>
            <li>Определяем scope прав токена</li>
            <li>Понимаем какие данные доступны</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};