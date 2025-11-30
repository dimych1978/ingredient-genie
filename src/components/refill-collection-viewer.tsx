// components/refill-collection-viewer.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Package, DollarSign, Calendar, RefreshCw } from 'lucide-react';

export const RefillCollectionViewer = () => {
  const [loading, setLoading] = useState(false);
  const [refillData, setRefillData] = useState<any>(null);
  const [collectionData, setCollectionData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const { testEndpoint } = useTeletmetronApi();

  const MODEM_ID = '8155';

  const loadData = async () => {
    setLoading(true);
    
    try {
      // Загружаем данные загрузок
      console.log('📦 Загружаем данные загрузок...');
      const refills = await testEndpoint(`modems/${MODEM_ID}/refills`);
      setRefillData(refills);
      
      // Загружаем данные инкассаций
      console.log('💰 Загружаем данные инкассаций...');
      const collections = await testEndpoint(`modems/${MODEM_ID}/collections`);
      setCollectionData(collections);
      
      // Загружаем историю
      console.log('📚 Загружаем историю...');
      const history = await testEndpoint(`modems/${MODEM_ID}/history`);
      setHistoryData(history);
      
    } catch (error) {
      console.error('❌ Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  // Функции для форматирования дат
  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Анализ данных
  const analyzeRefills = (data: any) => {
    if (!data || !Array.isArray(data)) return null;
    
    const lastRefill = data[0]; // Предполагаем, что последний элемент первый
    const totalRefills = data.length;
    
    return { lastRefill, totalRefills };
  };

  const analyzeCollections = (data: any) => {
    if (!data || !Array.isArray(data)) return null;
    
    const lastCollection = data[0];
    const totalCollections = data.length;
    const totalRevenue = data.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    return { lastCollection, totalCollections, totalRevenue };
  };

  const refillAnalysis = analyzeRefills(refillData);
  const collectionAnalysis = analyzeCollections(collectionData);

  return (
    <Card className="w-full border-2">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Обслуживание аппарата (Модем {MODEM_ID})
          </div>
          <Button 
            onClick={loadData} 
            disabled={loading}
            size="sm"
            variant="outline"
          >
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? 'Загрузка...' : 'Обновить'}
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {/* Кнопка загрузки данных */}
        {!refillData && !collectionData && (
          <div className="text-center py-8">
            <Button onClick={loadData} disabled={loading} size="lg">
              {loading ? <Loader2 className="animate-spin mr-2" /> : <Package className="mr-2" />}
              {loading ? 'Загружаем данные...' : 'Загрузить данные обслуживания'}
            </Button>
          </div>
        )}

        {/* Статистика */}
        {(refillAnalysis || collectionAnalysis) && (
          <div className="grid grid-cols-2 gap-4">
            {/* Загрузки */}
            <Card className="border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-green-600" />
                  Загрузки
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-green-600">
                    {refillAnalysis?.totalRefills || 0}
                  </div>
                  <div className="text-xs text-slate-600">
                    Всего загрузок
                  </div>
                  {refillAnalysis?.lastRefill && (
                    <div className="text-xs text-slate-500 mt-2">
                      Последняя: {formatDate(refillAnalysis.lastRefill.date || refillAnalysis.lastRefill.created_at)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Инкассации */}
            <Card className="border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  Инкассации
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-blue-600">
                    {collectionAnalysis?.totalCollections || 0}
                  </div>
                  <div className="text-xs text-slate-600">
                    Всего инкассаций
                  </div>
                  {collectionAnalysis?.totalRevenue > 0 && (
                    <div className="text-xs font-medium text-slate-700">
                      Сумма: {collectionAnalysis?.totalRevenue} ₽
                    </div>
                  )}
                  {collectionAnalysis?.lastCollection && (
                    <div className="text-xs text-slate-500 mt-1">
                      Последняя: {formatDate(collectionAnalysis.lastCollection.date || collectionAnalysis.lastCollection.created_at)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Детальные данные */}
        <div className="grid gap-4">
          {/* Загрузки */}
          {refillData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Детали загрузок ({refillData.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {Array.isArray(refillData) && refillData.map((refill, index) => (
                    <div key={index} className="p-2 border rounded text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            Загрузка #{refillData.length - index}
                          </div>
                          <div className="text-xs text-slate-600">
                            Дата: {formatDate(refill.date || refill.created_at)}
                          </div>
                        </div>
                        {refill.products && (
                          <div className="text-xs text-slate-700">
                            Товаров: {refill.products.length}
                          </div>
                        )}
                      </div>
                      {refill.products && (
                        <div className="mt-1 text-xs">
                          {refill.products.slice(0, 3).map((product: any, i: number) => (
                            <div key={i} className="text-slate-600">
                              • {product.name || 'Товар'}: {product.quantity} шт.
                            </div>
                          ))}
                          {refill.products.length > 3 && (
                            <div className="text-slate-500">... и еще {refill.products.length - 3}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Инкассации */}
          {collectionData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Детали инкассаций ({collectionData.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {Array.isArray(collectionData) && collectionData.map((collection, index) => (
                    <div key={index} className="p-2 border rounded text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            Инкассация #{collectionData.length - index}
                          </div>
                          <div className="text-xs text-slate-600">
                            Дата: {formatDate(collection.date || collection.created_at)}
                          </div>
                        </div>
                        {collection.amount && (
                          <div className="font-bold text-green-600">
                            {collection.amount} ₽
                          </div>
                        )}
                      </div>
                      {collection.notes && (
                        <div className="mt-1 text-xs text-slate-600">
                          {collection.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Raw данные для отладки */}
        <details className="border rounded">
          <summary className="p-2 cursor-pointer text-sm font-medium">
            📋 Raw данные (для отладки)
          </summary>
          <div className="p-2 bg-slate-50 space-y-2">
            {refillData && (
              <div>
                <div className="text-xs font-medium mb-1">Загрузки:</div>
                <pre className="text-xs bg-white p-2 rounded overflow-x-auto max-h-40">
                  {JSON.stringify(refillData, null, 2)}
                </pre>
              </div>
            )}
            {collectionData && (
              <div>
                <div className="text-xs font-medium mb-1">Инкассации:</div>
                <pre className="text-xs bg-white p-2 rounded overflow-x-auto max-h-40">
                  {JSON.stringify(collectionData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  );
};