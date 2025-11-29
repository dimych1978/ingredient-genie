// components/api-debugger.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const ApiDebugger = () => {
  const [vmId, setVmId] = useState('51211'); // Ваш рабочий аппарат
  const [loading, setLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const { getSalesByProducts } = useTeletmetronApi();
  const { toast } = useToast();

  const fetchData = async () => {
    if (!vmId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Введите ID аппарата',
      });
      return;
    }

    setLoading(true);
    try {
      const dateFrom = '2025-11-17T00:00:00.000';
      const dateTo = '2025-11-23T23:59:59.999';

      console.log(`🔍 Запрос данных для аппарата #${vmId}...`);
      const data = await getSalesByProducts(vmId, dateFrom, dateTo);
      
      console.log('📊 Полный ответ от API:', data);
      setApiResponse(data);
      
      toast({
        title: 'Данные получены',
        description: `Получено данных для аппарата #${vmId}`,
      });

      // Анализируем структуру данных
      analyzeResponse(data);

    } catch (error) {
      console.error('❌ Ошибка:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const analyzeResponse = (data: any) => {
    console.log('🔬 Анализ структуры ответа:');
    
    if (Array.isArray(data)) {
      console.log('📦 Ответ - массив, количество элементов:', data.length);
      
      if (data.length > 0) {
        const firstItem = data[0];
        console.log('📋 Структура первого элемента:', firstItem);
        console.log('🗂️ Ключи первого элемента:', Object.keys(firstItem));
        
        // Анализируем типы данных
        Object.keys(firstItem).forEach(key => {
          console.log(`   ${key}: ${typeof firstItem[key]} = ${firstItem[key]}`);
        });
      }
    } else if (typeof data === 'object') {
      console.log('📦 Ответ - объект');
      console.log('🗂️ Ключи объекта:', Object.keys(data));
    } else {
      console.log('❓ Неизвестный формат ответа:', typeof data);
    }

    // Ищем информацию о продуктах
    if (data && Array.isArray(data)) {
      const products = data.map((item: any) => item.product_name || item.name || item.title).filter(Boolean);
      console.log('🍽️ Найденные продукты:', products);
      
      const quantities = data.map((item: any) => item.quantity || item.count || item.amount).filter(Boolean);
      console.log('📊 Количества:', quantities);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Анализ данных API
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ID аппарата (например: 51211)"
            value={vmId}
            onChange={(e) => setVmId(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
          />
          <Button onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'Получить данные'}
          </Button>
        </div>

        {apiResponse && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Структура данных:</h4>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(apiResponse, null, 2)}
                </pre>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Анализ:</h4>
                <div className="text-sm space-y-1">
                  <div><strong>Тип:</strong> {Array.isArray(apiResponse) ? 'Массив' : 'Объект'}</div>
                  {Array.isArray(apiResponse) && (
                    <>
                      <div><strong>Элементов:</strong> {apiResponse.length}</div>
                      {apiResponse.length > 0 && (
                        <>
                          <div><strong>Ключи:</strong> {Object.keys(apiResponse[0]).join(', ')}</div>
                          <div><strong>Пример продукта:</strong> {apiResponse[0].product_name || apiResponse[0].name || 'N/A'}</div>
                          <div><strong>Пример количества:</strong> {apiResponse[0].quantity || apiResponse[0].count || 'N/A'}</div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {Array.isArray(apiResponse) && apiResponse.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Список продуктов:</h4>
                <div className="max-h-40 overflow-y-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(apiResponse[0]).map(key => (
                          <th key={key} className="text-left p-2 border-b">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {apiResponse.slice(0, 10).map((item, index) => (
                        <tr key={index} className="border-b">
                          {Object.keys(apiResponse[0]).map(key => (
                            <td key={key} className="p-2">{String(item[key])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {apiResponse.length > 10 && (
                    <div className="p-2 text-center text-gray-500">
                      ... и еще {apiResponse.length - 10} записей
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};