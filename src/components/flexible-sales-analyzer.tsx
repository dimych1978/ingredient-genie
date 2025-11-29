// components/flexible-sales-analyzer.tsx
'use client';

import { useState } from 'react';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Calendar, Settings, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalysisPeriod {
  type: 'last_refill' | 'custom' | 'last_week' | 'last_month';
  dateFrom?: string;
  dateTo?: string;
}

export const FlexibleSalesAnalyzer = () => {
  const [vmId, setVmId] = useState('51211');
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customParams, setCustomParams] = useState({
    sale_type: '4',
    date_from: '',
    date_to: ''
  });
  const { apiRequest } = useTeletmetronApi();
  const { toast } = useToast();

  // Предустановленные периоды
  const presetPeriods = [
    {
      type: 'last_week' as const,
      name: 'Последние 7 дней',
      getDates: () => {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 7);
        return {
          date_from: from.toISOString().split('T')[0] + 'T00:00:00.000',
          date_to: to.toISOString().split('T')[0] + 'T23:59:59.999'
        };
      }
    },
    {
      type: 'last_month' as const,
      name: 'Последние 30 дней', 
      getDates: () => {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 30);
        return {
          date_from: from.toISOString().split('T')[0] + 'T00:00:00.000',
          date_to: to.toISOString().split('T')[0] + 'T23:59:59.999'
        };
      }
    }
  ];

  const analyzeSales = async (period: AnalysisPeriod) => {
    setLoading(true);
    try {
      let params: any = {
        vm_id: vmId,
        sale_type: customParams.sale_type
      };

      // Определяем даты в зависимости от типа периода
      if (period.type === 'custom' && customParams.date_from && customParams.date_to) {
        params.date_from = customParams.date_from;
        params.date_to = customParams.date_to;
      } else if (period.type === 'last_week' || period.type === 'last_month') {
        const preset = presetPeriods.find(p => p.type === period.type);
        if (preset) {
          const dates = preset.getDates();
          params.date_from = dates.date_from;
          params.date_to = dates.date_to;
        }
      } else if (period.type === 'last_refill') {
        // Здесь будет логика для периода с последней загрузки
        // Пока используем последнюю неделю как пример
        const dates = presetPeriods[0].getDates();
        params.date_from = dates.date_from;
        params.date_to = dates.date_to;
      }

      console.log('🔧 Параметры запроса:', params);

      const queryString = new URLSearchParams(params).toString();
      const result = await apiRequest(`/api/reports/sales-by-products?${queryString}`);
      
      console.log('📊 Результат анализа:', result);
      
      toast({
        title: 'Анализ завершен',
        description: `Проанализировано ${result.data?.length || 0} товаров`,
      });

      // Здесь можно добавить обработку результатов

    } catch (error) {
      console.error('❌ Ошибка анализа:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось получить данные',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Гибкий анализатор продаж
        </CardTitle>
        <CardDescription>
          Анализ продаж с различными параметрами и периодами
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Основные параметры */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">ID аппарата</label>
            <input
              type="text"
              value={vmId}
              onChange={(e) => setVmId(e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1"
              placeholder="51211"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Тип продаж</label>
            <select
              value={customParams.sale_type}
              onChange={(e) => setCustomParams(prev => ({ ...prev, sale_type: e.target.value }))}
              className="w-full border rounded px-3 py-2 mt-1"
            >
              <option value="4">Все продажи</option>
              <option value="1">Безналичные</option>
              <option value="2">Наличные</option>
            </select>
          </div>
        </div>

        {/* Быстрый выбор периода */}
        <div className="grid grid-cols-2 gap-2">
          {presetPeriods.map((preset) => (
            <Button
              key={preset.type}
              onClick={() => analyzeSales({ type: preset.type })}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <Calendar className="h-4 w-4 mr-1" />
              {preset.name}
            </Button>
          ))}
        </div>

        {/* Расширенные настройки */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full justify-start"
          >
            <Settings className="h-4 w-4 mr-2" />
            Расширенные настройки
          </Button>

          {showAdvanced && (
            <div className="mt-3 p-3 border rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Дата с</label>
                  <input
                    type="datetime-local"
                    value={customParams.date_from}
                    onChange={(e) => setCustomParams(prev => ({ ...prev, date_from: e.target.value }))}
                    className="w-full border rounded px-3 py-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Дата по</label>
                  <input
                    type="datetime-local"
                    value={customParams.date_to}
                    onChange={(e) => setCustomParams(prev => ({ ...prev, date_to: e.target.value }))}
                    className="w-full border rounded px-3 py-2 mt-1"
                  />
                </div>
              </div>

              <Button
                onClick={() => analyzeSales({ type: 'custom' })}
                disabled={loading || !customParams.date_from || !customParams.date_to}
                className="w-full"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Анализировать выбранный период
              </Button>
            </div>
          )}
        </div>

        {/* Информация о текущих настройках */}
        <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
          <div className="font-medium">Текущие параметры:</div>
          <div>Аппарат: #{vmId}</div>
          <div>Тип продаж: {customParams.sale_type === '4' ? 'Все' : customParams.sale_type === '1' ? 'Безнал' : 'Наличные'}</div>
          {customParams.date_from && customParams.date_to && (
            <div>Период: {customParams.date_from} - {customParams.date_to}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};