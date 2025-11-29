// components/final-sales-analyzer.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Calendar, Download, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProductSummary {
  name: string;
  productNumber: string;
  quantity: number;
}

export const FinalSalesAnalyzer = () => {
  const [vmId, setVmId] = useState('51211');
  const [lastRefillDate, setLastRefillDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState<any>(null);
  const [productSummary, setProductSummary] = useState<ProductSummary[]>([]);
  const { getSalesByProducts } = useTeletmetronApi();
  const { toast } = useToast();

  // Быстрый выбор дат
  const quickDates = [
    { label: 'Сегодня', days: 0 },
    { label: '3 дня', days: 3 },
    { label: 'Неделя', days: 7 },
    { label: '2 недели', days: 14 },
    { label: 'Месяц', days: 30 }
  ];

  const setQuickDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    setLastRefillDate(date.toISOString().split('T')[0]);
  };

  const analyzeSales = async () => {
    if (!vmId.trim() || !lastRefillDate) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Заполните ID аппарата и дату последней загрузки',
      });
      return;
    }

    setLoading(true);
    try {
      const dateFrom = lastRefillDate + 'T00:00:00.000';
      const dateTo = new Date().toISOString().split('T')[0] + 'T23:59:59.999';

      console.log('📊 Анализ продаж за период:', { dateFrom, dateTo });
      
      const data = await getSalesByProducts(vmId, dateFrom, dateTo);
      setSalesData(data);
      analyzeProducts(data.data);
      
      toast({
        title: 'Анализ завершен!',
        description: `Проанализировано ${data.data.length} товаров`,
      });

    } catch (error) {
      console.error('❌ Ошибка:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось получить данные',
      });
    } finally {
      setLoading(false);
    }
  };

  const analyzeProducts = (products: any[]) => {
    const summaryMap = new Map<string, ProductSummary>();
    
    products.forEach(product => {
      const key = product.planogram.name;
      const existing = summaryMap.get(key);
      
      if (existing) {
        existing.quantity += product.number;
      } else {
        summaryMap.set(key, {
          name: product.planogram.name,
          productNumber: product.product_number,
          quantity: product.number
        });
      }
    });

    const sortedSummary = Array.from(summaryMap.values())
      .sort((a, b) => b.quantity - a.quantity);
    
    setProductSummary(sortedSummary);
  };

  const exportToCSV = () => {
    if (!productSummary.length) return;

    const headers = ['Название товара', 'Код товара', 'Количество продаж'];
    const csvContent = [
      headers.join(','),
      ...productSummary.map(item => 
        `"${item.name.replace('"', '""')}",${item.productNumber},${item.quantity}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_${vmId}_${lastRefillDate}_to_${new Date().toISOString().split('T')[0]}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Анализ продаж с последней загрузки
        </CardTitle>
        <CardDescription>
          Укажите дату последнего пополнения для анализа продаж
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Основные параметры */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">ID аппарата</label>
            <input
              type="text"
              value={vmId}
              onChange={(e) => setVmId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="51211"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium block mb-1">Дата последней загрузки</label>
            <input
              type="date"
              value={lastRefillDate}
              onChange={(e) => setLastRefillDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        {/* Быстрый выбор даты */}
        <div>
          <label className="text-sm font-medium block mb-2">Быстрый выбор периода:</label>
          <div className="flex flex-wrap gap-2">
            {quickDates.map(({ label, days }) => (
              <Button
                key={label}
                onClick={() => setQuickDate(days)}
                variant="outline"
                size="sm"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Кнопка анализа */}
        <Button 
          onClick={analyzeSales} 
          disabled={loading || !vmId.trim() || !lastRefillDate}
          className="w-full"
        >
          {loading ? <Loader2 className="animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
          {loading ? 'Анализ...' : 'Анализировать продажи'}
        </Button>

        {/* Результаты */}
        {salesData && (
          <div className="space-y-4">
            {/* Статистика */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600">
                    {salesData.total.quantity}
                  </div>
                  <div className="text-gray-600">Всего продаж</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {productSummary.length}
                  </div>
                  <div className="text-gray-600">Уникальных товаров</div>
                </CardContent>
              </Card>
            </div>

            {/* Сводка по товарам */}
            {productSummary.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold">Топ товаров по продажам:</h4>
                  <Button size="sm" onClick={exportToCSV}>
                    <Download className="h-4 w-4 mr-1" />
                    CSV
                  </Button>
                </div>
                
                <div className="max-h-60 overflow-y-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 border-b">Товар</th>
                        <th className="text-left p-2 border-b">Код</th>
                        <th className="text-right p-2 border-b">Продано</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productSummary.map((product, index) => (
                        <tr key={product.productNumber} className="border-b hover:bg-gray-50">
                          <td className="p-2">{product.name}</td>
                          <td className="p-2 text-gray-600">{product.productNumber}</td>
                          <td className="p-2 text-right font-medium">
                            {product.quantity} шт
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Информация о периоде */}
            <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded">
              <div className="font-medium">Период анализа:</div>
              <div>С {lastRefillDate} по {new Date().toISOString().split('T')[0]}</div>
              <div>
                ({Math.ceil((new Date().getTime() - new Date(lastRefillDate).getTime()) / (1000 * 60 * 60 * 24))} дней)
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};