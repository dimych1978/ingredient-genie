// components/modem-vm-connection.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Link, Calendar, Package } from 'lucide-react';

export const ModemVmConnection = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ [key: string]: any }>({});
  const { testEndpoint } = useTeletmetronApi();

  // Тестируем связь между модемом 8155 и аппаратом 58690
  const connectionTests = [
    // Попробуем найти аппарат по модему
    { endpoint: 'modems/8155/vms', description: 'Аппараты модема 8155' },
    { endpoint: 'modems/8155/machines', description: 'Машины модема 8155' },
    { endpoint: 'modems/8155/devices', description: 'Устройства модема 8155' },
    
    // Попробуем найти модем по аппарату
    { endpoint: 'vms/58690/modem', description: 'Модем аппарата 58690' },
    { endpoint: 'vms/58690/device', description: 'Устройство аппарата 58690' },
    
    // Данные обслуживания для модема
    { endpoint: 'modems/8155/refills', description: 'Загрузки модема 8155' },
    { endpoint: 'modems/8155/collections', description: 'Инкассации модема 8155' },
    { endpoint: 'modems/8155/history', description: 'История модема 8155' },
    { endpoint: 'modems/8155/events', description: 'События модема 8155' },
    { endpoint: 'modems/8155/transactions', description: 'Транзакции модема 8155' },
    
    // Отчеты с привязкой к модему
    { endpoint: 'reports/refill-history?modem_id=8155', description: 'История загрузок по модему' },
    { endpoint: 'reports/collection-history?modem_id=8155', description: 'История инкассаций по модему' },
    { endpoint: 'reports/sales-by-products?modem_id=8155', description: 'Продажи по модему' },
    
    // Отчеты с привязкой к аппарату (попробуем оба ID)
    { endpoint: 'reports/refill-history?vm_id=58690', description: 'История загрузок аппарата 58690' },
    { endpoint: 'reports/refill-history?vm_id=8155', description: 'История загрузок (id модема)' },
    
    // Проверим timeline_id из данных модема
    { endpoint: 'timeline/649592553', description: 'Timeline по ID из модема' },
    { endpoint: 'timeline/649592553/events', description: 'События timeline' },
  ];

  const testConnections = async () => {
    setLoading(true);
    const newResults: { [key: string]: any } = {};
    
    for (const test of connectionTests) {
      try {
        console.log(`🔗 Тестируем связь: ${test.endpoint}`);
        const data = await testEndpoint(test.endpoint);
        
        // Анализируем данные на наличие информации о загрузках
        const hasRefillData = analyzeForRefillData(data);
        const hasCollectionData = analyzeForCollectionData(data);
        const hasDateData = analyzeForDateData(data);
        
        newResults[test.endpoint] = { 
          success: true, 
          description: test.description,
          data: data,
          analysis: {
            hasRefillData,
            hasCollectionData, 
            hasDateData,
            dataType: Array.isArray(data) ? `array[${data.length}]` : typeof data,
            sample: getDataSample(data)
          }
        };
        console.log(`✅ Связь найдена: ${test.endpoint}`);
      } catch (error) {
        newResults[test.endpoint] = { 
          success: false, 
          description: test.description,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setResults(newResults);
    setLoading(false);
  };

  // Функции анализа
  const analyzeForRefillData = (data: any): boolean => {
    if (!data) return false;
    const refillKeywords = ['refill', 'loading', 'replenishment', 'restock', 'inventory'];
    return containsKeywords(data, refillKeywords);
  };

  const analyzeForCollectionData = (data: any): boolean => {
    if (!data) return false;
    const collectionKeywords = ['collection', 'cash', 'money', 'revenue'];
    return containsKeywords(data, collectionKeywords);
  };

  const analyzeForDateData = (data: any): boolean => {
    if (!data) return false;
    const dateKeywords = ['date', 'created_at', 'updated_at', 'timestamp', 'time'];
    return containsKeywords(data, dateKeywords);
  };

  const containsKeywords = (data: any, keywords: string[]): boolean => {
    const jsonString = JSON.stringify(data).toLowerCase();
    return keywords.some(keyword => jsonString.includes(keyword));
  };

  const getDataSample = (data: any): any => {
    if (Array.isArray(data) && data.length > 0) {
      return data.slice(0, 3);
    }
    return data;
  };

  const workingEndpoints = Object.entries(results).filter(([_, result]) => result.success);
  const refillEndpoints = workingEndpoints.filter(([_, result]) => result.analysis?.hasRefillData);
  const collectionEndpoints = workingEndpoints.filter(([_, result]) => result.analysis?.hasCollectionData);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className="h-5 w-5" />
          Связь модем 8155 ↔ аппарат 58690
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="font-medium">📋 Известные ID:</div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
            <div><strong>Модем ID:</strong> 8155</div>
            <div><strong>Аппарат ID (UI):</strong> 58690</div>
            <div><strong>Timeline ID:</strong> 649592553</div>
            <div><strong>Company ID:</strong> 2494</div>
          </div>
        </div>

        <Button 
          onClick={testConnections} 
          disabled={loading}
          className="w-full"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Link className="h-4 w-4 mr-2" />}
          {loading ? 'Тестируем связи...' : 'Найти связь модем-аппарат'}
        </Button>

        {Object.keys(results).length > 0 && (
          <div className="space-y-4">
            {/* Статистика */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-2 bg-blue-50 rounded">
                <div className="text-xl font-bold">{workingEndpoints.length}</div>
                <div className="text-xs">Работающие</div>
              </div>
              <div className="p-2 bg-green-50 rounded">
                <div className="text-xl font-bold">{refillEndpoints.length}</div>
                <div className="text-xs">С загрузками</div>
              </div>
              <div className="p-2 bg-orange-50 rounded">
                <div className="text-xl font-bold">{collectionEndpoints.length}</div>
                <div className="text-xs">С инкассациями</div>
              </div>
            </div>

            {/* Результаты */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {connectionTests.map((test) => {
                const result = results[test.endpoint];
                
                return (
                  <details key={test.endpoint} className="border rounded text-sm">
                    <summary className={`p-2 cursor-pointer flex items-center justify-between ${
                      result?.success 
                        ? result.analysis?.hasRefillData 
                          ? 'bg-green-100' 
                          : result.analysis?.hasCollectionData
                            ? 'bg-orange-100'
                            : 'bg-blue-100'
                        : 'bg-red-100'
                    }`}>
                      <div className="flex items-center gap-2">
                        {result?.success ? '✅' : '❌'}
                        <span>{test.description}</span>
                      </div>
                      <div className="text-xs opacity-70">
                        {result?.success ? result.analysis.dataType : 'Ошибка'}
                      </div>
                    </summary>
                    
                    {result?.success && (
                      <div className="p-2 bg-black">
                        <div className="text-xs mb-1">
                          {result.analysis.hasRefillData && '📦 '}
                          {result.analysis.hasCollectionData && '💰 '}
                          {result.analysis.hasDateData && '📅 '}
                        </div>
                        <pre className="text-xs bg-black-50 p-1 rounded overflow-x-auto max-h-32">
                          {JSON.stringify(result.analysis.sample, null, 2)}
                        </pre>
                      </div>
                    )}
                  </details>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};